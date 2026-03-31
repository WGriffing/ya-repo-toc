/**
 * Common assertions for TOC content
 * @param {string} content - The content to test
 * @param {Object} options - Assertion options
 * @param {boolean} options.shouldContainTestFiles - Whether test-files should be included
 * @param {boolean} options.shouldContainTextFile - Whether TextFile.txt should be included
 */
function assertTocContent(content, options = {}) {
  const { shouldContainTestFiles = true, shouldContainTextFile = false } =
    options;

  // Check that the TOC contains expected files
  expect(content).toContain(`- [TestFile3](./TestFile3.md)`);

  if (shouldContainTestFiles) {
    expect(content).toContain(`- test-files`);
    expect(content).toContain(
      `- [Test File 1 Title](./test-files/TestFile1.md)`
    );
  }

  if (shouldContainTextFile) {
    expect(content).toContain(`- [TextFile](./test-files/TextFile.txt)`);
  }

  // Ensure it doesn't contain test artifacts from other tests
  expect(content).not.toContain("gitignore-test");
}

module.exports = {
  assertTocContent,
};
