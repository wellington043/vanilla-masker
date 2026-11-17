'use strict';

const { toMoney, toPattern, toNumber, toAlphaNumeric, prepareMoneyOptions, formatMoney } = require('./formatters');
const bindings = new WeakMap();
const textTypes = new Set(['text', 'search', 'tel', 'url', 'password']);

function getElements(target) {
  if (!target) throw new TypeError('VMasker: there is no element to bind.');
  const elements = target.nodeType ? [target] : Array.from(target);
  if (!target.nodeType && typeof target.length !== 'number') {
    throw new TypeError('VMasker: expected an input, textarea or collection.');
  }
  for (const element of elements) {
    if (!element || typeof element.addEventListener !== 'function' ||
        !(element.nodeName === 'TEXTAREA' || (element.nodeName === 'INPUT' && textTypes.has(element.type)))) {
      throw new TypeError('VMasker: use text inputs or textareas (not input type="number").');
    }
  }
  return [...new Set(elements)];
}

function patternText(options) {
  return typeof options === 'string' ? options : options.pattern;
}

function moneyBounds(value, options) {
  const start = options.unit && value.startsWith(options.unit) ? options.unit.length : 0;
  let end = options.suffixUnit && value.endsWith(options.suffixUnit) ? value.length - options.suffixUnit.length : value.length;
  if (options.zeroCents && options.precision > 0) {
    const index = value.lastIndexOf(options.separator, end - 1);
    if (index >= start) end = index;
  }
  return { start, end };
}

function moneyText(value, options) {
  let text = value;
  if (options.unit && text.startsWith(options.unit)) text = text.slice(options.unit.length);
  if (options.suffixUnit && text.endsWith(options.suffixUnit)) text = text.slice(0, -options.suffixUnit.length);
  return text;
}

function isEditable(value, index, state) {
  if (index < 0 || index >= value.length) return false;
  if (state.method === 'toPattern') {
    const token = patternText(state.options)[index];
    return token === '9' ? /[0-9]/.test(value[index]) :
      token === 'A' ? /[a-zA-Z]/.test(value[index]) : token === 'S' && /[0-9a-zA-Z]/.test(value[index]);
  }
  if (state.method === 'toMoney') {
    const { start, end } = moneyBounds(value, state.options);
    return index >= start && index < end && (/[0-9]/.test(value[index]) || (state.options.showSignal && value[index] === '-'));
  }
  if (state.method === 'toAlphaNumeric') return toAlphaNumeric(value[index]) !== '';
  return /[0-9-]/.test(value[index]);
}

function caretPosition(raw, formatted, position, state) {
  if (position === null || !formatted) return formatted.length;
  if (state.method === 'toPattern') {
    // Ignore placeholder output when translating a partial value to a caret.
    return Math.min(toPattern(raw.slice(0, position), patternText(state.options)).length, formatted.length);
  }
  if (state.method === 'toNumber') return toNumber(raw.slice(0, position)).length;
  if (state.method === 'toAlphaNumeric') return toAlphaNumeric(raw.slice(0, position)).length;
  const rawBounds = moneyBounds(raw, state.options);
  const bounds = moneyBounds(formatted, state.options);
  const rightDigits = raw.slice(Math.max(position, rawBounds.start), rawBounds.end).replace(/\D/g, '').length;
  let remaining = rightDigits;
  for (let index = bounds.end; index > bounds.start; index--) {
    if (remaining === 0) return index;
    if (/[0-9]/.test(formatted[index - 1])) remaining--;
  }
  return bounds.start;
}

function applyMask(element, state, event) {
  if (state.composing || bindings.get(element) !== state) return;
  let raw = element.value;
  let start = element.selectionStart;
  let end = element.selectionEnd;
  if (state.pendingEdit) {
    const edit = state.pendingEdit;
    state.pendingEdit = null;
    const prefix = edit.value.slice(0, edit.from);
    const suffix = edit.value.slice(edit.to);
    // Non-cancelable IME edits cannot be redirected in beforeinput. Recover only
    // the inserted text, keeping the original currency decorations out of the amount.
    if (raw.startsWith(prefix) && raw.endsWith(suffix) && raw.length >= prefix.length + suffix.length) {
      const inserted = raw.slice(prefix.length, raw.length - suffix.length);
      raw = edit.value.slice(0, edit.start) + inserted + edit.value.slice(edit.end);
      start = end = edit.start + inserted.length;
    }
  }
  const direction = element.selectionDirection || 'none';
  let formatted;
  const money = state.method === 'toMoney' ? moneyText(raw, state.options) : '';
  const deletingLastDigit = state.method === 'toMoney' && event && /^delete/.test(event.inputType) && !/[1-9]/.test(money);
  if (!raw || deletingLastDigit) {
    formatted = '';
  } else if (state.method === 'toMoney' && !/\d/.test(money)) {
    // Keep an intermediate minus so negative amounts can be entered from an empty field.
    formatted = state.options.showSignal && money.startsWith('-') ? state.options.unit + '-' : '';
  } else if (state.method === 'toMoney') {
    formatted = formatMoney(raw, state.options);
  } else if (state.method === 'toPattern') {
    formatted = toPattern(raw, state.options);
  } else if (state.method === 'toAlphaNumeric') {
    formatted = toAlphaNumeric(raw);
  } else {
    formatted = toNumber(raw);
  }
  const nextStart = caretPosition(raw, formatted, start, state);
  const nextEnd = caretPosition(raw, formatted, end, state);
  if (element.value !== formatted) element.value = formatted;
  element.lastOutput = formatted;
  if (start !== null && typeof element.setSelectionRange === 'function') {
    element.setSelectionRange(nextStart, nextEnd, direction);
  }
}

function replaceAndNotify(element, state, event, start, end, text) {
  event.preventDefault();
  element.setRangeText(text, start, end, 'end');
  applyMask(element, state, event);
  const EventClass = element.ownerDocument.defaultView.InputEvent;
  element.dispatchEvent(new EventClass('input', { bubbles: true, inputType: event.inputType, data: text || null }));
}

function beforeInput(element, state, event) {
  if (state.composing || event.isComposing || !event.cancelable) {
    if (state.method === 'toMoney' && element.value && element.selectionStart !== null && !state.pendingEdit) {
      const bounds = moneyBounds(element.value, state.options);
      const from = element.selectionStart, to = element.selectionEnd;
      const clamp = position => Math.max(bounds.start, Math.min(position, bounds.end));
      if (from < bounds.start || to > bounds.end) {
        const whole = from !== to && from <= bounds.start && to >= bounds.end;
        state.pendingEdit = { value: element.value, from, to, start: whole ? 0 : clamp(from), end: whole ? element.value.length : clamp(to) };
      }
    }
    return;
  }
  if (state.method === 'toPattern' && /^delete/.test(event.inputType) && element.selectionStart !== element.selectionEnd) {
    const value = element.value;
    let payload = '', from = 0, to = 0;
    for (let index = 0; index < value.length; index++) {
      if (!isEditable(value, index, state)) continue;
      if (index < element.selectionStart) from++;
      if (index < element.selectionEnd) to++;
      payload += value[index];
    }
    event.preventDefault();
    if (from === to) return; // Selecting decoration alone must never delete a value digit.
    element.value = payload.slice(0, from) + payload.slice(to);
    element.setSelectionRange(from, from);
    applyMask(element, state, event);
    const EventClass = element.ownerDocument.defaultView.InputEvent;
    element.dispatchEvent(new EventClass('input', { bubbles: true, inputType: event.inputType }));
    return;
  }
  if (state.method === 'toMoney' && element.value && element.selectionStart !== null) {
    const bounds = moneyBounds(element.value, state.options);
    const from = element.selectionStart;
    const to = element.selectionEnd;
    // Units and generated zero cents are decoration, never editable amount digits.
    // Replacing the whole amount also replaces its decorations, allowing a formatted paste.
    if (from !== to && from <= bounds.start && to >= bounds.end) {
      element.setSelectionRange(0, element.value.length);
    } else {
      const clamp = position => Math.max(bounds.start, Math.min(position, bounds.end));
      element.setSelectionRange(clamp(from), clamp(to), element.selectionDirection);
    }
    const nextStart = element.selectionStart;
    const nextEnd = element.selectionEnd;
    if (from !== to && nextStart === nextEnd && /^delete/.test(event.inputType)) {
      event.preventDefault();
      return;
    }
    if (from !== nextStart || to !== nextEnd) {
      if (/^insert/.test(event.inputType)) {
        const text = typeof event.data === 'string' ? event.data : event.dataTransfer?.getData('text/plain');
        if (typeof text === 'string') {
          // Firefox/WebKit retain the pre-beforeinput target range for native edits.
          replaceAndNotify(element, state, event, nextStart, nextEnd, text);
          return;
        }
      } else if (/^delete/.test(event.inputType) && nextStart !== nextEnd) {
        replaceAndNotify(element, state, event, nextStart, nextEnd, '');
        return;
      }
    }
  }
  const backwards = event.inputType === 'deleteContentBackward';
  if (!backwards && event.inputType !== 'deleteContentForward') return;
  const start = element.selectionStart;
  if (start === null || start !== element.selectionEnd) return;
  const raw = element.value;
  let index = backwards ? start - 1 : start;
  if (isEditable(raw, index, state)) return;
  while (index >= 0 && index < raw.length && !isEditable(raw, index, state)) index += backwards ? -1 : 1;
  event.preventDefault();
  if (index < 0 || index >= raw.length) return;
  element.value = raw.slice(0, index) + raw.slice(index + 1);
  const caret = backwards ? index : start;
  element.setSelectionRange(caret, caret);
  applyMask(element, state, event);
  // The prevented native edit would have emitted input. Preserve that observable event.
  const EventClass = element.ownerDocument.defaultView.InputEvent;
  element.dispatchEvent(new EventClass('input', { bubbles: true, inputType: event.inputType }));
}

function removeBinding(element) {
  const state = bindings.get(element);
  if (!state) return;
  for (const [event, listener] of Object.entries(state.listeners)) element.removeEventListener(event, listener);
  bindings.delete(element);
  return state;
}

function unmaskedValue(value, state) {
  if (state.method === 'toPattern') {
    // DOM selection offsets and pattern indexing both use UTF-16 code units.
    return value.split('').filter((_, index) => isEditable(value, index, state)).join('');
  }
  if (state.method === 'toAlphaNumeric') return toAlphaNumeric(value);
  return toNumber(state.method === 'toMoney' ? moneyText(value, state.options) : value);
}

function valueForNewMask(element, previous, method, options) {
  if (previous.method !== 'toMoney' || method !== 'toMoney' || element.value !== element.lastOutput || !element.value) {
    return unmaskedValue(element.value, previous);
  }
  const text = moneyText(element.value, previous.options);
  const sign = text.startsWith('-') ? '-' : '';
  let digits = text.replace(/\D/g, '');
  const targetPrecision = options.zeroCents ? 0 : options.precision;
  const change = targetPrecision - previous.options.precision;
  digits = change >= 0 ? digits + '0'.repeat(change) : digits.slice(0, change);
  return sign + (digits || '0');
}

function prepareOptions(method, options) {
  if (method === 'toMoney') {
    const prepared = prepareMoneyOptions(options);
    // beforeinput handles deletions directly, so the legacy lastOutput heuristic must not run twice.
    prepared.lastOutput = undefined;
    return prepared;
  }
  if (method === 'toPattern') {
    const prepared = typeof options === 'string' ? { pattern: options } : { ...options };
    toPattern('', prepared); // Validate before installing or removing any listener.
    return prepared;
  }
  if (method !== 'toNumber' && method !== 'toAlphaNumeric') throw new TypeError('VMasker: unknown mask method.');
  return {};
}

class Mask {
  constructor(elements) { this.elements = elements; this.opts = {}; }

  bindElementToMask(method) {
    const prepared = prepareOptions(method, this.opts);
    for (const element of this.elements) {
      const previous = bindings.get(element);
      const nextValue = previous ? valueForNewMask(element, previous, method, prepared) : element.value;
      removeBinding(element);
      if (element.value !== nextValue) element.value = nextValue;
      const state = { method, options: { ...prepared }, composing: false, listeners: {} };
      state.listeners.input = event => { if (!event.isComposing) applyMask(element, state, event); };
      state.listeners.change = () => applyMask(element, state);
      state.listeners.beforeinput = event => beforeInput(element, state, event);
      state.listeners.compositionstart = () => { state.composing = true; };
      state.listeners.compositionend = () => { state.composing = false; applyMask(element, state); };
      bindings.set(element, state);
      for (const [event, listener] of Object.entries(state.listeners)) element.addEventListener(event, listener);
      applyMask(element, state);
    }
    return this;
  }

  maskMoney(options) { this.opts = options || {}; return this.bindElementToMask('toMoney'); }
  maskNumber() { this.opts = {}; return this.bindElementToMask('toNumber'); }
  maskAlphaNum() { this.opts = {}; return this.bindElementToMask('toAlphaNumeric'); }
  maskPattern(options) { this.opts = options; return this.bindElementToMask('toPattern'); }

  unbindElementToMask() {
    for (const element of this.elements) {
      const state = removeBinding(element);
      if (!state) continue;
      element.value = unmaskedValue(element.value, state);
      element.lastOutput = '';
    }
    return this;
  }

  unMask() { return this.unbindElementToMask(); }
}

function VMasker(target) { return new Mask(getElements(target)); }
VMasker.toMoney = toMoney;
VMasker.toNumber = toNumber;
VMasker.toAlphaNumeric = toAlphaNumeric;
VMasker.toPattern = toPattern;
module.exports = VMasker;
