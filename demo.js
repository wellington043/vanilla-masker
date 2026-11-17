'use strict';

(() => {
  const result = document.querySelector('#manual-result');
  const button = document.querySelector('#run-tests');
  const VMasker = window.VMasker;

  if (typeof VMasker !== 'function') {
    result.textContent = 'A biblioteca não carregou. Execute npm run build e abra a página novamente.';
    button.disabled = true;
    return;
  }

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

  for (const [id, method, options] of examples) {
    VMasker(document.getElementById(id))[`mask${method}`](options);
  }

  button.addEventListener('click', () => {
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
