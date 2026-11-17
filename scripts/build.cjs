'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { gzipSync } = require('node:zlib');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const { version } = require('../package.json');
const banner = `/*! VMasker Refined ${version} | Derived from VanillaMasker | MIT license: see LICENSE */`;

const common = {
  absWorkingDir: root,
  entryPoints: ['src/index.js'],
  bundle: true,
  target: ['es2018'],
  platform: 'neutral',
  legalComments: 'none',
  write: false,
};

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
for (const minify of [false, true]) {
  const result = esbuild.buildSync({ ...common, format: 'cjs', minify });
  const body = result.outputFiles[0].text;
  const wrapped = `${banner}\n(function(root, factory) {\n  if (typeof define === 'function' && define.amd) define(factory);\n  else if (typeof module === 'object' && module.exports) module.exports = factory();\n  else root.VMasker = factory();\n})(typeof globalThis !== 'undefined' ? globalThis : this, function() {\n  var module = { exports: {} };\n${body}\n  return module.exports;\n});\n`;
  const output = minify ? esbuild.transformSync(wrapped, { minify: true, target: 'es2018', legalComments: 'inline' }).code : wrapped;
  fs.writeFileSync(path.join(root, 'dist', minify ? 'vmask.min.js' : 'vmask.js'), output);
}
for (const [format, filename] of [['cjs', 'vmask.cjs'], ['esm', 'vmask.mjs']]) {
  const result = esbuild.buildSync({ ...common, format, banner: { js: banner } });
  fs.writeFileSync(path.join(root, 'dist', filename), result.outputFiles[0].contents);
}
fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.copyFileSync(path.join(root, 'dist', 'vmask.js'), path.join(root, 'lib', 'vanilla-masker.js'));
const minified = fs.readFileSync(path.join(root, 'dist', 'vmask.min.js'));
fs.writeFileSync(path.join(root, 'build', 'vanilla-masker.min.js'), minified);
fs.writeFileSync(path.join(root, 'build', 'vanilla-masker.min.js.gz'), gzipSync(minified, { level: 9 }));
console.log(`Built VMasker Refined ${version}: UMD, minified UMD, CommonJS, ESM and legacy distribution paths.`);
