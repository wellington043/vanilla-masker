# Validação de VMasker Refined 2.0.0 — 17/11/2026

Ambiente local: Node 22.18.0, Windows x64. Execução: `npm run check`.

## Resultado local

- 37 testes Node de formatação e distribuição passaram, sem falhas.
- 107 subcenários passaram em Chromium, Firefox e WebKit. O relatório TAP inclui os três agrupamentos e totaliza 110 aprovações.
- Emulação móvel com toque e viewport de 375×812 passou em Chromium e WebKit. Não houve teste em aparelho físico ou integração em sistema de produção.
- A demo abre diretamente por `file://`, aplica as máscaras e executa 16 verificações literais pelo botão.
- Importação validada como script global, AMD, CommonJS e ESM. Os testes de navegador usam a distribuição minificada.
- Os caminhos históricos `lib/vanilla-masker.js` e `build/vanilla-masker.min.js` expõem a mesma implementação; a descompressão do gzip retorna exatamente o bundle atual.
- `toAlphaNumeric` e `maskAlphaNum`, presentes no upstream, foram preservados e testados, inclusive cursor, IME e desvinculação.
- Revisão independente da integração aprovada, sem achados acionáveis pendentes.

## Regressões cobertas

CPF, CNPJ, telefone, placa, data como formato, moeda negativa, precisão de 0 a 20, valores longos em strings, opções inválidas, valores nulos, agrupamento e separadores literais. No DOM: digitação, input usado por colagem/autofill, composição IME, seleção/cursor, Backspace/Delete, substituição, vários campos, listeners da aplicação, rebind e unMask.

Os testes incluem perda ou incorporação indevida de dados em unidades numéricas, centavos sintéticos, literais Unicode e placeholders. A validação de CPF/CNPJ, validade de datas e regras de negócio continua sendo responsabilidade da aplicação consumidora.

## Artefato de integração

`dist/vmask.min.js` e `build/vanilla-masker.min.js`: **11.377 bytes**. Distribuição gzip em `build/`: **4.211 bytes**. SHA-256 do JavaScript minificado:

```
194283175338445f14e77472c9e3d0c4c15773f1e3585a50d38fd348ad7d2bf9
```

Os arquivos `.txt` históricos foram preservados para o benchmark. `npm run benchmark` compara funções puras no ambiente local; não demonstra ganho universal nem mede carregamento ou eventos do DOM.

## Verificação no GitHub

O [workflow CI](https://github.com/wellington043/vanilla-masker/actions/workflows/ci.yml) executa testes Node em 20/22/24 e os três motores de navegador no Linux, além da conferência dos artefatos gerados. O estado de cada execução está no link, separado das evidências locais acima. As distribuições são disponibilizadas no GitHub; não há publicação no npm.
