const fs = require("fs");
const path = require("path");

const { getTableOfContents } = require("../lib");
const { isGitRepo } = require("../lib/utils");
const { assertTocContent } = require("./helpers/testUtils");

// Directories created by other test suites that may exist in mocks/ during parallel runs
const parallelTestDirs = ["gitignore-test", "recurse-gitignore-test", "prune-empty-test", "pattern-coverage-test", "pattern-nested-test", "special-chars-test"];

describe("getFilesByExtension", () => {
  test("should return files with specified extensions", () => {
    const dirPath = path.join(__dirname, "/mocks");
    const extensions = [".md"];

    const result = getTableOfContents({ dirPath, extensions, excludedDirs: parallelTestDirs });
    assertTocContent(result);
  });

  test("should return all files no extensions", () => {
    const dirPath = path.join(__dirname, "/mocks");
    const extensions = [];

    const result = getTableOfContents({ dirPath, extensions, excludedDirs: parallelTestDirs });
    assertTocContent(result, { shouldContainTextFile: true });
  });

  test("should throw error for non-existent directory", () => {
    const invalidPath = "/invalid/path";
    const extensions = [".txt"];

    expect(() =>
      getTableOfContents({ dirPath: invalidPath, extensions })
    ).toThrowError(/no such file or directory/);
  });

  test("should throw error for invalid extensions", () => {
    const invalidPath = "/mocks";
    const extensions = [5];

    expect(() =>
      getTableOfContents({ dirPath: invalidPath, extensions })
    ).toThrowError(/Extensions must be an array of strings/);
  });

  test("should include files with multiple matching extensions", () => {
    const dirPath = path.join(__dirname, "/mocks");
    const extensions = [".md", ".txt"];

    const result = getTableOfContents({ dirPath, extensions });
    expect(result).toContain("./test-files/TextFile.txt");
    expect(result).toContain("./TestFile3.md");
  });
});

describe("Git tracking integration", () => {
  test("should detect git repo", () => {
    // The development directory is inside a git repo
    expect(isGitRepo(path.join(__dirname, ".."))).toBe(true);
  });

  test("should use git ls-files and exclude untracked files", () => {
    const dirPath = path.join(__dirname, "/mocks");

    // Create an untracked file
    const untrackedFile = path.join(dirPath, "untracked-test.md");
    fs.writeFileSync(untrackedFile, "# Untracked");

    try {
      // With git tracking (default), untracked file should NOT appear
      const tocGit = getTableOfContents({ dirPath, extensions: [".md"], excludedDirs: parallelTestDirs });
      expect(tocGit).not.toContain("untracked-test.md");
      expect(tocGit).toContain("TestFile3.md");

      // With filesystem fallback, untracked file SHOULD appear
      const tocFs = getTableOfContents({ dirPath, extensions: [".md"], excludedDirs: parallelTestDirs, useGitTracking: false });
      expect(tocFs).toContain("untracked-test.md");
      expect(tocFs).toContain("TestFile3.md");
    } finally {
      if (fs.existsSync(untrackedFile)) {
        fs.unlinkSync(untrackedFile);
      }
    }
  });

  test("git path should respect excludedDirs", () => {
    const dirPath = path.join(__dirname, "/mocks");

    const toc = getTableOfContents({
      dirPath,
      extensions: [".md"],
      excludedDirs: ["test-files", ...parallelTestDirs],
    });

    expect(toc).not.toContain("test-files");
    expect(toc).toContain("TestFile3.md");
  });

  test("git path should respect pruneEmpty", () => {
    const dirPath = path.join(__dirname, "/mocks");

    // The .hidden dir has a committed file but starts with dot, so it's skipped.
    // test-files has .md files so it stays. Let's just verify pruneEmpty doesn't break.
    const toc = getTableOfContents({
      dirPath,
      extensions: [".md"],
      excludedDirs: parallelTestDirs,
      pruneEmpty: true,
    });

    expect(toc).toContain("TestFile3.md");
    expect(toc).toContain("test-files");
  });
});

describe("Special characters in paths", () => {
  const testDir = path.join(__dirname, "mocks", "special-chars-test");

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test("folder names containing # should produce valid links", () => {
    // https://github.com/kmtusher97/repo-toc/issues/8
    const hashDir = path.join(testDir, "C#-projects");
    fs.mkdirSync(hashDir, { recursive: true });
    fs.writeFileSync(path.join(hashDir, "hello.md"), "# Hello");
    fs.writeFileSync(path.join(testDir, "root.md"), "# Root");

    const toc = getTableOfContents({
      dirPath: testDir,
      extensions: [".md"],
      useGitTracking: false,
    });

    // The folder name should appear as a directory entry
    expect(toc).toContain("C#-projects");

    // The link should encode # as %23 so it doesn't break as a URL fragment
    expect(toc).toContain("./C%23-projects/hello.md");
    expect(toc).not.toContain("./C#-projects/hello.md");
  });
});
