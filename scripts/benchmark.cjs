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
  toPattern: [
    [['12345678901', '999.999.999-99'], '123.456.789-01'],
    [['12345678000190', '99.999.999/9999-99'], '12.345.678/0001-90'],
    [['11912345678', '(99) 99999-9999'], '(11) 91234-5678'],
    [['ABC1D23', 'AAA9A99'], 'ABC1D23'],
  ],
};

const variants = ['vmask.txt', 'minify-vmask.txt', 'gpt-vmask.txt', builtFile].map(filename => {
  const source = fs.readFileSync(path.join(root, filename));
  const context = {};
  vm.runInNewContext(source.toString('utf8'), context, { filename });
  return {
    filename,
    api: context.VMasker,
    bytes: source.length,
    gzipBytes: gzipSync(source, { level: 9 }).length,
    medians: {},
  };
});

function exercise(format, cases, calls) {
  let totalLength = 0;
  for (let index = 0; index < calls; index++) {
    totalLength += format(...cases[index % cases.length][0]).length;
  }
  return totalLength;
}

for (const [method, cases] of Object.entries(workloads)) {
  const measurements = variants.map(() => []);
  for (const { api, filename } of variants) {
    for (const [args, expected] of cases) {
      assert.equal(api[method](...args), expected, `${filename}: ${method}`);
    }
    exercise(api[method], cases, callsPerRound);
  }

  const expectedLength = cases.reduce((sum, [, expected]) => sum + expected.length, 0)
    * callsPerRound / cases.length;
  for (let round = 0; round < rounds; round++) {
    for (let offset = 0; offset < variants.length; offset++) {
      const index = (round + offset) % variants.length;
      const format = variants[index].api[method];
      const start = performance.now();
      const totalLength = exercise(format, cases, callsPerRound);
      measurements[index].push(performance.now() - start);
      assert.equal(totalLength, expectedLength);
    }
  }

  measurements.forEach((times, index) => {
    times.sort((a, b) => a - b);
    variants[index].medians[`${method} (ms)`] = times[Math.floor(times.length / 2)].toFixed(3);
  });
}

console.log(`Node ${process.version} | ${process.platform} ${process.arch}`);
console.log(`Mediana de ${rounds} rodadas com ${callsPerRound} chamadas por função e arquivo.`);
console.table(variants.map(({ filename, bytes, gzipBytes, medians }) => ({
  arquivo: filename,
  bytes,
  'gzip (bytes)': gzipBytes,
  ...medians,
})));
console.log('Resultados restritos aos exemplos acima e ao ambiente local. Carregamento e eventos do DOM ficam fora da medição.');
