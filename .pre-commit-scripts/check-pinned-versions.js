#!/usr/bin/env node
const fs = require('fs');
const files = process.argv.slice(2);
let exitCode = 0;

files.forEach((file) => {
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  ['dependencies', 'devDependencies'].forEach((depType) => {
    if (!pkg[depType]) return;
    Object.entries(pkg[depType]).forEach(([name, version]) => {
      if (version.startsWith('^') || version.startsWith('~')) {
        console.error(
          `${file} > ${depType} > ${name}: ${version} is not pinned`
        );
        exitCode = 1;
      }
    });
  });
});

if (exitCode) {
  console.error('\nAll versions must be exact (no ^ or ~).');
  process.exit(1);
}
