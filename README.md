# ya-repo-toc

[![npm version](https://badge.fury.io/js/ya-repo-toc.svg)](https://badge.fury.io/js/ya-repo-toc)

Generate a markdown Table of Contents (TOC) for your GitHub repository. Uses `git ls-files` in git repositories to only include tracked files, and falls back to filesystem traversal with `.gitignore` support elsewhere.

> **Fork notice**: This is a fork of [repo-toc](https://github.com/kmtusher97/repo-toc) by [@kmtusher97](https://github.com/kmtusher97), with added support for git-native file discovery, nested `.gitignore` handling, and empty directory pruning.

## Installation

```bash
npm install -g ya-repo-toc
```

This installs the `ya-repo-toc` CLI command.

## Usage

### Example

Directory structure:

```
.
├── TestFile3.md
├── test-files/
│   ├── TestFile1.md
│   └── TextFile.txt
```

Generated Table of Contents:

```markdown
<!---TOC-START--->
* [TestFile3](./TestFile3.md)
* **test-files**
  * [Test File 1 Title](./test-files/TestFile1.md)

<!---TOC-END--->
```

### CLI

```
ya-repo-toc [options]

Options:
      --version           Show version number                          [boolean]
  -d, --dir               Directory path to generate TOC for
                                                  [string] [default: cwd]
  -e, --ext               File extensions to include (comma-separated)
                                                  [string] [default: ".md"]
  -o, --output            File path to save the TOC
                                                  [string] [default: "./README.md"]
  -x, --exclude           Directories to exclude (comma-separated)     [string]
  -r, --recurse-gitignore Respect nested .gitignore files in subdirectories
                                                  [boolean] [default: false]
  -p, --prune-empty       Prune directories that contain no matching files
                                                  [boolean] [default: false]
  -h, --help              Show help                                    [boolean]
```

### Git-Native File Discovery

When run inside a git repository, `ya-repo-toc` uses `git ls-files` to discover files:

- **Only tracked files appear** -- untracked, ignored, and unstaged files are automatically excluded
- **No `.gitignore` parsing needed** -- git handles ignore rules natively
- **Faster and more accurate** -- no filesystem walk or pattern matching required

When run outside a git repository, it falls back to filesystem traversal and respects the root `.gitignore` file automatically.

### Options

#### `--recurse-gitignore` / `-r`

By default (outside a git repo), only the root `.gitignore` is respected. Enable this flag to also respect nested `.gitignore` files in subdirectories.

This flag has no effect in a git repository (git handles nested `.gitignore` files natively). A warning is displayed if used in a git repo.

#### `--prune-empty` / `-p`

By default, all directories that contain tracked files are shown in the TOC, even if none match your extension filter. Enable this flag to hide directories that contain no files matching `--ext`.

Example: `ya-repo-toc --ext .md --prune-empty` omits directories that contain only `.js` or `.txt` files.

#### `--exclude` / `-x`

Exclude specific directories by name (comma-separated), in addition to `.gitignore` rules or git tracking.

```bash
ya-repo-toc --exclude node_modules,dist,build
```

### Usage Examples

```bash
# Default: generate TOC of .md files
ya-repo-toc

# Prune directories with no .md files
ya-repo-toc --prune-empty

# TOC for JavaScript/TypeScript files only
ya-repo-toc --ext .js,.ts --prune-empty

# Nested .gitignore support (non-git directories)
ya-repo-toc --recurse-gitignore --prune-empty

# Custom output file
ya-repo-toc -o docs/TOC.md --prune-empty
```

### Use with Pre-commit Hooks

#### Setup

1. Install pre-commit:
```bash
pip install pre-commit
```

2. Create `.github/hooks/generate-toc.sh`:
```bash
#!/bin/bash
set -e

if ! command -v node &> /dev/null; then
    echo "Node.js is not installed."
    exit 1
fi

if ! command -v ya-repo-toc &> /dev/null; then
    npm install -g ya-repo-toc
fi

if [ -f "README.md" ]; then
    cp README.md README.md.backup
    ya-repo-toc -o README.md --prune-empty
    if ! cmp -s README.md README.md.backup; then
        git add README.md
    fi
    rm -f README.md.backup
fi
```

3. Configure `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: local
    hooks:
      - id: generate-toc
        name: Generate Table of Contents
        entry: ./.github/hooks/generate-toc.sh
        language: script
        files: '\.md$'
        pass_filenames: false
        stages: [commit]
```

4. Install hooks:
```bash
pre-commit install
```

### Use with GitHub Actions

```yml
name: Generate TOC

on:
  push:
    branches: [main]

jobs:
  toc:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm install -g ya-repo-toc
    - run: ya-repo-toc -o README.md --prune-empty
    - run: |
        git config user.name "github-actions[bot]"
        git config user.email "github-actions[bot]@users.noreply.github.com"
        git add README.md
        git commit -m "Update TOC" || true
        git push
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Programmatic API

```javascript
const path = require('path');
const { generateTableOfContent, getTableOfContents } = require('ya-repo-toc');

// Generate TOC and write to file
generateTableOfContent({
  dirPath: path.join(__dirname, 'my-project'),
  filePath: path.join(__dirname, 'README.md'),
  pruneEmpty: true,
});

// Get TOC as a string
const toc = getTableOfContents({
  dirPath: __dirname,
  extensions: ['.md'],
  pruneEmpty: true,
});
```

#### `generateTableOfContent(options)`

Generates a Table of Contents and writes it to a file.

| Option | Type | Default | Description |
|---|---|---|---|
| `dirPath` | string | `process.cwd()` | Directory to scan |
| `extensions` | string[] | `[".md"]` | File extensions to include |
| `filePath` | string | `"./README.md"` | Output file path |
| `excludedDirs` | string[] | `[]` | Directories to exclude |
| `recurseGitignore` | boolean | `false` | Respect nested `.gitignore` files (non-git only) |
| `pruneEmpty` | boolean | `false` | Hide directories with no matching files |

#### `getTableOfContents(options)`

Same options as above, plus:

| Option | Type | Default | Description |
|---|---|---|---|
| `useGitTracking` | boolean | auto | Override git detection. `false` forces filesystem traversal. |

Returns: `string`

## Attribution

This project is a fork of [repo-toc](https://github.com/kmtusher97/repo-toc) by [@kmtusher97](https://github.com/kmtusher97), originally published under the ISC license. See [LICENSE](./LICENSE) for details.

## Contributing

Issues and pull requests welcome at [github.com/WGriffing/ya-repo-toc](https://github.com/WGriffing/ya-repo-toc).

## License

[ISC](./LICENSE)
