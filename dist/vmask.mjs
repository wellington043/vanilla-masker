/*! VMasker Refined 2.0.0 | Derived from VanillaMasker | MIT license: see LICENSE */
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// src/formatters.js
var require_formatters = __commonJS({
  "src/formatters.js"(exports, module) {
    "use strict";
    var NON_DIGITS = /\D/g;
    var ALPHANUMERIC = /[A-Za-z0-9]/;
    var PATTERN_SLOTS = {
      9: /[0-9]/,
      A: /[A-Za-z]/,
      S: /[A-Za-z0-9]/
    };
    function normalizeValue(value) {
      if (value == null) return "";
      if (typeof value === "string") return value;
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new TypeError("VanillaMasker: value must be a string or finite number.");
      }
      const text = String(value);
      if (Math.abs(value) > Number.MAX_SAFE_INTEGER || /e/i.test(text)) {
        throw new RangeError("VanillaMasker: use a string for unsafe or exponential numbers.");
      }
      return text;
    }
    function prepareMoneyOptions(options) {
      if (options != null && (typeof options !== "object" || Array.isArray(options))) {
        throw new TypeError("VanillaMasker: money options must be an object.");
      }
      const {
        precision = 2,
        separator = ",",
        delimiter = ".",
        unit = "",
        suffixUnit = "",
        zeroCents = false,
        showSignal = false,
        lastOutput = ""
      } = options != null ? options : {};
      if (!Number.isInteger(precision) || precision < 0 || precision > 20) {
        throw new RangeError("VanillaMasker: precision must be an integer from 0 to 20.");
      }
      if (typeof separator !== "string" || separator === "" || /[0-9]/.test(separator) || typeof delimiter !== "string" || /[0-9]/.test(delimiter)) {
        throw new TypeError("VanillaMasker: separator and delimiter must be strings without digits, with a nonempty separator.");
      }
      if (typeof unit !== "string" || typeof suffixUnit !== "string" || typeof lastOutput !== "string") {
        throw new TypeError("VanillaMasker: units and lastOutput must be strings.");
      }
      if (typeof zeroCents !== "boolean" || typeof showSignal !== "boolean") {
        throw new TypeError("VanillaMasker: zeroCents and showSignal must be booleans.");
      }
      const prefix = unit.replace(/\s/g, "");
      const suffix = suffixUnit.replace(/\s/g, "");
      return {
        precision,
        separator,
        delimiter,
        unit: prefix ? `${prefix} ` : "",
        suffixUnit: suffix ? ` ${suffix}` : "",
        zeroCents,
        showSignal,
        lastOutput,
        decimalZeros: "0".repeat(precision)
      };
    }
    function readMoney(text, { unit, suffixUnit }) {
      if (suffixUnit && text.endsWith(suffixUnit)) {
        text = text.slice(0, -suffixUnit.length);
      }
      let negative = false;
      if (unit && text.startsWith(unit)) {
        text = text.slice(unit.length);
      } else if (unit && text.startsWith(`-${unit}`)) {
        text = text.slice(unit.length + 1);
        negative = true;
      }
      if (text.startsWith("-")) {
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
          return { digits: text.slice(0, position).replace(NON_DIGITS, ""), fraction };
        }
      }
      return { digits: text.replace(NON_DIGITS, ""), fraction: null };
    }
    function groupInteger(digits, delimiter) {
      const whole = digits.replace(/^0+/, "") || "0";
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
      let fraction = "";
      if (precision === 0) {
        whole = text.replace(NON_DIGITS, "");
      } else if (zeroCents) {
        const current = readZeroCents(text, options);
        whole = current.digits;
        if (lastOutput && current.fraction !== null && current.fraction.length < precision) {
          const previous = readZeroCents(readMoney(lastOutput, options).text, options);
          if (previous.fraction === options.decimalZeros && previous.digits === whole) {
            whole = whole.slice(0, -1);
          }
        }
        fraction = separator + options.decimalZeros;
      } else {
        const digits = text.replace(NON_DIGITS, "");
        whole = digits.slice(0, -precision);
        fraction = separator + digits.slice(-precision).padStart(precision, "0");
      }
      const sign = showSignal && negative ? "-" : "";
      return unit + sign + groupInteger(whole, delimiter) + fraction + suffixUnit;
    }
    function toMoney(value, options) {
      return formatMoney(value, prepareMoneyOptions(options));
    }
    function toNumber(value) {
      const text = normalizeValue(value);
      const sign = text.startsWith("-") ? "-" : "";
      return sign + text.replace(NON_DIGITS, "");
    }
    function toAlphaNumeric(value) {
      return normalizeValue(value).replace(/[^A-Za-z0-9 ]/g, "");
    }
    function renderPattern(text, pattern, placeholder, readLiterals) {
      let position = 0;
      let output = "";
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
            consumedLiteralData || (consumedLiteralData = ALPHANUMERIC.test(literal));
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
      if (consumedLiteralData && lastSlotEnd === 0 && !/[^A-Za-z0-9]/.test(text)) {
        return renderPattern(text, pattern, placeholder, false);
      }
      return output;
    }
    function toPattern(value, patternOrOptions) {
      const options = typeof patternOrOptions === "string" ? { pattern: patternOrOptions } : patternOrOptions;
      if (options == null || typeof options !== "object" || Array.isArray(options)) {
        throw new TypeError("VanillaMasker: specify a pattern string or a pattern options object.");
      }
      const { pattern, placeholder = "" } = options;
      if (typeof pattern !== "string" || typeof placeholder !== "string" || [...placeholder].length > 1) {
        throw new TypeError("VanillaMasker: pattern must be a string and placeholder must be one character or empty.");
      }
      if (ALPHANUMERIC.test(placeholder) && [...pattern].some((character) => {
        var _a;
        return (_a = PATTERN_SLOTS[character]) == null ? void 0 : _a.test(placeholder);
      })) {
        throw new TypeError("VanillaMasker: placeholder must not match any editable slot in the pattern.");
      }
      return renderPattern(normalizeValue(value), pattern, placeholder, true);
    }
    module.exports = { toMoney, prepareMoneyOptions, formatMoney, toPattern, toNumber, toAlphaNumeric, normalizeValue };
  }
});

// src/index.js
var require_index = __commonJS({
  "src/index.js"(exports, module) {
    var { toMoney, toPattern, toNumber, toAlphaNumeric, prepareMoneyOptions, formatMoney } = require_formatters();
    var bindings = /* @__PURE__ */ new WeakMap();
    var textTypes = /* @__PURE__ */ new Set(["text", "search", "tel", "url", "password"]);
    function getElements(target) {
      if (!target) throw new TypeError("VMasker: there is no element to bind.");
      const elements = target.nodeType ? [target] : Array.from(target);
      if (!target.nodeType && typeof target.length !== "number") {
        throw new TypeError("VMasker: expected an input, textarea or collection.");
      }
      for (const element of elements) {
        if (!element || typeof element.addEventListener !== "function" || !(element.nodeName === "TEXTAREA" || element.nodeName === "INPUT" && textTypes.has(element.type))) {
          throw new TypeError('VMasker: use text inputs or textareas (not input type="number").');
        }
      }
      return [...new Set(elements)];
    }
    function patternText(options) {
      return typeof options === "string" ? options : options.pattern;
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
      if (state.method === "toPattern") {
        const token = patternText(state.options)[index];
        return token === "9" ? /[0-9]/.test(value[index]) : token === "A" ? /[a-zA-Z]/.test(value[index]) : token === "S" && /[0-9a-zA-Z]/.test(value[index]);
      }
      if (state.method === "toMoney") {
        const { start, end } = moneyBounds(value, state.options);
        return index >= start && index < end && (/[0-9]/.test(value[index]) || state.options.showSignal && value[index] === "-");
      }
      if (state.method === "toAlphaNumeric") return toAlphaNumeric(value[index]) !== "";
      return /[0-9-]/.test(value[index]);
    }
    function caretPosition(raw, formatted, position, state) {
      if (position === null || !formatted) return formatted.length;
      if (state.method === "toPattern") {
        return Math.min(toPattern(raw.slice(0, position), patternText(state.options)).length, formatted.length);
      }
      if (state.method === "toNumber") return toNumber(raw.slice(0, position)).length;
      if (state.method === "toAlphaNumeric") return toAlphaNumeric(raw.slice(0, position)).length;
      const rawBounds = moneyBounds(raw, state.options);
      const bounds = moneyBounds(formatted, state.options);
      const rightDigits = raw.slice(Math.max(position, rawBounds.start), rawBounds.end).replace(/\D/g, "").length;
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
        if (raw.startsWith(prefix) && raw.endsWith(suffix) && raw.length >= prefix.length + suffix.length) {
          const inserted = raw.slice(prefix.length, raw.length - suffix.length);
          raw = edit.value.slice(0, edit.start) + inserted + edit.value.slice(edit.end);
          start = end = edit.start + inserted.length;
        }
      }
      const direction = element.selectionDirection || "none";
      let formatted;
      const money = state.method === "toMoney" ? moneyText(raw, state.options) : "";
      const deletingLastDigit = state.method === "toMoney" && event && /^delete/.test(event.inputType) && !/[1-9]/.test(money);
      if (!raw || deletingLastDigit) {
        formatted = "";
      } else if (state.method === "toMoney" && !/\d/.test(money)) {
        formatted = state.options.showSignal && money.startsWith("-") ? state.options.unit + "-" : "";
      } else if (state.method === "toMoney") {
        formatted = formatMoney(raw, state.options);
      } else if (state.method === "toPattern") {
        formatted = toPattern(raw, state.options);
      } else if (state.method === "toAlphaNumeric") {
        formatted = toAlphaNumeric(raw);
      } else {
        formatted = toNumber(raw);
      }
      const nextStart = caretPosition(raw, formatted, start, state);
      const nextEnd = caretPosition(raw, formatted, end, state);
      if (element.value !== formatted) element.value = formatted;
      element.lastOutput = formatted;
      if (start !== null && typeof element.setSelectionRange === "function") {
        element.setSelectionRange(nextStart, nextEnd, direction);
      }
    }
    function replaceAndNotify(element, state, event, start, end, text) {
      event.preventDefault();
      element.setRangeText(text, start, end, "end");
      applyMask(element, state, event);
      const EventClass = element.ownerDocument.defaultView.InputEvent;
      element.dispatchEvent(new EventClass("input", { bubbles: true, inputType: event.inputType, data: text || null }));
    }
    function beforeInput(element, state, event) {
      var _a;
      if (state.composing || event.isComposing || !event.cancelable) {
        if (state.method === "toMoney" && element.value && element.selectionStart !== null && !state.pendingEdit) {
          const bounds = moneyBounds(element.value, state.options);
          const from = element.selectionStart, to = element.selectionEnd;
          const clamp = (position) => Math.max(bounds.start, Math.min(position, bounds.end));
          if (from < bounds.start || to > bounds.end) {
            const whole = from !== to && from <= bounds.start && to >= bounds.end;
            state.pendingEdit = { value: element.value, from, to, start: whole ? 0 : clamp(from), end: whole ? element.value.length : clamp(to) };
          }
        }
        return;
      }
      if (state.method === "toPattern" && /^delete/.test(event.inputType) && element.selectionStart !== element.selectionEnd) {
        const value = element.value;
        let payload = "", from = 0, to = 0;
        for (let index2 = 0; index2 < value.length; index2++) {
          if (!isEditable(value, index2, state)) continue;
          if (index2 < element.selectionStart) from++;
          if (index2 < element.selectionEnd) to++;
          payload += value[index2];
        }
        event.preventDefault();
        if (from === to) return;
        element.value = payload.slice(0, from) + payload.slice(to);
        element.setSelectionRange(from, from);
        applyMask(element, state, event);
        const EventClass2 = element.ownerDocument.defaultView.InputEvent;
        element.dispatchEvent(new EventClass2("input", { bubbles: true, inputType: event.inputType }));
        return;
      }
      if (state.method === "toMoney" && element.value && element.selectionStart !== null) {
        const bounds = moneyBounds(element.value, state.options);
        const from = element.selectionStart;
        const to = element.selectionEnd;
        if (from !== to && from <= bounds.start && to >= bounds.end) {
          element.setSelectionRange(0, element.value.length);
        } else {
          const clamp = (position) => Math.max(bounds.start, Math.min(position, bounds.end));
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
            const text = typeof event.data === "string" ? event.data : (_a = event.dataTransfer) == null ? void 0 : _a.getData("text/plain");
            if (typeof text === "string") {
              replaceAndNotify(element, state, event, nextStart, nextEnd, text);
              return;
            }
          } else if (/^delete/.test(event.inputType) && nextStart !== nextEnd) {
            replaceAndNotify(element, state, event, nextStart, nextEnd, "");
            return;
          }
        }
      }
      const backwards = event.inputType === "deleteContentBackward";
      if (!backwards && event.inputType !== "deleteContentForward") return;
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
      const EventClass = element.ownerDocument.defaultView.InputEvent;
      element.dispatchEvent(new EventClass("input", { bubbles: true, inputType: event.inputType }));
    }
    function removeBinding(element) {
      const state = bindings.get(element);
      if (!state) return;
      for (const [event, listener] of Object.entries(state.listeners)) element.removeEventListener(event, listener);
      bindings.delete(element);
      return state;
    }
    function unmaskedValue(value, state) {
      if (state.method === "toPattern") {
        return value.split("").filter((_, index) => isEditable(value, index, state)).join("");
      }
      if (state.method === "toAlphaNumeric") return toAlphaNumeric(value);
      return toNumber(state.method === "toMoney" ? moneyText(value, state.options) : value);
    }
    function valueForNewMask(element, previous, method, options) {
      if (previous.method !== "toMoney" || method !== "toMoney" || element.value !== element.lastOutput || !element.value) {
        return unmaskedValue(element.value, previous);
      }
      const text = moneyText(element.value, previous.options);
      const sign = text.startsWith("-") ? "-" : "";
      let digits = text.replace(/\D/g, "");
      const targetPrecision = options.zeroCents ? 0 : options.precision;
      const change = targetPrecision - previous.options.precision;
      digits = change >= 0 ? digits + "0".repeat(change) : digits.slice(0, change);
      return sign + (digits || "0");
    }
    function prepareOptions(method, options) {
      if (method === "toMoney") {
        const prepared = prepareMoneyOptions(options);
        prepared.lastOutput = void 0;
        return prepared;
      }
      if (method === "toPattern") {
        const prepared = typeof options === "string" ? { pattern: options } : { ...options };
        toPattern("", prepared);
        return prepared;
      }
      if (method !== "toNumber" && method !== "toAlphaNumeric") throw new TypeError("VMasker: unknown mask method.");
      return {};
    }
    var Mask = class {
      constructor(elements) {
        this.elements = elements;
        this.opts = {};
      }
      bindElementToMask(method) {
        const prepared = prepareOptions(method, this.opts);
        for (const element of this.elements) {
          const previous = bindings.get(element);
          const nextValue = previous ? valueForNewMask(element, previous, method, prepared) : element.value;
          removeBinding(element);
          if (element.value !== nextValue) element.value = nextValue;
          const state = { method, options: { ...prepared }, composing: false, listeners: {} };
          state.listeners.input = (event) => {
            if (!event.isComposing) applyMask(element, state, event);
          };
          state.listeners.change = () => applyMask(element, state);
          state.listeners.beforeinput = (event) => beforeInput(element, state, event);
          state.listeners.compositionstart = () => {
            state.composing = true;
          };
          state.listeners.compositionend = () => {
            state.composing = false;
            applyMask(element, state);
          };
          bindings.set(element, state);
          for (const [event, listener] of Object.entries(state.listeners)) element.addEventListener(event, listener);
          applyMask(element, state);
        }
        return this;
      }
      maskMoney(options) {
        this.opts = options || {};
        return this.bindElementToMask("toMoney");
      }
      maskNumber() {
        this.opts = {};
        return this.bindElementToMask("toNumber");
      }
      maskAlphaNum() {
        this.opts = {};
        return this.bindElementToMask("toAlphaNumeric");
      }
      maskPattern(options) {
        this.opts = options;
        return this.bindElementToMask("toPattern");
      }
      unbindElementToMask() {
        for (const element of this.elements) {
          const state = removeBinding(element);
          if (!state) continue;
          element.value = unmaskedValue(element.value, state);
          element.lastOutput = "";
        }
        return this;
      }
      unMask() {
        return this.unbindElementToMask();
      }
    };
    function VMasker(target) {
      return new Mask(getElements(target));
    }
    VMasker.toMoney = toMoney;
    VMasker.toNumber = toNumber;
    VMasker.toAlphaNumeric = toAlphaNumeric;
    VMasker.toPattern = toPattern;
    module.exports = VMasker;
  }
});
export default require_index();
