'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const formatters = require('../src/formatters.js');

const { toMoney, toPattern, toNumber, toAlphaNumeric } = formatters;

test('toAlphaNumeric preserves ASCII letters, digits and spaces while removing every invalid character', () => {
  assert.equal(toAlphaNumeric(' !A_b  09-é\t漢\n🙂Z\u00a0 '), ' Ab  09Z ');
  assert.equal(toAlphaNumeric('é_\t-'), '');
});

test('toAlphaNumeric normalizes missing values and validates number and input types', () => {
  assert.equal(toAlphaNumeric(null), '');
  assert.equal(toAlphaNumeric(undefined), '');
  assert.equal(toAlphaNumeric(-12.34), '1234');
  assert.throws(() => toAlphaNumeric({}), TypeError);
  assert.throws(() => toAlphaNumeric(1e-7), RangeError);
});

test('pads short monetary values at high precision', () => {
  assert.equal(toMoney('123456', { precision: 8 }), '0,00123456');
  assert.equal(toMoney('12', { precision: 20 }), '0,00000000000000000012');
});

test('keeps distinct thousands groups with zeroCents and a decimal point', () => {
  const options = { separator: '.', delimiter: ',', zeroCents: true };
  assert.equal(toMoney('1234', options), '1,234.00');
  assert.equal(toMoney('1,234.00', options), '1,234.00');
  assert.equal(toMoney('1,003.00', options), '1,003.00');
  assert.equal(toMoney('1.001,00', { zeroCents: true }), '1.001,00');
});

test('omits the decimal separator before a suffix at zero precision', () => {
  assert.equal(toMoney('1234', { precision: 0, suffixUnit: '%' }), '1.234 %');
  assert.equal(toMoney('1234', { precision: 0, zeroCents: true }), '1.234');
});

test('formats ASCII CPF, CNPJ, phone and vehicle plate patterns', () => {
  assert.equal(toPattern('12345678909', '999.999.999-99'), '123.456.789-09');
  assert.equal(toPattern('12.345.678/0001-90', '99.999.999/9999-99'), '12.345.678/0001-90');
  assert.equal(toPattern('(11) 91234-5678', '(99) 99999-9999'), '(11) 91234-5678');
  assert.equal(toPattern('abc-1d23', 'AAA9A99'), 'abc1d23');
});

test('keeps legacy cent values, formatting defaults and ASCII minus', () => {
  assert.equal(toMoney(1234567890, { unit: 'R$ ' }), 'R$ 12.345.678,90');
  assert.equal(toMoney(12.34), '12,34');
  assert.equal(toMoney('-00123'), '1,23');
  assert.equal(toMoney('', { unit: 'R$' }), 'R$ 0,00');
  assert.equal(toNumber('-12ab-3.4'), '-1234');
  assert.equal(toNumber('x-001_2'), '0012');
});

test('canonicalizes leading zeros and accepts long digit strings exactly', () => {
  assert.equal(toMoney('00000123'), '1,23');
  assert.equal(toMoney('00000000'), '0,00');
  assert.equal(toMoney('9007199254740993123'), '90.071.992.547.409.931,23');
});

test('normalizes missing values per formatter', () => {
  assert.equal(toMoney(null), '0,00');
  assert.equal(toMoney(undefined, { precision: 0, unit: '$' }), '$ 0');
  assert.equal(toNumber(null), '');
  assert.equal(toNumber(undefined), '');
  assert.equal(toPattern(null, '99'), '');
  assert.equal(toPattern(undefined, { pattern: '(99)', placeholder: '_' }), '(__)');
});

test('preserves an initial negative sign only with showSignal for money', () => {
  const options = { unit: 'R$', suffixUnit: '%', showSignal: true };
  assert.equal(toMoney(-123, options), 'R$ -1,23 %');
  assert.equal(toMoney('R$ -1,23 %', options), 'R$ -1,23 %');
  assert.equal(toMoney('R$ 1-23 %', options), 'R$ 1,23 %');
});

test('leaves digits in formatted units outside the amount', () => {
  const options = { unit: ' XP2 ', suffixUnit: ' 4º ' };
  assert.equal(toMoney('123456', options), 'XP2 1.234,56 4º');
  assert.equal(toMoney('XP2 1.234,56 4º', options), 'XP2 1.234,56 4º');
});

test('treats custom separators literally and supports disabling groups', () => {
  assert.equal(toMoney('123456', { separator: '[', delimiter: '$&' }), '1$&234[56');
  assert.equal(toMoney('123456', { delimiter: '' }), '1234,56');
  assert.equal(toMoney('1|234[++00', {
    separator: '[++', delimiter: '|', zeroCents: true,
  }), '1|234[++00');
});

test('respects alphanumeric literals in raw and formatted patterns', () => {
  assert.equal(toPattern('1234', 'ID 99/99z'), 'ID 12/34z');
  assert.equal(toPattern('ID 12/34z', 'ID 99/99z'), 'ID 12/34z');
  assert.equal(toPattern('ID 12/3', 'ID 99/99z'), 'ID 12/3');
  assert.equal(toPattern('11', '+55 (99)'), '+55 (11)');
  assert.equal(toPattern('+55 (11)', '+55 (99)'), '+55 (11)');
});

test('advances a partially formatted pattern with alphanumeric literals', () => {
  const pattern = 'ID 99/99z';
  assert.equal(toPattern('ID 123', pattern), 'ID 12/3');
  assert.equal(toPattern('ID 12/', pattern), 'ID 12');
  assert.equal(toPattern('ID 12/34', pattern), 'ID 12/34z');
  assert.equal(toPattern('ID 1/34z', pattern), 'ID 13/4');
  assert.equal(toPattern('+55 (119', '+55 (99) 99999-9999'), '+55 (11) 9');
  assert.equal(toPattern('x', 'xSS'), 'xx');
});

test('treats a decorated prefix with no data as empty', () => {
  const pattern = '+55 (99)';
  assert.equal(toPattern('+55 (', pattern), '');
  assert.equal(toPattern('+55 (', { pattern, placeholder: '_' }), '+55 (__)');
  assert.equal(toPattern('+55 (__)', { pattern, placeholder: '_' }), '+55 (__)');
});

test('discards punctuation but stops at an incompatible ASCII pattern character', () => {
  assert.equal(toPattern('_1-2.3', '9999'), '123');
  assert.equal(toPattern('12X34', '99999'), '12');
  assert.equal(toPattern('ab1cd', 'AAAAA'), 'ab');
  assert.equal(toPattern('áA-２3', 'SSS'), 'A3');
  assert.equal(toPattern('12', '(99) 99999-9999'), '(12');
});

test('fills the unoccupied slots when given a placeholder', () => {
  const options = { pattern: '(99) 99-A', placeholder: '_' };
  assert.equal(toPattern('11_2', options), '(11) 2_-_');
  assert.equal(toPattern('(11) 2_-_', options), '(11) 2_-_');
  assert.equal(toPattern('11x3', options), '(11) __-_');
});

test('ignores an explicit letter placeholder in a partially filled digit pattern', () => {
  const options = { pattern: 'ID 99/99z', placeholder: 'x' };
  assert.equal(toPattern('ID 12/x3z', options), 'ID 12/3xz');
  assert.equal(toPattern('ID 12/3xz', options), 'ID 12/3xz');
});

test('rejects a placeholder that would count as data in any slot', () => {
  for (const options of [
    { pattern: '99-99', placeholder: '0' },
    { pattern: '99-A', placeholder: 'x' },
    { pattern: '99-S', placeholder: 'x' },
    { pattern: 'AA-S', placeholder: '0' },
  ]) {
    assert.throws(() => toPattern('1', options), { name: 'TypeError' });
  }
  assert.equal(toPattern('b', { pattern: 'AA', placeholder: '0' }), 'b0');
});

test('rejects input types that have no supported text representation', () => {
  const invalidValues = [true, {}, [], Symbol('123'), 123n, NaN, Infinity, -Infinity];
  for (const value of invalidValues) {
    assert.throws(() => toMoney(value), { name: 'TypeError' });
    assert.throws(() => toNumber(value), { name: 'TypeError' });
    assert.throws(() => toPattern(value, '999'), { name: 'TypeError' });
  }
});

test('rejects unsafe and exponential numbers instead of using altered digits', () => {
  for (const value of [Number.MAX_SAFE_INTEGER + 1, 1e21, 1e-7]) {
    assert.throws(() => toMoney(value), { name: 'RangeError' });
    assert.throws(() => toNumber(value), { name: 'RangeError' });
    assert.throws(() => toPattern(value, '999'), { name: 'RangeError' });
  }
  assert.equal(toNumber(Number.MAX_SAFE_INTEGER), '9007199254740991');
});

test('validates invalid options before formatting', () => {
  for (const options of [[], 12, { separator: 9 }, { delimiter: 9 },
    { separator: '' }, { unit: true }, { suffixUnit: [] },
    { zeroCents: 'yes' }, { showSignal: 1 }, { lastOutput: {} }]) {
    assert.throws(() => toMoney('123', options), { name: 'TypeError' });
  }
  for (const precision of [-1, 1.5, '2', 21, Infinity, NaN]) {
    assert.throws(() => toMoney('123', { precision }), { name: 'RangeError' });
  }
  for (const options of [undefined, null, { pattern: 99 }, { pattern: '99', placeholder: 9 }]) {
    assert.throws(() => toPattern('123', options), { name: 'TypeError' });
  }
});

test('does not alter or share caller money options across calls', () => {
  const rawOptions = Object.freeze({ unit: 'R$ ', zeroCents: true });
  assert.equal(toMoney('123', rawOptions), 'R$ 123,00');
  assert.equal(toMoney('1', rawOptions), 'R$ 1,00');
  assert.equal(rawOptions.unit, 'R$ ');
  assert.equal(rawOptions.lastOutput, undefined);
});

test('zeroCents uses the last output only to account for deleting synthetic cents', () => {
  const lastOutput = 'XP2 1,234.00 4º';
  const options = Object.freeze({
    unit: 'XP2', suffixUnit: '4º', separator: '.', delimiter: ',', zeroCents: true, lastOutput,
  });
  assert.equal(toMoney('XP2 1,234.0 4º', options), 'XP2 123.00 4º');
  assert.equal(toMoney('XP2 1,23.00 4º', options), 'XP2 123.00 4º');
  assert.equal(toMoney('XP2 1,24.0 4º', options), 'XP2 124.00 4º');
  assert.equal(toMoney(lastOutput, options), lastOutput);
});

test('uses prepared money options with no writes to the supplied object', () => {
  const options = { unit: 'XP2', suffixUnit: '4º', zeroCents: true };
  const prepared = Object.freeze({
    ...formatters.prepareMoneyOptions(options), lastOutput: 'XP2 12,00 4º',
  });
  options.unit = 'new';

  assert.equal(formatters.formatMoney('XP2 12,0 4º', prepared), 'XP2 1,00 4º');
  assert.equal(formatters.formatMoney('146', prepared), 'XP2 146,00 4º');
  assert.equal(prepared.lastOutput, 'XP2 12,00 4º');
});

test('normalizes strings, ordinary numbers and empty inputs for consumers', () => {
  assert.equal(formatters.normalizeValue(' 0123 '), ' 0123 ');
  assert.equal(formatters.normalizeValue(-12.3), '-12.3');
  assert.equal(formatters.normalizeValue(null), '');
  assert.equal(formatters.normalizeValue(undefined), '');
});
