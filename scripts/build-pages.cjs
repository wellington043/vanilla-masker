'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output', 'pages');

// This directory is generated solely for deployment; never upload the checkout.
const relative = path.relative(root, output);
if (relative !== path.join('output', 'pages')) throw new Error('Unexpected Pages output path');
fs.rmSync(output, { recursive: true, force: true });
for (const filename of ['index.html', 'demo.js', 'dist/vmask.min.js', 'LICENSE']) {
  const destination = path.join(output, filename);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, filename), destination);
}
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log('Built demo in output/pages');
