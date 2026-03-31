const fs = require("fs");
const path = require("path");

const {
  shouldSkipFolder,
  shouldSkipFile,
  getFileTitle,
  isGitRepo,
  getGitTrackedFiles,
  buildTreeFromFiles,
} = require("./utils");

function getTableOfContents({ dirPath = process.cwd(), extensions = [], excludedDirs = [], recurseGitignore = false, pruneEmpty = false, useGitTracking } = {}) {
  try {
    if (
      !Array.isArray(extensions) ||
      extensions.some((ext) => typeof ext !== "string")
    ) {
      throw new Error("Extensions must be an array of strings.");
    }

    if (
      !Array.isArray(excludedDirs) ||
      excludedDirs.some((dir) => typeof dir !== "string")
    ) {
      throw new Error("Excluded directories must be an array of strings.");
    }

    const resolvedDir = path.resolve(dirPath);
    // Auto-detect git unless explicitly overridden
    const useGit = useGitTracking !== undefined ? useGitTracking : isGitRepo(resolvedDir);

    let tree;
    if (useGit) {
      tree = buildGitTree(resolvedDir, extensions, excludedDirs, pruneEmpty);
    } else {
      tree = buildFsTree({ directory: resolvedDir, currentDir: ".", extensions, excludedDirs, rootDir: resolvedDir, recurseGitignore });
    }

    return renderTree(tree, resolvedDir, pruneEmpty);
  } catch (error) {
    throw error;
  }
}

function buildGitTree(dirPath, extensions, excludedDirs, pruneEmpty) {
  const allFiles = getGitTrackedFiles(dirPath);

  // Filter out excluded and hidden directories
  const nonExcluded = allFiles.filter(relativePath => {
    const parts = relativePath.split("/");
    for (let i = 0; i < parts.length - 1; i++) {
      if (excludedDirs.includes(parts[i]) || parts[i].startsWith(".")) {
        return false;
      }
    }
    return true;
  });

  if (pruneEmpty) {
    // Only include files matching the extension — directories without matches won't appear
    const filtered = nonExcluded.filter(relativePath =>
      extensions.length === 0 || extensions.includes(path.extname(relativePath))
    );
    return buildTreeFromFiles(filtered);
  }

  // Include all files for directory structure, but only matching extensions as file entries
  const matchingFiles = new Set(
    nonExcluded.filter(relativePath =>
      extensions.length === 0 || extensions.includes(path.extname(relativePath))
    )
  );
  return buildTreeFromFiles(nonExcluded, matchingFiles);
}

function buildFsTree({ directory, currentDir = ".", extensions, excludedDirs, rootDir, recurseGitignore }) {
  const entries = fs.readdirSync(directory);
  const children = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (shouldSkipFolder(entry, excludedDirs, directory, rootDir, recurseGitignore)) {
        continue;
      }
      const subtree = buildFsTree({
        directory: fullPath,
        currentDir: currentDir + "/" + entry,
        extensions,
        excludedDirs,
        rootDir,
        recurseGitignore,
      });
      children.push({ type: "dir", name: entry, children: subtree });
    } else if (
      extensions.length === 0 ||
      extensions.includes(path.extname(entry))
    ) {
      if (shouldSkipFile(entry, directory, rootDir, recurseGitignore)) {
        continue;
      }
      const filePath = currentDir + "/" + entry;
      children.push({ type: "file", name: entry, fullPath, filePath });
    }
  }

  return children;
}

function hasFiles(children) {
  for (const child of children) {
    if (child.type === "file") return true;
    if (child.type === "dir" && hasFiles(child.children)) return true;
  }
  return false;
}

function renderTree(children, dirPath, pruneEmpty, level = 0) {
  let toc = "";
  for (const child of children) {
    const indent = " ".repeat(level * 2);
    if (child.type === "dir") {
      if (pruneEmpty && !hasFiles(child.children)) {
        continue;
      }
      toc += `${indent}* **${child.name}**\n`;
      toc += renderTree(child.children, dirPath, pruneEmpty, level + 1);
    } else {
      // Git path provides relativePath; fs path provides fullPath + filePath
      const fullPath = child.fullPath || path.join(dirPath, child.relativePath);
      const rawPath = child.filePath || "./" + child.relativePath;
      // Encode characters that break markdown links (# is interpreted as URL fragment)
      const encodedPath = rawPath.replace(/#/g, "%23");
      toc += `${indent}* [${getFileTitle(fullPath)}](${encodedPath})\n`;
    }
  }
  return toc;
}

function updateTOC({ filePath = __dirname + "/README.md", contentToAdd }) {
  try {
    let fileContent = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, "utf8")
      : "";

    const tocStart = "<!---TOC-START--->";
    const tocEnd = "<!---TOC-END--->";

    const tocStartIndex = fileContent.indexOf(tocStart);
    const tocEndIndex = fileContent.indexOf(tocEnd);

    if (tocStartIndex !== -1 && tocEndIndex !== -1) {
      fileContent =
        fileContent.substring(0, tocStartIndex + tocStart.length) +
        `\n${contentToAdd}\n` +
        fileContent.substring(tocEndIndex);
    } else {
      const tocSection = `${tocStart}\n${contentToAdd}\n${tocEnd}`;
      fileContent = `${fileContent}\n\n${tocSection}`.trim();
    }

    fs.writeFileSync(filePath, fileContent, "utf8");
  } catch (err) {
    console.error("Error updating the TOC:", err.message);
  }
}

function generateTableOfContent({
  dirPath = process.cwd(),
  extensions = [".md"],
  filePath = path.join(__dirname, "README.md"),
  excludedDirs = [],
  recurseGitignore = false,
  pruneEmpty = false,
}) {
  updateTOC({
    filePath,
    contentToAdd: getTableOfContents({ dirPath, extensions, excludedDirs, recurseGitignore, pruneEmpty }),
  });
}

module.exports = {
  getFileTitle,
  getTableOfContents,
  generateTableOfContent,
};
