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

## mautic-tracking.js

Cópia do `mtc.js` — o script de tracking de visitantes do Mautic.

- **Origem:** `https://mautic.roco.com.br/mtc.js`
- **Baixado em:** 2026-08-04
- **SHA-256:** `d4378644e5d4b619d642b7f509e580393a927946a150882a95501d6d4dc7f000`
- **Tamanho:** 100.654 bytes
- **Verificação:** inspecionado pelos mesmos indicadores de ClickFix / ofuscação
  (`clipboard.writeText`, `execCommand`, `powershell`, `mshta`, `eval(`,
  `new Function`, `atob`, `fromCharCode`, `unescape`, `document.write`) —
  **zero** ocorrências. É o `mtc.js` padrão do Mautic.
- **Domínios externos referenciados:** apenas `mautic.roco.com.br`; o resto são
  URLs de crédito/documentação em comentários de bibliotecas embutidas
  (`mediaelementjs.com`, `j.hn`, `w3.org`).

### Caminhos que injetariam script remoto (inertes neste site)

O `mtc.js` tem dois trechos que chamam `MauticJS.insertScript()` apontando para
`mautic.roco.com.br` — o que a CSP `script-src 'self'` bloquearia. Nenhum é
alcançado aqui:

| Trecho | Script remoto | Condição para rodar |
|---|---|---|
| `initGatedVideo()` | `2.jquery.js`, `froogaloop2.min.js` | Só se a página tiver `<video>` — a função retorna antes se `document.getElementsByTagName('video')` estiver vazio. |
| Renderização de *Dynamic Web Content* | `media/js/mautic-form.js` | Só ao renderizar um slot DWC cujo conteúdo contenha `mauticform_wrapper`. |

Se algum dia o site tiver `<video>` ou slots DWC, a CSP bloqueia o carregamento
e o console acusa — reavalie antes de liberar.

### Como os hits saem

`POST` em `https://mautic.roco.com.br/mtc/event` (CORS) e, se falhar, fallback
para o pixel `https://mautic.roco.com.br/mtracking.gif?…`. Por isso o domínio do
Mautic precisa estar em `connect-src` **e** `img-src` na CSP do `next.config.ts`.

Grava cookies de primeira parte (`mtc_id`, `mtc_sid`, `mautic_device_id`) e
`localStorage` — relevante para LGPD, ver comentário em
`src/shared/components/analytics/mautic-tracking.tsx`.

Usado por `src/shared/components/analytics/mautic-tracking.tsx`.
Liga/desliga via `NEXT_PUBLIC_MAUTIC_TRACKING_ENABLED`.

## Ao reextrair / atualizar

Se o Mautic mudar (novos campos no formulário, nova versão do Mautic), rebaixe o
arquivo, **reinspecione** e atualize o SHA-256 na seção correspondente:

```bash
curl -sS "https://mautic.roco.com.br/index.php/media/js/mautic-form.js" -o public/vendor/mautic-form.js
curl -sS "https://mautic.roco.com.br/mtc.js" -o public/vendor/mautic-tracking.js
sha256sum public/vendor/mautic-form.js public/vendor/mautic-tracking.js
```

> Só atualize estas cópias a partir de um servidor Mautic comprovadamente limpo.
