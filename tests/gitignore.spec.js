const fs = require("fs");
const path = require("path");
const {
  shouldSkipFolder,
  shouldSkipFile,
  isGitignored,
  clearGitignoreCache,
} = require("../lib/utils");
const { getTableOfContents } = require("../lib");

describe("Gitignore functionality", () => {
  const testDir = path.join(__dirname, "mocks", "gitignore-test");

  function setupTestDirectory() {
    // Clean up any existing test directory first
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Create test directory structure
    fs.mkdirSync(testDir, { recursive: true });

    // Create test .gitignore file (without leading newline)
    const gitignoreContent = `# Comments should be ignored
node_modules/
*.log
build
dist/
temp*.md
.env
*.test.js`;
    fs.writeFileSync(path.join(testDir, ".gitignore"), gitignoreContent);

    // Create test files and directories
    fs.mkdirSync(path.join(testDir, "node_modules"), { recursive: true });
    fs.mkdirSync(path.join(testDir, "dist"), { recursive: true });
    fs.mkdirSync(path.join(testDir, "src"), { recursive: true });

    fs.writeFileSync(path.join(testDir, "app.log"), "log content");
    fs.writeFileSync(path.join(testDir, "build"), "build file");
    fs.writeFileSync(path.join(testDir, "temp-file.md"), "temp content");
    fs.writeFileSync(path.join(testDir, "README.md"), "# Test README");
    fs.writeFileSync(path.join(testDir, ".env"), "SECRET=value");
    fs.writeFileSync(path.join(testDir, "app.test.js"), "test content");
    fs.writeFileSync(path.join(testDir, "app.js"), "app content");
  }

  beforeEach(() => {
    // Set up test directory before each test to ensure isolation
    setupTestDirectory();
  });

  afterEach(() => {
    // Clean up test directory after each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    clearGitignoreCache();
  });

  test("should detect gitignored directories", () => {
    expect(shouldSkipFolder("node_modules", [], testDir, testDir)).toBe(true);
    expect(shouldSkipFolder("dist", [], testDir, testDir)).toBe(true);
    expect(shouldSkipFolder("src", [], testDir, testDir)).toBe(false);
  });

  test("should detect gitignored files", () => {
    expect(shouldSkipFile("app.log", testDir, testDir)).toBe(true);
    expect(shouldSkipFile("build", testDir, testDir)).toBe(true);
    expect(shouldSkipFile("temp-file.md", testDir, testDir)).toBe(true);
    expect(shouldSkipFile(".env", testDir, testDir)).toBe(true);
    expect(shouldSkipFile("app.test.js", testDir, testDir)).toBe(true);
    expect(shouldSkipFile("README.md", testDir, testDir)).toBe(false);
    expect(shouldSkipFile("app.js", testDir, testDir)).toBe(false);
  });

  test("should work with isGitignored function directly", () => {
    // node_modules/ is a directory-only pattern, so isDirectory must be true
    expect(isGitignored(path.join(testDir, "node_modules"), testDir, false, true)).toBe(
      true
    );
    expect(isGitignored(path.join(testDir, "app.log"), testDir)).toBe(true);
    expect(isGitignored(path.join(testDir, "README.md"), testDir)).toBe(false);
    expect(isGitignored(path.join(testDir, "app.js"), testDir)).toBe(false);
  });

  test("should exclude gitignored files from TOC generation", () => {
    const toc = getTableOfContents({ useGitTracking: false,
      dirPath: testDir,
      extensions: [".md", ".js"],
    });

    // Should include non-gitignored files
    expect(toc).toContain("README.md");
    expect(toc).toContain("app.js");
    expect(toc).toContain("- src");

    // Should exclude gitignored files and directories
    expect(toc).not.toContain("node_modules");
    expect(toc).not.toContain("dist");
    expect(toc).not.toContain("temp-file.md");
    expect(toc).not.toContain("app.test.js");
  });

  test("should handle missing .gitignore file gracefully", () => {
    const testDirNoGitignore = path.join(__dirname, "mocks", "no-gitignore");

    if (!fs.existsSync(testDirNoGitignore)) {
      fs.mkdirSync(testDirNoGitignore, { recursive: true });
    }

    fs.writeFileSync(path.join(testDirNoGitignore, "test.md"), "# Test");

    try {
      expect(
        shouldSkipFile("test.md", testDirNoGitignore, testDirNoGitignore)
      ).toBe(false);
      expect(
        shouldSkipFolder("testdir", [], testDirNoGitignore, testDirNoGitignore)
      ).toBe(false);

      const toc = getTableOfContents({ useGitTracking: false,
        dirPath: testDirNoGitignore,
        extensions: [".md"],
      });
      expect(toc).toContain("test.md");
    } finally {
      // Clean up
      if (fs.existsSync(testDirNoGitignore)) {
        fs.rmSync(testDirNoGitignore, { recursive: true, force: true });
      }
    }
  });

  test("should combine gitignore with manual exclusions", () => {
    const toc = getTableOfContents({ useGitTracking: false,
      dirPath: testDir,
      extensions: [".md", ".js"],
      excludedDirs: ["src"], // Manually exclude src directory
    });

    // Should exclude both gitignored and manually excluded items
    expect(toc).not.toContain("node_modules"); // gitignored
    expect(toc).not.toContain("src"); // manually excluded
    expect(toc).not.toContain("temp-file.md"); // gitignored

    // Should include non-excluded files
    expect(toc).toContain("README.md");
    expect(toc).toContain("app.js");
  });
});

describe("Recurse gitignore", () => {
  const testDir = path.join(__dirname, "mocks", "recurse-gitignore-test");

  function setupTestDirectory() {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Root with a .gitignore that ignores *.log
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, ".gitignore"), "*.log\n");
    fs.writeFileSync(path.join(testDir, "README.md"), "# Root README");
    fs.writeFileSync(path.join(testDir, "root.log"), "log content");

    // Subdirectory with its own .gitignore that ignores *.tmp and /generated (anchored)
    const subDir = path.join(testDir, "subdir");
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, ".gitignore"), "*.tmp\n/generated\n");
    fs.writeFileSync(path.join(subDir, "notes.md"), "# Notes");
    fs.writeFileSync(path.join(subDir, "data.tmp"), "temp data");
    fs.writeFileSync(path.join(subDir, "debug.log"), "debug log");

    // Anchored directory: should be ignored when recurse is on
    const generatedDir = path.join(subDir, "generated");
    fs.mkdirSync(generatedDir, { recursive: true });
    fs.writeFileSync(path.join(generatedDir, "output.md"), "# Output");

    // A directory with the same name elsewhere should NOT be ignored
    // (anchored patterns only apply relative to their .gitignore location)
    const otherGenerated = path.join(testDir, "generated");
    fs.mkdirSync(otherGenerated, { recursive: true });
    fs.writeFileSync(path.join(otherGenerated, "other.md"), "# Other");
  }

  beforeEach(() => {
    setupTestDirectory();
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    clearGitignoreCache();
  });

  test("without recurse, nested .gitignore patterns are not applied", () => {
    const toc = getTableOfContents({ useGitTracking: false,
      dirPath: testDir,
      extensions: [],
      recurseGitignore: false,
    });

    // Root .gitignore patterns still apply
    expect(toc).not.toContain("root.log");
    expect(toc).not.toContain("debug.log");

    // Nested .gitignore pattern (*.tmp) is NOT applied
    expect(toc).toContain("data.tmp");

    // Anchored pattern (/generated) is NOT applied without recurse
    expect(toc).toContain("output.md");

    // Normal files included
    expect(toc).toContain("README.md");
    expect(toc).toContain("notes.md");
  });

  test("with recurse, nested .gitignore patterns are applied", () => {
    const toc = getTableOfContents({ useGitTracking: false,
      dirPath: testDir,
      extensions: [],
      recurseGitignore: true,
    });

    // Root .gitignore patterns still apply
    expect(toc).not.toContain("root.log");
    expect(toc).not.toContain("debug.log");

    // Nested .gitignore pattern (*.tmp) IS applied
    expect(toc).not.toContain("data.tmp");

    // Anchored pattern (/generated) excludes subdir/generated
    expect(toc).not.toContain("output.md");

    // But root-level "generated" dir is NOT excluded (anchored to subdir only)
    expect(toc).toContain("other.md");

    // Normal files included
    expect(toc).toContain("README.md");
    expect(toc).toContain("notes.md");
  });
});

describe("Gitignore pattern coverage (root-level)", () => {
  const testDir = path.join(__dirname, "mocks", "pattern-coverage-test");

  function setup(gitignoreContent, files) {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, ".gitignore"), gitignoreContent);
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(testDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
  }

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    clearGitignoreCache();
  });

  test("simple filename pattern matches anywhere in tree", () => {
    setup("secret.md", {
      "secret.md": "# Secret",
      "docs/secret.md": "# Nested Secret",
      "public.md": "# Public",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [".md"] });
    expect(toc).not.toContain("secret.md");
    expect(toc).toContain("public.md");
  });

  test("directory-only pattern (trailing /) only matches directories, not files", () => {
    setup("build/", {
      "build/output.md": "# Output",
      "src/build.md": "# Build Doc",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [".md"] });
    expect(toc).not.toContain("output.md");
    expect(toc).toContain("Build Doc");
  });

  test("anchored pattern (leading /) only matches in .gitignore directory", () => {
    setup("/local.md", {
      "local.md": "# Local",
      "sub/local.md": "# Sub Local",
      "other.md": "# Other",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [".md"] });
    expect(toc).not.toContain("[Local]");
    expect(toc).toContain("Sub Local");
    expect(toc).toContain("Other");
  });

  test("wildcard * matches within a single path segment", () => {
    setup("*.log", {
      "app.log": "log",
      "error.log": "log",
      "readme.md": "# Readme",
      "sub/debug.log": "log",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [] });
    expect(toc).not.toContain("app.log");
    expect(toc).not.toContain("error.log");
    expect(toc).not.toContain("debug.log");
    expect(toc).toContain("readme.md");
  });

  test("wildcard ? matches a single character", () => {
    setup("file?.txt", {
      "file1.txt": "one",
      "file2.txt": "two",
      "fileAB.txt": "nope",
      "file.txt": "nope",
      "readme.md": "# Readme",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [] });
    expect(toc).not.toContain("file1.txt");
    expect(toc).not.toContain("file2.txt");
    expect(toc).toContain("fileAB.txt");
    expect(toc).toContain("file.txt");
    expect(toc).toContain("readme.md");
  });

  test("double star ** matches across directories", () => {
    setup("**/logs", {
      "logs/a.md": "# A",
      "src/logs/b.md": "# B",
      "deep/nested/logs/c.md": "# C",
      "readme.md": "# Readme",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [".md"] });
    expect(toc).not.toContain("a.md");
    expect(toc).not.toContain("b.md");
    expect(toc).not.toContain("c.md");
    expect(toc).toContain("readme.md");
  });

  test("trailing ** matches everything inside", () => {
    setup("vendor/**", {
      "vendor/lib.md": "# Lib",
      "vendor/deep/nested.md": "# Nested",
      "readme.md": "# Readme",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [".md"] });
    expect(toc).not.toContain("lib.md");
    expect(toc).not.toContain("nested.md");
    expect(toc).toContain("readme.md");
  });

  test("negation pattern (!) un-ignores a previously ignored file", () => {
    setup("*.md\n!important.md", {
      "notes.md": "# Notes",
      "important.md": "# Important",
      "readme.txt": "readme",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [".md", ".txt"] });
    expect(toc).not.toContain("notes.md");
    expect(toc).toContain("important.md");
    expect(toc).toContain("readme.txt");
  });

  test("comments and empty lines are ignored", () => {
    setup("# This is a comment\n\n  \nactual.md\n# Another comment", {
      "actual.md": "# Actual",
      "readme.md": "# Readme",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [".md"] });
    expect(toc).not.toContain("actual.md");
    expect(toc).toContain("readme.md");
  });

  test("pattern with path separator matches specific paths", () => {
    setup("docs/internal", {
      "docs/internal/secret.md": "# Secret",
      "docs/public.md": "# Public",
      "internal/other.md": "# Other",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [".md"] });
    expect(toc).not.toContain("secret.md");
    expect(toc).toContain("public.md");
    expect(toc).toContain("other.md");
  });

  test("combined anchored + directory-only pattern", () => {
    setup("/dist/", {
      "dist/bundle.md": "# Bundle",
      "src/dist/other.md": "# Other",
      "readme.md": "# Readme",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [".md"] });
    expect(toc).not.toContain("bundle.md");
    expect(toc).toContain("other.md");
    expect(toc).toContain("readme.md");
  });
});

describe("Gitignore pattern coverage (nested with --recurse-gitignore)", () => {
  const testDir = path.join(__dirname, "mocks", "pattern-nested-test");

  // Places the .gitignore inside a subdirectory, tests with recurseGitignore: true
  function setup(gitignoreContent, files) {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(testDir, "sub"), { recursive: true });
    // Root has no .gitignore; the patterns live in sub/.gitignore
    fs.writeFileSync(path.join(testDir, "sub", ".gitignore"), gitignoreContent);
    fs.writeFileSync(path.join(testDir, "root.md"), "# Root");
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(testDir, "sub", filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
  }

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    clearGitignoreCache();
  });

  test("simple filename pattern in nested .gitignore", () => {
    setup("secret.md", {
      "secret.md": "# Secret",
      "deep/secret.md": "# Deep Secret",
      "public.md": "# Public",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [".md"], recurseGitignore: true });
    expect(toc).not.toContain("Secret");
    expect(toc).toContain("Public");
    expect(toc).toContain("Root");
  });

  test("directory-only pattern in nested .gitignore", () => {
    setup("build/", {
      "build/output.md": "# Output",
      "src/build.md": "# Build Doc",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [".md"], recurseGitignore: true });
    expect(toc).not.toContain("output.md");
    expect(toc).toContain("Build Doc");
  });

  test("anchored pattern in nested .gitignore scopes to that directory", () => {
    setup("/local.md", {
      "local.md": "# Local",
      "deep/local.md": "# Deep Local",
      "other.md": "# Other",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [".md"], recurseGitignore: true });
    // sub/local.md excluded (anchored to sub/)
    expect(toc).not.toContain("[Local]");
    // sub/deep/local.md NOT excluded (anchored only to sub/, not sub/deep/)
    expect(toc).toContain("Deep Local");
    expect(toc).toContain("Other");
  });

  test("wildcard * in nested .gitignore", () => {
    setup("*.log", {
      "app.log": "log",
      "readme.md": "# Readme",
      "deep/debug.log": "log",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [], recurseGitignore: true });
    expect(toc).not.toContain("app.log");
    expect(toc).not.toContain("debug.log");
    expect(toc).toContain("readme.md");
  });

  test("wildcard ? in nested .gitignore", () => {
    setup("file?.txt", {
      "file1.txt": "one",
      "fileAB.txt": "nope",
      "readme.md": "# Readme",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [], recurseGitignore: true });
    expect(toc).not.toContain("file1.txt");
    expect(toc).toContain("fileAB.txt");
    expect(toc).toContain("readme.md");
  });

  test("double star ** in nested .gitignore", () => {
    setup("**/logs", {
      "logs/a.md": "# A",
      "deep/logs/b.md": "# B",
      "readme.md": "# Readme",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [".md"], recurseGitignore: true });
    expect(toc).not.toContain("a.md");
    expect(toc).not.toContain("b.md");
    expect(toc).toContain("readme.md");
  });

  test("trailing ** in nested .gitignore", () => {
    setup("vendor/**", {
      "vendor/lib.md": "# Lib",
      "vendor/deep/nested.md": "# Nested",
      "readme.md": "# Readme",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [".md"], recurseGitignore: true });
    expect(toc).not.toContain("lib.md");
    expect(toc).not.toContain("nested.md");
    expect(toc).toContain("readme.md");
  });

  test("negation pattern in nested .gitignore", () => {
    setup("*.md\n!important.md", {
      "notes.md": "# Notes",
      "important.md": "# Important",
      "readme.txt": "readme",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [".md", ".txt"], recurseGitignore: true });
    expect(toc).not.toContain("notes.md");
    expect(toc).toContain("important.md");
    expect(toc).toContain("readme.txt");
  });

  test("combined anchored + directory-only in nested .gitignore", () => {
    setup("/dist/", {
      "dist/bundle.md": "# Bundle",
      "other/dist/keep.md": "# Keep",
      "readme.md": "# Readme",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [".md"], recurseGitignore: true });
    // sub/dist/ excluded (anchored + dirOnly relative to sub/)
    expect(toc).not.toContain("bundle.md");
    // sub/other/dist/ NOT excluded (anchored to sub/ only)
    expect(toc).toContain("keep.md");
    expect(toc).toContain("readme.md");
  });

  test("nested patterns are NOT applied without recurseGitignore", () => {
    setup("secret.md", {
      "secret.md": "# Secret",
      "public.md": "# Public",
    });
    const toc = getTableOfContents({ useGitTracking: false, dirPath: testDir, extensions: [".md"], recurseGitignore: false });
    // Without recurse, the nested .gitignore is ignored
    expect(toc).toContain("Secret");
    expect(toc).toContain("Public");
  });
});

describe("Prune empty", () => {
  const testDir = path.join(__dirname, "mocks", "prune-empty-test");

  function setupTestDirectory() {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    fs.mkdirSync(testDir, { recursive: true });

    // Directory with a matching file
    const docsDir = path.join(testDir, "docs");
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, "guide.md"), "# Guide");

    // Directory with no matching files (only .txt, but we filter for .md)
    const assetsDir = path.join(testDir, "assets");
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(assetsDir, "data.txt"), "some data");

    // Completely empty directory
    const emptyDir = path.join(testDir, "empty");
    fs.mkdirSync(emptyDir, { recursive: true });

    // Nested empty: parent -> child, neither has matching files
    const nestedParent = path.join(testDir, "nested");
    const nestedChild = path.join(nestedParent, "deep");
    fs.mkdirSync(nestedChild, { recursive: true });
    fs.writeFileSync(path.join(nestedChild, "file.txt"), "text");

    // Nested with match deep down: parent -> child -> has .md
    const deepParent = path.join(testDir, "deep-docs");
    const deepChild = path.join(deepParent, "section");
    fs.mkdirSync(deepChild, { recursive: true });
    fs.writeFileSync(path.join(deepChild, "page.md"), "# Page");
  }

  beforeEach(() => {
    setupTestDirectory();
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    clearGitignoreCache();
  });

  test("without prune, empty directories are included", () => {
    const toc = getTableOfContents({ useGitTracking: false,
      dirPath: testDir,
      extensions: [".md"],
      pruneEmpty: false,
    });

    expect(toc).toContain("- docs");
    expect(toc).toContain("- assets");
    expect(toc).toContain("- empty");
    expect(toc).toContain("- nested");
    expect(toc).toContain("- deep");
  });

  test("with prune, empty directories are removed", () => {
    const toc = getTableOfContents({ useGitTracking: false,
      dirPath: testDir,
      extensions: [".md"],
      pruneEmpty: true,
    });

    // Directories with .md files (or descendants with .md) are kept
    expect(toc).toContain("- docs");
    expect(toc).toContain("guide.md");
    expect(toc).toContain("- deep-docs");
    expect(toc).toContain("- section");
    expect(toc).toContain("page.md");

    // Directories with no .md files anywhere are pruned
    expect(toc).not.toContain("- assets");
    expect(toc).not.toContain("- empty");
    expect(toc).not.toContain("- nested");
  });
});
