# VMasker Refined 2.0.0

Fork do [VanillaMasker](https://github.com/vanilla-masker/vanilla-masker) mantido em [wellington043/vanilla-masker](https://github.com/wellington043/vanilla-masker), para formatar valores e campos de texto em navegadores atuais. A biblioteca roda sem dependências em tempo de execução. As distribuições estão no repositório e nas [releases](https://github.com/wellington043/vanilla-masker/releases). `"private": true` impede publicação acidental no npm; não significa que este repositório seja privado.

[![CI](https://github.com/wellington043/vanilla-masker/actions/workflows/ci.yml/badge.svg)](https://github.com/wellington043/vanilla-masker/actions/workflows/ci.yml)

## Uso no navegador

O único arquivo JavaScript necessário em produção para uso como script global é `dist/vmask.min.js`. Carregue-o antes do código da aplicação. Ao redistribuir o bundle, inclua o arquivo `LICENSE`.

```html
<input id="cpf" type="text" inputmode="numeric">
<script src="./vmask.min.js"></script>
<script>
  const cpf = document.querySelector('#cpf');
  VMasker(cpf).maskPattern('999.999.999-99');
</script>
```

Depois do build, abra [index.html](index.html) diretamente no navegador. A demonstração carrega o bundle por caminho relativo e o botão **Executar testes** compara as saídas dos formatadores com valores esperados.

Para importação local, use o artefato do seu módulo.

```js
// CommonJS
const VMasker = require('./dist/vmask.cjs');
```

```js
// ESM
import VMasker from './dist/vmask.mjs';
```

`dist/vmask.js` é a versão UMD legível para depuração. Os dois arquivos UMD também aceitam AMD.

Os caminhos tradicionais `lib/vanilla-masker.js` e `build/vanilla-masker.min.js` continuam disponíveis e são gerados com a mesma implementação. `build/vanilla-masker.min.js.gz` contém a distribuição comprimida.

## API

- `VMasker(elemento | NodeList | Array)` recebe campos de texto (`input` textual ou `textarea`) e retorna uma instância. Para teclado numérico, use `type="text"` e `inputmode="numeric"`.
- `.maskMoney(opções)`, `.maskNumber()`, `.maskAlphaNum()` e `.maskPattern(padrão | { pattern, placeholder })` vinculam a máscara, formatam o valor atual do campo e retornam a instância. Vincular outra máscara ao mesmo campo substitui a anterior.
- `.unMask()` desvincula a máscara e retira a formatação. Em padrões, preserva as letras e os dígitos digitados. Em número e moeda, preserva dígitos e eventual sinal negativo.
- `VMasker.toMoney(valor, opções)`, `VMasker.toNumber(valor)`, `VMasker.toAlphaNumeric(valor)` e `VMasker.toPattern(valor, padrãoOuOpções)` retornam strings e funcionam sem DOM. A formatação alfanumérica mantém letras/dígitos ASCII e espaços, removendo todos os outros caracteres.

```js
VMasker.toMoney('123456', { unit: 'R$' });            // 'R$ 1.234,56'
VMasker.toMoney('1234', { precision: 0 });            // '1.234'
VMasker.toMoney('1234', { zeroCents: true });         // '1.234,00'
VMasker.toMoney('-123', { showSignal: true });        // '-1,23'
VMasker.toNumber('-12abc34');                         // '-1234'
VMasker.toAlphaNumeric('A-1 B_2!');                   // 'A1 B2'
VMasker.toPattern('11912345678', '(99) 99999-9999');   // '(11) 91234-5678'
VMasker.toPattern('12', { pattern: '99/99', placeholder: '_' }); // '12/__'
```

A máscara monetária interpreta uma sequência de dígitos. Com o padrão de duas casas decimais, `'1234'` equivale a 1.234 centavos e exibe `12,34`. `precision: 0` oculta a parte decimal. `zeroCents: true` interpreta os dígitos como unidades inteiras e mantém as casas decimais zeradas.

| Opção de moeda | Padrão | Valores aceitos |
| --- | --- | --- |
| `precision` | `2` | Inteiro de 0 a 20 |
| `separator` | `','` | String não vazia sem dígitos |
| `delimiter` | `'.'` | String sem dígitos. `''` desativa o agrupamento |
| `unit`, `suffixUnit` | `''` | Strings de prefixo e sufixo |
| `zeroCents`, `showSignal` | `false` | Booleanos |

Padrões usam `9` para dígitos ASCII, `A` para letras ASCII e `S` para ambos. Os demais caracteres do padrão são literais. A entrada descarta pontuação e a máscara para no primeiro caractere alfanumérico ASCII incompatível com a posição esperada. `placeholder` aceita um caractere ou uma string vazia, mas não pode corresponder a nenhum dos tipos de posição usados no padrão: `'0'` em uma máscara numérica, por exemplo, gera `TypeError` porque seria indistinguível de um dígito informado. Use `'_'` quando quiser um marcador sem essa ambiguidade. As máscaras formatam CPF, CNPJ e datas. A validação dos valores fica com a aplicação.

## Migração

- Esta é uma versão major em relação ao upstream 1.2.0. Requer navegadores atuais; Internet Explorer não é suportado. Os fluxos Grunt, Travis, Bower e Meteor legados foram retirados. O histórico upstream foi preservado no Git e no [changelog original](docs/UPSTREAM_CHANGELOG.md).
- O vínculo usa eventos `input` e preserva os handlers da aplicação. Para reformatar imediatamente após atribuir `campo.value` via JavaScript, dispare `campo.dispatchEvent(new Event('input', { bubbles: true }))`.
- `toMoney` usa uma sequência de dígitos: `'1,2'` com duas casas produz `'0,12'`, não interpreta a string como uma quantia decimal. Normalize os valores na aplicação quando precisar dessa conversão.
- `null` e `undefined` são tratados como entrada vazia. `toMoney(null)` retorna `'0,00'` com as opções padrão. Ao apagar um campo vinculado à máscara monetária, ele fica vazio.
- Os formatadores aceitam strings e números finitos representáveis sem notação exponencial dentro da faixa segura de `Number`. Use strings para valores longos e para preservar todos os dígitos. Tipos e opções inválidos geram `TypeError`. Precisão fora do intervalo, números inseguros e números representados em notação exponencial geram `RangeError`.
- `unMask()` preserva letras de padrões alfanuméricos, como placas. A versão legada as descartava.
- `toAlphaNumeric()` e `maskAlphaNum()` preservam a API upstream e removem todos os grupos inválidos; a função antiga removia apenas o primeiro grupo.
- Prefixos, sufixos e centavos gerados por `zeroCents` são protegidos durante a edição. Ao trocar uma máscara monetária por outra, o valor é preservado; reduzir a precisão ou ativar `zeroCents` descarta as casas excedentes, sem arredondamento. Ao trocar para `maskNumber()` ou usar `unMask()`, o resultado é a sequência de dígitos exibida, sem unidade, com eventual sinal.

## Desenvolvimento

Requer Node.js 20 ou superior. Edite as fontes em `src/` e gere os artefatos em `dist/`.

```sh
npm ci
npm run build
npm run browsers:install
npm test
npm run test:browser
npm run check
npm run benchmark
```

`npm test` executa testes Node dos formatadores e da distribuição. `npm run test:browser` cobre a integração no Chromium, Firefox e WebKit com Playwright. `npm run check` executa as duas suítes. A cobertura móvel usa emulação. Aparelhos físicos ainda não foram validados.

Depois de gerar o bundle, `npm run benchmark` compara as funções puras da distribuição minificada com as três versões históricas. O resultado inclui medianas do tempo de rodadas no Node, tamanho bruto e tamanho com gzip. Os tempos dependem do ambiente e dos exemplos escolhidos. O benchmark mede apenas chamadas aos formatadores e serve como referência para essa carga de trabalho.

`vmask.txt`, `minify-vmask.txt` e `gpt-vmask.txt` são registros históricos usados pelo benchmark. O fork parte da refatoração de `gpt-vmask.txt`, consolidada com a API do upstream.

## Licença

MIT. O VanillaMasker original é atribuído à BankFacil, Caio Ribeiro Pereira, Leandro Alvares da Costa e demais colaboradores. [Licença](LICENSE) · [Projeto original](https://github.com/vanilla-masker/vanilla-masker)
