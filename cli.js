#!/usr/bin/env node

const { parseArgs } = require("node:util");
const { generateTableOfContent } = require("./lib");
const { isGitRepo } = require("./lib/utils");
const { version } = require("./package.json");

const helpText = `ya-repo-toc [options]

Options:
      --version             Show version number
  -d, --dir <path>          Directory path to generate TOC for       [default: cwd]
  -e, --ext <extensions>    File extensions to include (comma-separated)
                                                                     [default: ".md"]
  -o, --output <path>       File path to save the TOC               [default: "./README.md"]
  -x, --exclude <dirs>      Directories to exclude (comma-separated)
  -r, --recurse-gitignore   Respect nested .gitignore files in subdirectories
  -p, --prune-empty         Prune directories that contain no matching files
  -h, --help                Show help`;

const { values } = parseArgs({
  options: {
    dir:                { type: "string",  short: "d", default: process.cwd() },
    ext:                { type: "string",  short: "e", default: ".md" },
    output:             { type: "string",  short: "o", default: "./README.md" },
    exclude:            { type: "string",  short: "x", default: "" },
    "recurse-gitignore": { type: "boolean", short: "r", default: false },
    "prune-empty":      { type: "boolean", short: "p", default: false },
    help:               { type: "boolean", short: "h", default: false },
    version:            { type: "boolean", default: false },
  },
  strict: true,
  allowPositionals: false,
});

if (values.help) {
  console.log(helpText);
  process.exit(0);
}

if (values.version) {
  console.log(version);
  process.exit(0);
}

const dirPath = values.dir;
const extensions = values.ext.split(",");
const filePath = values.output;
const excludedDirs = values.exclude.split(",").filter(dir => dir.trim() !== "");
const recurseGitignore = values["recurse-gitignore"];
const pruneEmpty = values["prune-empty"];

const gitRepo = isGitRepo(dirPath);

if (recurseGitignore && gitRepo) {
  console.warn("Warning: --recurse-gitignore has no effect in a git repository (git handles .gitignore natively)");
}

generateTableOfContent({ dirPath, extensions, filePath, excludedDirs, recurseGitignore, pruneEmpty });
