# Changelog

## v1.0.0 (upcoming)

First stable release of `ya-repo-toc`, forked from [repo-toc](https://github.com/kmtusher97/repo-toc) v1.3.0.

## v0.0.1

Initial publish to reserve package name and configure trusted publishing.

### New features

- **Git-native file discovery**: Uses `git ls-files` when inside a git repository, so only tracked files appear in the TOC. Falls back to filesystem traversal outside of git repos.
- **`--recurse-gitignore` / `-r`**: Opt-in support for nested `.gitignore` files in subdirectories (filesystem path only). Displays a warning when used in a git repo where it has no effect.
- **`--prune-empty` / `-p`**: Hide directories that contain no files matching the extension filter.
- **Programmatic `useGitTracking` option**: Override git auto-detection in the `getTableOfContents` API.

### Bug fixes

- **`#` in folder names breaks links** ([upstream#8](https://github.com/kmtusher97/repo-toc/issues/8)): Folder names containing `#` now produce valid markdown links by encoding `#` as `%23`.
- **Nested `.gitignore` patterns**: Fixed pattern matching for anchored (`/`), directory-only (`/` suffix), negation (`!`), implicit anchoring, and `**` glob patterns.
- **`isDirectory` detection**: Fixed `dirOnly` patterns incorrectly matching files by passing an explicit `isDirectory` parameter instead of guessing from `path.extname`.

### Improvements

- **Zero runtime dependencies**: Replaced `yargs` (17 transitive packages) with Node's built-in `util.parseArgs`.
- **Node 18.3+ engine requirement**: Declared in `package.json` to prevent confusing errors on older Node versions.
- **Test parallelization**: Fixed race conditions between test suites sharing the `mocks/` directory.
- **Comprehensive gitignore test coverage**: 31 tests covering every valid `.gitignore` pattern at both root and nested levels.
- **CI**: Tests run against Node 18, 20, and 22.
