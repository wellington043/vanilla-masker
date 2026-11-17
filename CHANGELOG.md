# Changelog

## 2.0.0 — 2026-11-17

Primeira versão publicada deste fork, sucedendo a base upstream 1.2.0. A versão 1.0.0 Refined foi um marco local anterior à integração com o histórico upstream.

- Mantidos os caminhos `lib/vanilla-masker.js` e `build/vanilla-masker.min.js`, incluindo o arquivo gzip, além dos novos artefatos em `dist/`.
- Preservadas `toAlphaNumeric()` e `maskAlphaNum()` da API upstream, com remoção de todos os grupos inválidos e testes de input/cursor/desvinculação.
- CI no GitHub Actions para Node 20/22/24 e Chromium/Firefox/WebKit.

- Consolidada a refatoração local com fontes em `src/` e builds UMD, CommonJS e ESM em `dist/`.
- Corrigidas a formatação de alta precisão, a edição com `zeroCents` e ponto decimal, a precisão zero com sufixo e a preservação de literais de padrões.
- Adicionados suporte opcional a sinal negativo em moeda, normalização de valores nulos e validação das opções.
- Máscaras de campo respondem a eventos `input`, preservam handlers da aplicação e tratam edição, composição e remoção da máscara. `unMask()` preserva letras de padrões alfanuméricos.
- Protegidos os prefixos/sufixos numéricos e centavos sintéticos durante inserções e exclusões, inclusive eventos não canceláveis de composição. Trocar máscaras não incorpora decoração ao valor.
- Rejeitados placeholders que seriam confundidos com dados; preservados os dígitos depois de literais Unicode ao desvincular a máscara.
- Demonstração aberta diretamente do disco, exemplos com saídas verificáveis, testes Node e navegador e benchmark local.

### Mudanças de compatibilidade

- Navegadores atuais e Node >=20 para desenvolvimento; retirados Grunt, Travis, Bower e pacote Meteor legados.
- Opções e tipos inválidos são rejeitados; null/undefined são tratados como vazio.
- Máscaras monetárias usam dígitos, não fazem parsing de quantias decimais. A API do DOM passa a usar input/composição e preserva listeners da aplicação.
- unMask preserva letras/dígitos/sinais úteis; placeholders que poderiam ser confundidos com dados são rejeitados.

O [changelog upstream até 1.2.0](docs/UPSTREAM_CHANGELOG.md) e os commits anteriores permanecem disponíveis.
