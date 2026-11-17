'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { gunzipSync } = require('node:zlib');
const { pathToFileURL } = require('node:url');

function checkAPI(VMasker) {
  assert.equal(typeof VMasker, 'function');
  assert.equal(VMasker.toPattern('12345678901', '999.999.999-99'), '123.456.789-01');
  assert.equal(VMasker.toMoney('123456', { precision: 8 }), '0,00123456');
  assert.equal(VMasker.toMoney('1234', { precision: 0, suffixUnit: '%' }), '1.234 %');
  assert.equal(VMasker.toNumber('-12x3'), '-123');
  assert.equal(VMasker.toAlphaNumeric('A-1 B_2!'), 'A1 B2');
}

for (const filename of ['vmask.js', 'vmask.min.js']) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'dist', filename), 'utf8');
  test(`${filename}: global script API`, () => {
    const context = {};
    vm.runInNewContext(code, context);
    checkAPI(context.VMasker);
  });
  test(`${filename}: AMD factory API`, () => {
    let exported;
    function define(factory) { exported = factory(); }
    define.amd = {};
    vm.runInNewContext(code, { define });
    checkAPI(exported);
  });
  test(`${filename}: CommonJS API`, () => {
    checkAPI(require(path.join('..', 'dist', filename)));
  });
}
test('CommonJS entry loads without a browser', () => checkAPI(require('..')));
test('ESM default entry loads without a browser', async () => {
  const module = await import(pathToFileURL(path.join(__dirname, '..', 'dist', 'vmask.mjs')).href);
  checkAPI(module.default);
});

for (const filename of ['lib/vanilla-masker.js', 'build/vanilla-masker.min.js']) {
  test(`upstream distribution path ${filename} exposes the new API`, () => {
    const filepath = path.join(__dirname, '..', filename);
    checkAPI(require(filepath));
    const context = {};
    vm.runInNewContext(fs.readFileSync(filepath, 'utf8'), context);
    checkAPI(context.VMasker);
  });
}
test('upstream gzip artifact contains the exact current minified build', () => {
  const built = name => fs.readFileSync(path.join(__dirname, '..', name));
  const compressed = built('build/vanilla-masker.min.js.gz');
  assert.equal(compressed[9], 255, 'gzip metadata must not depend on the build operating system');
  assert.deepEqual(gunzipSync(compressed), built('dist/vmask.min.js'));
});
