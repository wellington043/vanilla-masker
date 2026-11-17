'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const playwright = require('playwright');
const root = path.resolve(__dirname, '..');
const legacy = process.env.VMASK_LEGACY === '1';
const code = fs.readFileSync(path.join(root, legacy ? 'gpt-vmask.txt' : 'dist/vmask.min.js'), 'utf8');
const engines = (process.env.VMASK_BROWSERS || 'chromium,firefox,webkit').split(',');

(async () => {
  for (const engine of engines) {
    await test(`browser: ${engine}${legacy ? ' (legacy regression baseline)' : ''}`, async (t) => {
      const browser = await playwright[engine].launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      async function fixture() {
        errors.length = 0;
        await page.setContent('<input id="field" type="text"><input id="second" type="text">');
        await page.addScriptTag({ content: code });
      }
      try {
        await t.test('formats existing values on binding', async () => {
          await fixture();
          await page.evaluate(() => { const el = document.querySelector('#field'); el.value = '1234'; VMasker(el).maskMoney({ unit: 'R$' }); });
          assert.equal(await page.locator('#field').inputValue(), 'R$ 12,34');
        });
        await t.test('formats input events used by paste and autofill', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelector('#field')).maskPattern('999.999.999-99'));
          await page.locator('#field').fill('12345678901');
          assert.equal(await page.locator('#field').inputValue(), '123.456.789-01');
        });
        await t.test('alphanumeric mask formats input and keeps the caret at the edited position', async () => {
          await fixture();
          await page.evaluate(() => {
            const el = document.querySelector('#field');
            el.value = 'A!- 12';
            VMasker(el).maskAlphaNum();
          });
          const field = page.locator('#field');
          assert.equal(await field.inputValue(), 'A 12');
          await field.focus();
          await field.evaluate(el => el.setSelectionRange(2, 2));
          await page.keyboard.insertText('!B?');
          assert.equal(await field.inputValue(), 'A B12');
          assert.equal(await field.evaluate(el => el.selectionStart), 3);
          await field.evaluate(el => el.setSelectionRange(2, 2));
          await page.keyboard.press('Backspace');
          assert.equal(await field.inputValue(), 'AB12');
          assert.equal(await field.evaluate(el => el.selectionStart), 1);
        });
        await t.test('alphanumeric mask defers filtering during composition', async () => {
          await fixture();
          const values = await page.evaluate(() => {
            const el = document.querySelector('#field');
            VMasker(el).maskAlphaNum();
            el.dispatchEvent(new CompositionEvent('compositionstart'));
            el.value = 'éA 1漢';
            el.dispatchEvent(new InputEvent('input', { isComposing: true }));
            const during = el.value;
            el.dispatchEvent(new CompositionEvent('compositionend'));
            return [during, el.value];
          });
          assert.deepEqual(values, ['éA 1漢', 'A 1']);
        });
        await t.test('alphanumeric mask preserves data on rebind and removes its listeners on unMask', async () => {
          await fixture();
          const values = await page.evaluate(() => {
            const el = document.querySelector('#field');
            const mask = VMasker(el);
            el.value = 'AB  12';
            mask.maskAlphaNum().maskAlphaNum().unMask();
            const unmasked = el.value;
            el.value = 'Z? 9';
            el.dispatchEvent(new Event('input'));
            return [unmasked, el.value];
          });
          assert.deepEqual(values, ['AB  12', 'Z? 9']);
        });
        await t.test('handles actual keyboard input and clearing a monetary field', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelector('#field')).maskMoney({ unit: 'R$' }));
          await page.locator('#field').pressSequentially('1234');
          assert.equal(await page.locator('#field').inputValue(), 'R$ 12,34');
          await page.locator('#field').fill('');
          assert.equal(await page.locator('#field').inputValue(), '');
        });
        await t.test('a negative monetary amount can be typed starting with the minus sign', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelector('#field')).maskMoney({ unit: 'R$', showSignal: true }));
          await page.locator('#field').pressSequentially('-123');
          assert.equal(await page.locator('#field').inputValue(), 'R$ -1,23');
        });
        await t.test('backspacing the final significant monetary digit clears the field', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelector('#field')).maskMoney());
          await page.locator('#field').pressSequentially('1');
          await page.keyboard.press('Backspace');
          assert.equal(await page.locator('#field').inputValue(), '');
        });
        await t.test('Delete across a pattern separator removes the following digit', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelector('#field')).maskPattern('999.999.999-99'));
          await page.locator('#field').fill('123456');
          await page.locator('#field').evaluate(el => el.setSelectionRange(3, 3));
          await page.keyboard.press('Delete');
          assert.equal(await page.locator('#field').inputValue(), '123.56');
          assert.equal(await page.locator('#field').evaluate(el => el.selectionStart), 3);
        });
        await t.test('keeps application handlers and removes only its own binding', async () => {
          await fixture();
          const result = await page.evaluate(() => {
            const el = document.querySelector('#field');
            let changes = 0, keys = 0;
            const keyHandler = () => keys++;
            el.onkeyup = keyHandler;
            el.addEventListener('input', () => changes++);
            VMasker(el).maskNumber();
            el.value = 'x12'; el.dispatchEvent(new Event('input'));
            const masked = el.value;
            VMasker(el).unMask();
            el.value = 'x34'; el.dispatchEvent(new Event('input')); el.dispatchEvent(new KeyboardEvent('keyup'));
            return { masked, value: el.value, changes, keys, handlerPreserved: el.onkeyup === keyHandler };
          });
          assert.deepEqual(result, { masked: '12', value: 'x34', changes: 2, keys: 1, handlerPreserved: true });
        });
        await t.test('unMask preserves letters from a plate', async () => {
          await fixture();
          const value = await page.evaluate(() => {
            const el = document.querySelector('#field'); el.value = 'ABC1234';
            VMasker(el).maskPattern('AAA-9999'); VMasker(el).unMask(); return el.value;
          });
          assert.equal(value, 'ABC1234');
        });
        await t.test('rebinding replaces the prior mask without stale listeners', async () => {
          await fixture();
          await page.evaluate(() => { const el = document.querySelector('#field'); VMasker(el).maskPattern('999-999'); VMasker(el).maskPattern('99/99'); });
          await page.locator('#field').fill('1234');
          assert.equal(await page.locator('#field').inputValue(), '12/34');
        });
        await t.test('composition input is formatted only after compositionend', async () => {
          await fixture();
          const values = await page.evaluate(() => {
            const el = document.querySelector('#field'); VMasker(el).maskPattern('999.999.999-99');
            el.dispatchEvent(new CompositionEvent('compositionstart'));
            el.value = '123456'; el.dispatchEvent(new InputEvent('input', { isComposing: true }));
            const during = el.value; el.dispatchEvent(new CompositionEvent('compositionend'));
            return [during, el.value];
          });
          assert.deepEqual(values, ['123456', '123.456']);
        });
        await t.test('inserting in the middle keeps the caret near the edited digit', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelector('#field')).maskPattern('999.999.999-99'));
          await page.locator('#field').fill('1234567890');
          await page.locator('#field').evaluate(el => el.setSelectionRange(4, 4));
          await page.keyboard.insertText('9');
          assert.equal(await page.locator('#field').inputValue(), '123.945.678-90');
          assert.equal(await page.locator('#field').evaluate(el => el.selectionStart), 5);
        });
        await t.test('backspace across a pattern separator removes the previous digit', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelector('#field')).maskPattern('999.999.999-99'));
          await page.locator('#field').fill('1234');
          await page.locator('#field').evaluate(el => el.setSelectionRange(4, 4));
          await page.keyboard.press('Backspace');
          assert.equal(await page.locator('#field').inputValue(), '124');
          assert.equal(await page.locator('#field').evaluate(el => el.selectionStart), 2);
        });
        await t.test('deleting a selection and replacing it formats the remaining digits', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelector('#field')).maskPattern('999.999.999-99'));
          await page.locator('#field').fill('12345678901');
          await page.locator('#field').evaluate(el => el.setSelectionRange(4, 7));
          await page.keyboard.insertText('9');
          assert.equal(await page.locator('#field').inputValue(), '123.978.901');
        });
        await t.test('monetary suffix keeps the caret before the unit', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelector('#field')).maskMoney({ suffixUnit: '%' }));
          await page.locator('#field').pressSequentially('1234');
          assert.equal(await page.locator('#field').inputValue(), '12,34 %');
          assert.equal(await page.locator('#field').evaluate(el => el.selectionStart), 5);
          await page.keyboard.press('Backspace');
          assert.equal(await page.locator('#field').inputValue(), '1,23 %');
        });
        await t.test('zeroCents editing with decimal dot and deletion remains stable', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelector('#field')).maskMoney({ separator: '.', delimiter: ',', zeroCents: true }));
          await page.locator('#field').pressSequentially('1234');
          assert.equal(await page.locator('#field').inputValue(), '1,234.00');
          await page.keyboard.press('Backspace');
          assert.equal(await page.locator('#field').inputValue(), '123.00');
        });
        await t.test('multiple fields keep separate monetary state', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelectorAll('input')).maskMoney({ zeroCents: true }));
          await page.locator('#field').fill('123'); await page.locator('#second').fill('4567');
          assert.equal(await page.locator('#field').inputValue(), '123,00');
          assert.equal(await page.locator('#second').inputValue(), '4.567,00');
        });
        await t.test('invalid collections fail without partially binding valid elements', async () => {
          await fixture();
          const result = await page.evaluate(() => {
            const el = document.querySelector('#field');
            let threw = false; try { VMasker([el, null]).maskNumber(); } catch (_) { threw = true; }
            el.value = 'x12'; el.dispatchEvent(new Event('input')); return { threw, value: el.value };
          });
          assert.deepEqual(result, { threw: true, value: 'x12' });
        });
        await t.test('rejected options leave an existing mask functional', async () => {
          await fixture();
          const result = await page.evaluate(() => {
            const el = document.querySelector('#field'); VMasker(el).maskPattern('99/99');
            let threw = false; try { VMasker(el).maskMoney({ precision: -1 }); } catch (_) { threw = true; }
            el.value = '1234'; el.dispatchEvent(new Event('input')); return { threw, value: el.value };
          });
          assert.deepEqual(result, { threw: true, value: '12/34' });
        });
        await t.test('rejects number inputs before their value can be lost', async () => {
          await fixture();
          const result = await page.evaluate(() => {
            const el = document.querySelector('#field'); el.type = 'number'; el.value = '1234';
            let threw = false; try { VMasker(el).maskMoney(); } catch (_) { threw = true; }
            return { threw, value: el.value };
          });
          assert.deepEqual(result, { threw: true, value: '1234' });
        });
        await t.test('typing after a numeric suffix never adds its digits to the amount', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelector('#field')).maskMoney({ suffixUnit: 'kg2' }));
          await page.locator('#field').fill('1234');
          await page.keyboard.press('End'); await page.keyboard.insertText('5');
          assert.equal(await page.locator('#field').inputValue(), '123,45 kg2');
        });
        await t.test('deleting part of a numeric prefix does not alter the amount', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelector('#field')).maskMoney({ unit: 'R2' }));
          await page.locator('#field').fill('1234');
          await page.locator('#field').evaluate(el => el.setSelectionRange(0, 1));
          await page.keyboard.press('Backspace');
          assert.equal(await page.locator('#field').inputValue(), 'R2 12,34');
          await page.locator('#field').evaluate(el => el.setSelectionRange(0, 1));
          await page.keyboard.press('Delete');
          assert.equal(await page.locator('#field').inputValue(), 'R2 12,34');
        });
        await t.test('inserting in synthetic zero cents edits whole digits only', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelector('#field')).maskMoney({ zeroCents: true }));
          await page.locator('#field').fill('123');
          await page.locator('#field').evaluate(el => el.setSelectionRange(5, 5));
          await page.keyboard.insertText('4');
          assert.equal(await page.locator('#field').inputValue(), '1.234,00');
        });
        await t.test('switching away from monetary affixes preserves only the amount', async () => {
          await fixture();
          const value = await page.evaluate(() => {
            const el = document.querySelector('#field'); el.value = '1234';
            VMasker(el).maskMoney({ unit: 'R2', suffixUnit: 'kg2' }); VMasker(el).maskNumber(); return el.value;
          });
          assert.equal(value, '1234');
        });
        await t.test('reconfiguring a monetary mask preserves its amount and sign', async () => {
          await fixture();
          const values = await page.evaluate(() => {
            const el = document.querySelector('#field'); el.value = '-1234';
            VMasker(el).maskMoney({ unit: 'R$', showSignal: true });
            VMasker(el).maskMoney({ unit: '$', separator: '.', delimiter: ',', precision: 4, showSignal: true });
            const precise = el.value;
            VMasker(el).maskNumber(); return [precise, el.value];
          });
          assert.deepEqual(values, ['$ -12.3400', '-123400']);
        });
        await t.test('rebinding zeroCents does not multiply its whole value', async () => {
          await fixture();
          const value = await page.evaluate(() => {
            const el = document.querySelector('#field'); el.value = '123';
            VMasker(el).maskMoney({ zeroCents: true });
            VMasker(el).maskMoney({ unit: '$', separator: '.', delimiter: ',', zeroCents: true }); return el.value;
          });
          assert.equal(value, '$ 123.00');
        });
        await t.test('ambiguous placeholders are rejected without changing the field', async () => {
          await fixture();
          const result = await page.evaluate(() => {
            const el = document.querySelector('#field'); el.value = '1';
            let threw = false; try { VMasker(el).maskPattern({ pattern: '99-99', placeholder: '0' }); } catch (_) { threw = true; }
            return { threw, value: el.value };
          });
          assert.deepEqual(result, { threw: true, value: '1' });
        });
        await t.test('unMask preserves every digit after a Unicode pattern literal', async () => {
          await fixture();
          const value = await page.evaluate(() => {
            const el = document.querySelector('#field'); el.value = '12';
            VMasker(el).maskPattern('🔹99'); VMasker(el).unMask(); return el.value;
          });
          assert.equal(value, '12');
        });
        await t.test('deleting the last phone digit does not turn its country code into data', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelector('#field')).maskPattern('+55 (99) 99999-9999'));
          await page.locator('#field').pressSequentially('1');
          assert.equal(await page.locator('#field').inputValue(), '+55 (1');
          await page.keyboard.press('Backspace');
          assert.equal(await page.locator('#field').inputValue(), '');
        });
        await t.test('typing through fixed text and separators keeps the complete pattern', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelector('#field')).maskPattern('ID 99/99z'));
          await page.locator('#field').pressSequentially('1234');
          assert.equal(await page.locator('#field').inputValue(), 'ID 12/34z');
        });
        await t.test('deleting a selected numeric literal preserves the pattern payload', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelector('#field')).maskPattern('+55 (99)'));
          await page.locator('#field').fill('12');
          await page.locator('#field').evaluate(el => el.setSelectionRange(0, 1));
          await page.keyboard.press('Delete');
          assert.equal(await page.locator('#field').inputValue(), '+55 (12)');
          await page.locator('#field').evaluate(el => el.setSelectionRange(0, 6));
          await page.keyboard.press('Delete');
          assert.equal(await page.locator('#field').inputValue(), '+55 (2');
        });
        await t.test('replacing a whole amount with formatted text does not duplicate affixes', async () => {
          await fixture();
          await page.evaluate(() => VMasker(document.querySelector('#field')).maskMoney({ unit: 'R2', suffixUnit: 'kg2' }));
          await page.locator('#field').fill('1234');
          await page.locator('#field').selectText();
          await page.keyboard.insertText('R2 56,78 kg2');
          assert.equal(await page.locator('#field').inputValue(), 'R2 56,78 kg2');
        });
        if (!legacy) {
          await t.test('demo loads from disk and has a working verification button', async () => {
            errors.length = 0;
            await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
            await page.locator('#cpf').fill('12345678901');
            assert.equal(await page.locator('#cpf').inputValue(), '123.456.789-01');
            await page.getByRole('button', { name: 'Executar testes' }).click();
            assert.match(await page.locator('#manual-result').innerText(), /Todos os \d+ testes passaram/);
            assert.deepEqual(errors, []);
            await page.setViewportSize({ width: 375, height: 812 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          });
          if (engine !== 'firefox') {
            await t.test('mobile emulation accepts touch focus and phone input', async () => {
              const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
              try {
                const mobilePage = await mobile.newPage();
                await mobilePage.goto(pathToFileURL(path.join(root, 'index.html')).href);
                await mobilePage.locator('#phone').tap();
                await mobilePage.locator('#phone').fill('11912345678');
                assert.equal(await mobilePage.locator('#phone').inputValue(), '(11) 91234-5678');
                assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
              } finally { await mobile.close(); }
            });
          }
        }
      } finally { await browser.close(); }
    });
  }
})();
