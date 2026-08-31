# public/vendor — scripts de terceiros self-hosted

Scripts de terceiros servidos do **próprio domínio** (em vez de carregados em
runtime de hosts externos), para reduzir superfície de ataque e permitir CSP
`script-src 'self'`.

## mautic-form.js

- **Origem:** `https://mautic.roco.com.br/index.php/media/js/mautic-form.js?v0216eae3`
- **Baixado em:** 2026-07-27
- **SHA-256:** `4a4275f92aae7057ebfc7bd3fe85795ff281aafcfe6e3a2e9908bd492b162db4`
- **Verificação:** inspecionado por indicadores de ClickFix / ofuscação
  (`clipboard.writeText`, `execCommand`, `powershell`, `mshta`, `eval`, `atob`,
  `fromCharCode`, domínios externos) — **nenhum** encontrado. É o SDK padrão do
  Mautic.

Usado por `src/shared/components/contact-form/mautic-embed.tsx`.

## mautic-tracking.js — REMOVIDO em 2026-08-30

O tracking de visitantes migrou do Mautic para o **RD Station** (decisão do
stakeholder; o RD é a plataforma de marketing da ROCO). A cópia self-hosted do
`mtc.js` foi apagada junto com o componente `MauticTracking` — manter um script
de 100 KB servido publicamente sem nenhum consumidor é superfície de ataque sem
contrapartida.

O RD **não** é self-hospedado: a tag do painel é um loader que puxa cinco
arquivos de duas CDNs em runtime, então a cópia congelaria e quebraria em
silêncio na primeira atualização deles. Por isso os hosts do RD entraram no
`script-src` da CSP — o trade-off está registrado em `next.config.ts` e no
`decisionLog.md`.

⚠️ O `mautic-form.js` acima **continua em uso** pelo formulário de contato.
Só o tracking saiu.

## Ao reextrair / atualizar

Se o Mautic mudar (novos campos no formulário, nova versão do Mautic), rebaixe o
arquivo, **reinspecione** e atualize o SHA-256 na seção correspondente:

```bash
curl -sS "https://mautic.roco.com.br/index.php/media/js/mautic-form.js" -o public/vendor/mautic-form.js
curl -sS "https://mautic.roco.com.br/mtc.js" -o public/vendor/mautic-tracking.js
sha256sum public/vendor/mautic-form.js public/vendor/mautic-tracking.js
```

> Só atualize estas cópias a partir de um servidor Mautic comprovadamente limpo.
