'use strict';

(() => {
  const result = document.querySelector('#manual-result');
  const button = document.querySelector('#run-tests');
  const VMasker = window.VMasker;

  const examples = [
    ['money-brl', 'Money', { unit: 'R$' }, '123456', 'R$ 1.234,56'],
    ['money-usd', 'Money', { unit: '$', separator: '.', delimiter: ',' }, '123456', '$ 1,234.56'],
    ['money-percent', 'Money', { suffixUnit: '%' }, '1234', '12,34 %'],
    ['money-int', 'Money', { unit: 'R$', zeroCents: true }, '1234', 'R$ 1.234,00'],
    ['money-high', 'Money', { precision: 8 }, '123456', '0,00123456'],
    ['cpf', 'Pattern', '999.999.999-99', '12345678901', '123.456.789-01'],
    ['cnpj', 'Pattern', '99.999.999/9999-99', '12345678000190', '12.345.678/0001-90'],
    ['phone', 'Pattern', '(99) 99999-9999', '11912345678', '(11) 91234-5678'],
    ['date', 'Pattern', '99/99/9999', '17112026', '17/11/2026'],
    ['plate', 'Pattern', 'AAA9A99', 'abc-1d23', 'abc1d23'],
    ['only-num', 'Number', undefined, '-12abc34', '-1234'],
  ];
  const regressions = [
    ['zeroCents com ponto decimal', 'Money', { separator: '.', delimiter: ',', zeroCents: true }, '1,003.00', '1,003.00'],
    ['Precisão zero com sufixo', 'Money', { precision: 0, suffixUnit: '%' }, '1234', '1.234 %'],
    ['Moeda com valor nulo', 'Money', undefined, null, '0,00'],
    ['Valor negativo com sinal', 'Money', { unit: 'R$', showSignal: true }, '-123', 'R$ -1,23'],
    ['Padrão com caracteres literais', 'Pattern', '+55 (99)', '11', '+55 (11)'],
  ];

  const heroInput = document.querySelector('#hero-input');
  const heroLabel = document.querySelector('#hero-label');
  const heroRaw = document.querySelector('#hero-raw');
  const heroCode = document.querySelector('#hero-code');
  const heroButtons = document.querySelectorAll('[data-hero-mode]');
  const filterButtons = document.querySelectorAll('[data-filter]');
  const cards = document.querySelectorAll('.example-card[data-category]');
  const exampleCount = document.querySelector('#example-count');
  const installButtons = document.querySelectorAll('[data-install-mode]');
  const installCode = document.querySelector('#install-code');
  const copyStatus = document.querySelector('#copy-status');
  let copyFeedbackTimer;
  const fillButton = document.querySelector('#fill-examples');
  const clearButton = document.querySelector('#clear-examples');

  function selectButton(buttons, attribute, selected) {
    for (const control of buttons) {
      control.setAttribute('aria-pressed', String(control.getAttribute(attribute) === selected));
    }
  }

  function filterExamples(category) {
    let visible = 0;
    for (const card of cards) {
      card.hidden = category !== 'all' && card.dataset.category !== category;
      if (!card.hidden) visible++;
    }
    selectButton(filterButtons, 'data-filter', category);
    if (exampleCount) exampleCount.textContent = `${visible} ${visible === 1 ? 'exemplo' : 'exemplos'}`;
  }

  for (const control of filterButtons) {
    control.addEventListener('click', () => filterExamples(control.dataset.filter));
  }
  filterExamples('all');

  const moneySnippet = "const field = document.querySelector('#valor');\nVMasker(field).maskMoney({ unit: 'R$' });";
  const installation = {
    esm: `import VMasker from 'vanilla-masker-modern';\n\n${moneySnippet}`,
    cjs: `const VMasker = require('vanilla-masker-modern');\n\n${moneySnippet}`,
    script: `<input id="valor" type="text" inputmode="numeric">\n\n<script src="https://cdn.jsdelivr.net/npm/vanilla-masker-modern@2.0.0/dist/vmask.min.js"></script>\n<script>\n  ${moneySnippet.replace(/\n/g, '\n  ')}\n</script>`,
  };

  function selectInstallation(mode) {
    if (!Object.hasOwn(installation, mode)) return;
    selectButton(installButtons, 'data-install-mode', mode);
    if (installCode) installCode.textContent = installation[mode];
  }

  for (const control of installButtons) {
    control.addEventListener('click', () => selectInstallation(control.dataset.installMode));
  }
  selectInstallation('esm');

  function fallbackCopy(text) {
    const previousFocus = document.activeElement;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.readOnly = true;
    textarea.tabIndex = -1;
    textarea.setAttribute('aria-hidden', 'true');
    Object.assign(textarea.style, { position: 'fixed', left: '-9999px', top: '0', opacity: '0' });
    document.body.append(textarea);
    try {
      textarea.focus({ preventScroll: true });
      textarea.select();
      return typeof document.execCommand === 'function' && document.execCommand('copy');
    } catch (_) {
      return false;
    } finally {
      textarea.remove();
      if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    }
  }

  for (const control of document.querySelectorAll('[data-copy-target]')) {
    control.addEventListener('click', async () => {
      const target = document.getElementById(control.dataset.copyTarget);
      let copied = false;
      if (target) {
        const text = target.textContent.trim();
        try {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text);
            copied = true;
          }
        } catch (_) {
          // Some browsers deny clipboard access on local files or without permission.
        }
        if (!copied) copied = fallbackCopy(text);
      }
      if (copyStatus) {
        clearTimeout(copyFeedbackTimer);
        copyStatus.textContent = copied
          ? 'Código copiado.'
          : 'Não foi possível copiar. Selecione o código e copie manualmente.';
        copyFeedbackTimer = setTimeout(() => { copyStatus.textContent = ''; }, 4000);
      }
    });
  }

  if (typeof VMasker !== 'function') {
    if (result) result.textContent = 'Não foi possível carregar a demonstração interativa. Recarregue a página para tentar novamente.';
    for (const control of [button, heroInput, fillButton, clearButton, ...heroButtons, ...examples.map(([id]) => document.getElementById(id))]) {
      if (control) control.disabled = true;
    }
    return;
  }

  for (const [id, method, options] of examples) {
    const field = document.getElementById(id);
    if (field) VMasker(field)[`mask${method}`](options);
  }

  const heroModes = {
    money: { label: 'Valor em reais', inputMode: 'numeric', method: 'Money', options: { unit: 'R$' }, sample: '123456', snippet: moneySnippet },
    cpf: { label: 'CPF', inputMode: 'numeric', method: 'Pattern', options: '999.999.999-99', sample: '12345678901', snippet: "const field = document.querySelector('#valor');\nVMasker(field).maskPattern('999.999.999-99');" },
    phone: { label: 'Telefone celular', inputMode: 'tel', method: 'Pattern', options: '(99) 99999-9999', sample: '11912345678', snippet: "const field = document.querySelector('#valor');\nVMasker(field).maskPattern('(99) 99999-9999');" },
  };
  const heroEvents = ['input', 'change', 'compositionend'];

  function updateHeroRaw() {
    if (heroInput && heroRaw) heroRaw.textContent = heroInput.value.replace(/\D/g, '');
  }

  function selectHero(mode) {
    if (!heroInput || !Object.hasOwn(heroModes, mode)) return;
    const config = heroModes[mode];
    const mask = VMasker(heroInput);
    for (const event of heroEvents) heroInput.removeEventListener(event, updateHeroRaw);
    mask.unMask();
    heroInput.value = config.sample;
    mask[`mask${config.method}`](config.options);
    // Keep this listener after the mask listeners, including after a mode switch.
    for (const event of heroEvents) heroInput.addEventListener(event, updateHeroRaw);
    heroInput.setAttribute('inputmode', config.inputMode);
    if (heroLabel) heroLabel.textContent = config.label;
    if (heroCode) heroCode.textContent = config.snippet;
    selectButton(heroButtons, 'data-hero-mode', mode);
    updateHeroRaw();
  }

  for (const control of heroButtons) {
    control.addEventListener('click', () => selectHero(control.dataset.heroMode));
  }
  selectHero('money');

  function setExampleValues(fill) {
    for (const [id, , , sample] of examples) {
      const field = document.getElementById(id);
      if (!field) continue;
      field.value = fill ? sample : '';
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  if (fillButton) fillButton.addEventListener('click', () => setExampleValues(true));
  if (clearButton) clearButton.addEventListener('click', () => setExampleValues(false));

  if (button) button.addEventListener('click', () => {
    const tests = [...examples, ...regressions];
    const failures = [];
    for (const [label, method, options, input, expected] of tests) {
      try {
        const actual = VMasker[`to${method}`](input, options);
        if (actual !== expected) {
          failures.push(`${label} (esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)})`);
        }
      } catch (error) {
        failures.push(`${label} (${error.message})`);
      }
    }
    result.textContent = failures.length
      ? `${failures.length} de ${tests.length} testes falharam. ${failures.join(' | ')}`
      : `Todos os ${tests.length} testes passaram.`;
  });
})();
