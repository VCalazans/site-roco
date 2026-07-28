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

### Ao reextrair / atualizar

Se o formulário do Mautic mudar (novos campos, nova versão), rebaixe o arquivo,
**reinspecione** e atualize o SHA-256 acima:

```bash
curl -sS "https://mautic.roco.com.br/index.php/media/js/mautic-form.js" -o public/vendor/mautic-form.js
sha256sum public/vendor/mautic-form.js
```

> Só atualize esta cópia a partir de um servidor Mautic comprovadamente limpo.
