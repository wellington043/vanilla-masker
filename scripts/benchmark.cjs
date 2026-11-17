'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const vm = require('node:vm');
const { gzipSync } = require('node:zlib');

const root = path.resolve(__dirname, '..');
const rounds = 9;
const callsPerRound = 40_000;
const builtFile = 'dist/vmask.min.js';

if (!fs.existsSync(path.join(root, builtFile))) {
  console.error('Execute npm run build antes do benchmark.');
  process.exit(1);
}

const workloads = {
  toMoney: [
    [['123456', { unit: 'R$' }], 'R$ 1.234,56'],
    [['1234567890', { separator: '.', delimiter: ',' }], '12,345,678.90'],
    [['1234', { suffixUnit: '%' }], '12,34 %'],
    [['321', { precision: 2 }], '3,21'],
  ],
  toNumber: [
    [['abc123.45'], '12345'],
    [['12-34x56'], '123456'],
    [['0-123-456-7890'], '01234567890'],
    [['0001'], '0001'],
  ],
  toAlphaNumeric: [
    [['AB-123'], 'AB123'],
    [['A_b  09-é\tZ'], 'Ab  09Z'],
    [['abc 123'], 'abc 123'],
    [['!@#'], ''],
  ],
  toPattern: [
    [['12345678901', '999.999.999-99'], '123.456.789-01'],
    [['12345678000190', '99.999.999/9999-99'], '12.345.678/0001-90'],
    [['11912345678', '(99) 99999-9999'], '(11) 91234-5678'],
    [['ABC1D23', 'AAA9A99'], 'ABC1D23'],
  ],
};

const source = fs.readFileSync(path.join(root, builtFile));
const context = {};
vm.runInNewContext(source.toString('utf8'), context, { filename: builtFile });
const api = context.VMasker;
const medians = {};

function exercise(format, cases, calls) {
  let totalLength = 0;
  for (let index = 0; index < calls; index++) {
    totalLength += format(...cases[index % cases.length][0]).length;
  }
  return totalLength;
}

for (const [method, cases] of Object.entries(workloads)) {
  const format = api[method];
  for (const [args, expected] of cases) {
    assert.equal(format(...args), expected, `${builtFile}: ${method}`);
  }
  exercise(format, cases, callsPerRound);

  const expectedLength = cases.reduce((sum, [, expected]) => sum + expected.length, 0)
    * callsPerRound / cases.length;
  const measurements = [];
  for (let round = 0; round < rounds; round++) {
    const start = performance.now();
    const totalLength = exercise(format, cases, callsPerRound);
    measurements.push(performance.now() - start);
    assert.equal(totalLength, expectedLength);
  }

  measurements.sort((a, b) => a - b);
  medians[`${method} (ms)`] = measurements[Math.floor(measurements.length / 2)].toFixed(3);
}

console.log(`Node ${process.version} | ${process.platform} ${process.arch}`);
console.log(`Mediana de ${rounds} rodadas com ${callsPerRound} chamadas por função.`);
console.table([{
  arquivo: builtFile,
  bytes: source.length,
  'gzip (bytes)': gzipSync(source, { level: 9 }).length,
  ...medians,
}]);
console.log('Resultados restritos aos exemplos acima e ao ambiente local. Carregamento e eventos do DOM ficam fora da medição.');
