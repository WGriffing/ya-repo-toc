const fs = require("fs");
const path = require("path");
const { generateTableOfContent } = require("ya-repo-toc");
const { assertTocContent } = require("./helpers/testUtils");

// Directories created by other test suites that may exist in mocks/ during parallel runs
const parallelTestDirs = ["gitignore-test", "recurse-gitignore-test", "prune-empty-test", "pattern-coverage-test", "pattern-nested-test", "special-chars-test"];

describe("test repo-toc package", () => {
  test("should generate TOC on marker less markdown file", () => {
    const dirPath = path.join(__dirname, "mocks");
    const filePath = path.join(__dirname, "temp.md");

    fs.writeFileSync(filePath, "## Table of contents");
    generateTableOfContent({ dirPath, filePath, excludedDirs: parallelTestDirs, useGitTracking: false });

    const fileContent = fs.readFileSync(filePath, "utf8");
    assertTocContent(fileContent);

    fs.unlink(filePath, (err) => {
      if (err) {
        throw err;
      }
    });
  });
});
