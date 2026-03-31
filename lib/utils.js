const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Cache for gitignore patterns to avoid reading files multiple times
const gitignoreCache = new Map();

function readGitignorePatterns(dirPath) {
  if (gitignoreCache.has(dirPath)) {
    return gitignoreCache.get(dirPath);
  }

  const gitignorePath = path.join(dirPath, '.gitignore');
  let patterns = [];

  if (fs.existsSync(gitignorePath)) {
    try {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      patterns = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(rawPattern => {
          let pattern = rawPattern;
          let dirOnly = false;
          let anchored = false;
          let negated = false;

          // Handle negation (un-ignore)
          if (pattern.startsWith('!')) {
            pattern = pattern.slice(1);
            negated = true;
          }

          // Handle trailing slashes (directory-only patterns)
          if (pattern.endsWith('/')) {
            pattern = pattern.slice(0, -1);
            dirOnly = true;
          }

          // Handle leading slash (anchored to the .gitignore's directory)
          if (pattern.startsWith('/')) {
            pattern = pattern.slice(1);
            anchored = true;
          }

          return { pattern, dirOnly, anchored, negated, baseDir: dirPath };
        });
    } catch (error) {
      console.warn(`Warning: Could not read .gitignore file at ${gitignorePath}`);
    }
  }

  gitignoreCache.set(dirPath, patterns);
  return patterns;
}

function getAllGitignorePatterns(rootPath, currentPath, recurse = false) {
  // Always include root .gitignore patterns
  let allPatterns = readGitignorePatterns(rootPath);

  // When recurse is enabled, also collect .gitignore patterns from subdirectories
  // between the root and the current path
  if (recurse && currentPath && currentPath !== rootPath) {
    const relativePath = path.relative(rootPath, currentPath);
    const segments = relativePath.split(path.sep);
    let dir = rootPath;
    for (const segment of segments) {
      dir = path.join(dir, segment);
      if (dir !== rootPath) {
        allPatterns = allPatterns.concat(readGitignorePatterns(dir));
      }
    }
  }

  return allPatterns;
}

function patternToRegex(pattern) {
  // Convert gitignore glob pattern to regex string
  let regex = '';
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === '*' && pattern[i + 1] === '*') {
      if (pattern[i + 2] === '/') {
        // **/ matches zero or more directories
        regex += '(?:.+\\/)?';
        i += 3;
      } else {
        // ** at end matches everything
        regex += '.*';
        i += 2;
      }
    } else if (pattern[i] === '*') {
      // * matches anything except /
      regex += '[^/]*';
      i++;
    } else if (pattern[i] === '?') {
      // ? matches any single character except /
      regex += '[^/]';
      i++;
    } else if (pattern[i] === '.') {
      regex += '\\.';
      i++;
    } else {
      regex += pattern[i];
      i++;
    }
  }
  return regex;
}

function matchesPattern(matchPath, basename, pattern, anchored) {
  if (pattern.includes('*') || pattern.includes('?')) {
    const regexStr = patternToRegex(pattern);
    const regex = new RegExp('^' + regexStr + '$');
    if (regex.test(matchPath) || (!anchored && regex.test(basename))) {
      return true;
    }
  } else {
    if (anchored) {
      if (matchPath === pattern || matchPath.startsWith(pattern + path.sep)) {
        return true;
      }
    } else {
      if (matchPath === pattern ||
          matchPath.endsWith(path.sep + pattern) ||
          basename === pattern ||
          matchPath.startsWith(pattern + path.sep)) {
        return true;
      }
    }
  }
  return false;
}

function matchesGitignorePattern(filePath, rootPath, patterns, isDirectory = false) {
  let ignored = false;

  for (const { pattern, dirOnly, anchored, negated, baseDir } of patterns) {
    // Directory-only patterns (e.g. "node_modules/") only match directories
    if (dirOnly && !isDirectory) continue;

    // Patterns containing a slash (not just leading/trailing) are implicitly
    // anchored to the .gitignore's directory, per git's behavior
    const implicitlyAnchored = anchored || pattern.includes('/');
    const matchPath = implicitlyAnchored
      ? path.relative(baseDir, filePath)
      : path.relative(rootPath, filePath);
    const basename = path.basename(filePath);

    if (matchesPattern(matchPath, basename, pattern, implicitlyAnchored)) {
      ignored = !negated;
    }
  }

  return ignored;
}

function isGitignored(filePath, rootPath, recurseGitignore = false, isDirectory = false) {
  const dirPath = path.dirname(filePath);

  // Get gitignore patterns (root only, or root + nested if recurse is on)
  const patterns = getAllGitignorePatterns(rootPath, dirPath, recurseGitignore);

  return matchesGitignorePattern(filePath, rootPath, patterns, isDirectory);
}

function shouldSkipFolder(folderName, excludedDirs = [], folderPath = '', rootPath = '', recurseGitignore = false) {
  // Skip folders starting with dot (hidden folders)
  if (folderName.startsWith(".")) {
    return true;
  }

  // Skip folders in the excluded directories list
  if (excludedDirs.includes(folderName)) {
    return true;
  }

  // Skip folders matching .gitignore patterns
  if (rootPath && folderPath) {
    const fullFolderPath = path.join(folderPath, folderName);
    if (isGitignored(fullFolderPath, rootPath, recurseGitignore, true)) {
      return true;
    }
  }

  return false;
}

function shouldSkipFile(fileName, filePath = '', rootPath = '', recurseGitignore = false) {
  // Skip files matching .gitignore patterns
  if (rootPath && filePath) {
    const fullFilePath = path.join(filePath, fileName);
    if (isGitignored(fullFilePath, rootPath, recurseGitignore)) {
      return true;
    }
  }

  return false;
}

function getDefaultFileTitle(filePath) {
  const fileSegments = filePath.split("/");
  const fileName = fileSegments[fileSegments.length - 1];
  const ext = path.extname(fileName);
  return fileName.split(ext)[0];
}

function getMarkdownTitle(filePath) {
  const content = fs.readFileSync(filePath, "utf8");

  const titleMatch = content.match(/^#\s+(.*)/m);

  if (titleMatch) {
    return titleMatch[1].trim();
  }
  return getDefaultFileTitle(filePath);
}

function getFileTitle(filePath) {
  if ([".MD", ".md"].includes(path.extname(filePath))) {
    return getMarkdownTitle(filePath);
  }
  return getDefaultFileTitle(filePath);
}

function clearGitignoreCache() {
  gitignoreCache.clear();
}

function isGitRepo(dirPath) {
  try {
    execSync("git rev-parse --show-toplevel", {
      cwd: dirPath,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

function getGitTrackedFiles(dirPath) {
  const output = execSync("git ls-files", {
    cwd: dirPath,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return output
    .split("\n")
    .filter(line => line.length > 0);
}

function buildTreeFromFiles(files, matchingFiles) {
  // Build a nested tree structure from a flat list of relative file paths.
  // If matchingFiles is provided, only files in that set become leaf nodes;
  // all other files contribute to directory structure only.
  const root = { type: "dir", name: "", children: [] };

  for (const filePath of files) {
    const parts = filePath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      if (isFile) {
        if (!matchingFiles || matchingFiles.has(filePath)) {
          current.children.push({ type: "file", name: part, relativePath: filePath });
        }
      } else {
        let dir = current.children.find(c => c.type === "dir" && c.name === part);
        if (!dir) {
          dir = { type: "dir", name: part, children: [] };
          current.children.push(dir);
        }
        current = dir;
      }
    }
  }

  return root.children;
}

module.exports = {
  getFileTitle,
  shouldSkipFolder,
  shouldSkipFile,
  isGitignored,
  clearGitignoreCache,
  isGitRepo,
  getGitTrackedFiles,
  buildTreeFromFiles,
};
