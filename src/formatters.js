'use strict';

const NON_DIGITS = /\D/g;
const ALPHANUMERIC = /[A-Za-z0-9]/;
const PATTERN_SLOTS = {
  9: /[0-9]/,
  A: /[A-Za-z]/,
  S: /[A-Za-z0-9]/,
};

function normalizeValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('VanillaMasker: value must be a string or finite number.');
  }

  const text = String(value);
  if (Math.abs(value) > Number.MAX_SAFE_INTEGER || /e/i.test(text)) {
    throw new RangeError('VanillaMasker: use a string for unsafe or exponential numbers.');
  }
  return text;
}

function prepareMoneyOptions(options) {
  if (options != null && (typeof options !== 'object' || Array.isArray(options))) {
    throw new TypeError('VanillaMasker: money options must be an object.');
  }

  const {
    precision = 2,
    separator = ',',
    delimiter = '.',
    unit = '',
    suffixUnit = '',
    zeroCents = false,
    showSignal = false,
    lastOutput = '',
  } = options ?? {};

  if (!Number.isInteger(precision) || precision < 0 || precision > 20) {
    throw new RangeError('VanillaMasker: precision must be an integer from 0 to 20.');
  }
  if (typeof separator !== 'string' || separator === '' || /[0-9]/.test(separator)
    || typeof delimiter !== 'string' || /[0-9]/.test(delimiter)) {
    throw new TypeError('VanillaMasker: separator and delimiter must be strings without digits, with a nonempty separator.');
  }
  if (typeof unit !== 'string' || typeof suffixUnit !== 'string' || typeof lastOutput !== 'string') {
    throw new TypeError('VanillaMasker: units and lastOutput must be strings.');
  }
  if (typeof zeroCents !== 'boolean' || typeof showSignal !== 'boolean') {
    throw new TypeError('VanillaMasker: zeroCents and showSignal must be booleans.');
  }

  const prefix = unit.replace(/\s/g, '');
  const suffix = suffixUnit.replace(/\s/g, '');
  return {
    precision,
    separator,
    delimiter,
    unit: prefix ? `${prefix} ` : '',
    suffixUnit: suffix ? ` ${suffix}` : '',
    zeroCents,
    showSignal,
    lastOutput,
    decimalZeros: '0'.repeat(precision),
  };
}

function readMoney(text, { unit, suffixUnit }) {
  if (suffixUnit && text.endsWith(suffixUnit)) {
    text = text.slice(0, -suffixUnit.length);
  }

  // Accept the rendered sign after the unit and a pasted sign before it.
  let negative = false;
  if (unit && text.startsWith(unit)) {
    text = text.slice(unit.length);
  } else if (unit && text.startsWith(`-${unit}`)) {
    text = text.slice(unit.length + 1);
    negative = true;
  }
  if (text.startsWith('-')) {
    text = text.slice(1);
    negative = true;
  }
  return { text, negative };
}

function readZeroCents(text, { separator, decimalZeros }) {
  const position = text.lastIndexOf(separator);
  if (position !== -1) {
    const fraction = text.slice(position + separator.length);
    if (decimalZeros.startsWith(fraction)) {
      return { digits: text.slice(0, position).replace(NON_DIGITS, ''), fraction };
    }
  }
  return { digits: text.replace(NON_DIGITS, ''), fraction: null };
}

function groupInteger(digits, delimiter) {
  const whole = digits.replace(/^0+/, '') || '0';
  if (!delimiter || whole.length <= 3) return whole;

  const firstGroupEnd = whole.length % 3 || 3;
  let grouped = whole.slice(0, firstGroupEnd);
  for (let index = firstGroupEnd; index < whole.length; index += 3) {
    grouped += delimiter + whole.slice(index, index + 3);
  }
  return grouped;
}

function formatMoney(value, options) {
  const { precision, separator, delimiter, unit, suffixUnit, zeroCents, showSignal, lastOutput } = options;
  const { text, negative } = readMoney(normalizeValue(value), options);
  let whole;
  let fraction = '';

  if (precision === 0) {
    whole = text.replace(NON_DIGITS, '');
  } else if (zeroCents) {
    const current = readZeroCents(text, options);
    whole = current.digits;
    if (lastOutput && current.fraction !== null && current.fraction.length < precision) {
      const previous = readZeroCents(readMoney(lastOutput, options).text, options);
      // A deletion from the synthetic decimals represents one whole digit only
      // when the integer portion has not already been edited.
      if (previous.fraction === options.decimalZeros && previous.digits === whole) {
        whole = whole.slice(0, -1);
      }
    }
    fraction = separator + options.decimalZeros;
  } else {
    const digits = text.replace(NON_DIGITS, '');
    whole = digits.slice(0, -precision);
    fraction = separator + digits.slice(-precision).padStart(precision, '0');
  }

  const sign = showSignal && negative ? '-' : '';
  return unit + sign + groupInteger(whole, delimiter) + fraction + suffixUnit;
}

function toMoney(value, options) {
  return formatMoney(value, prepareMoneyOptions(options));
}

function toNumber(value) {
  const text = normalizeValue(value);
  const sign = text.startsWith('-') ? '-' : '';
  return sign + text.replace(NON_DIGITS, '');
}

function toAlphaNumeric(value) {
  return normalizeValue(value).replace(/[^A-Za-z0-9 ]/g, '');
}

function renderPattern(text, pattern, placeholder, readLiterals) {
  let position = 0;
  let output = '';
  let lastSlotEnd = 0;
  let consumedLiteralData = false;

  for (let index = 0; index < pattern.length; index++) {
    const slot = PATTERN_SLOTS[pattern[index]];
    if (!slot) {
      const start = index;
      while (index + 1 < pattern.length && !PATTERN_SLOTS[pattern[index + 1]]) index++;
      const literal = pattern.slice(start, index + 1);
      if (readLiterals && text.startsWith(literal, position)) {
        position += literal.length;
        consumedLiteralData ||= ALPHANUMERIC.test(literal);
      }
      output += literal;
      continue;
    }

    while (position < text.length && !slot.test(text[position])) {
      if (placeholder && text.startsWith(placeholder, position)) {
        position += placeholder.length;
      } else if (!ALPHANUMERIC.test(text[position])) {
        position++;
      } else {
        break;
      }
    }

    if (position < text.length && slot.test(text[position])) {
      output += text[position++];
      lastSlotEnd = output.length;
    } else if (placeholder) {
      output += placeholder;
      position = text.length;
    } else {
      output = output.slice(0, lastSlotEnd);
      break;
    }
  }

  // An undecorated raw entry can equal the literal prefix. Keep it when
  // consuming that prefix left no data matching the mask.
  if (consumedLiteralData && lastSlotEnd === 0 && !/[^A-Za-z0-9]/.test(text)) {
    return renderPattern(text, pattern, placeholder, false);
  }
  return output;
}

function toPattern(value, patternOrOptions) {
  const options = typeof patternOrOptions === 'string' ? { pattern: patternOrOptions } : patternOrOptions;
  if (options == null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('VanillaMasker: specify a pattern string or a pattern options object.');
  }
  const { pattern, placeholder = '' } = options;
  if (typeof pattern !== 'string' || typeof placeholder !== 'string' || [...placeholder].length > 1) {
    throw new TypeError('VanillaMasker: pattern must be a string and placeholder must be one character or empty.');
  }
  if (ALPHANUMERIC.test(placeholder) && [...pattern].some(character => PATTERN_SLOTS[character]?.test(placeholder))) {
    throw new TypeError('VanillaMasker: placeholder must not match any editable slot in the pattern.');
  }

  return renderPattern(normalizeValue(value), pattern, placeholder, true);
}

module.exports = { toMoney, prepareMoneyOptions, formatMoney, toPattern, toNumber, toAlphaNumeric, normalizeValue };
