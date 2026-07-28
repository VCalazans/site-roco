# Rollback — Embed do formulário Mautic

Contexto: após um incidente de **ClickFix** (golpe que instrui a vítima a apertar
`Win + R` e colar um comando) servido via `mautic.roco.com.br`, o embed do
formulário foi endurecido.

Histórico de estados (commits em `main`):

| Estado | Descrição |
|---|---|
| **Original (remoto)** | Injeta `https://mautic.roco.com.br/form/generate.js?id=1` em runtime. Vetor do incidente. Ref: commit `f705ede`. |
| **Desativado** | Modal mostra mensagem de indisponibilidade. Ref: commit `607d28f`. |
| **Endurecido (atual)** | HTML estático + SDK self-hosted (`/vendor/mautic-form.js`) + CSP `script-src 'self'`. Toggle por env. |

---

## Opção 1 — Desligar o formulário sem rollback de código (rápido)

Defina a variável de ambiente e refaça o build/deploy:

```bash
NEXT_PUBLIC_CONTACT_FORM_ENABLED=false
```

O modal passa a exibir `contact.unavailable` (pt/en). Nenhum código muda.
Como `NEXT_PUBLIC_*` é embutido no build, é preciso **rebuild** (no easypanel,
ajuste o build arg / env e redeploy).

---

## Opção 2 — Voltar ao embed REMOTO original (`generate.js?id=1`)

> ⚠️ Só faça isso com o servidor Mautic **comprovadamente limpo**. É este o
> embed que foi comprometido no incidente.

1. Restaure o modal original a partir do commit `f705ede`:

   ```bash
   git checkout f705ede -- src/shared/components/contact-form/contact-modal.tsx
   ```

2. (Opcional) Remova os artefatos da versão endurecida:

   ```bash
   git rm src/shared/components/contact-form/mautic-embed.tsx
   git rm public/vendor/mautic-form.js public/vendor/README.md
   ```

3. (Opcional) Remova a chave `contact.form` de `src/i18n/dictionaries/{pt,en}.json`
   e a flag `NEXT_PUBLIC_CONTACT_FORM_ENABLED` do `.env.example` — não fazem mal
   se ficarem, apenas deixam de ser usadas.

4. **Mantenha a CSP** do `next.config.ts`, mas **adicione o domínio do Mautic ao
   `script-src`** (o embed remoto carrega script de lá):

   ```
   script-src 'self' 'unsafe-inline' https://mautic.roco.com.br
   ```

   Sem isso, a CSP bloqueia o `generate.js` e o `mautic-form.js` remotos.

5. `npm run build` e deploy.

---

## Opção 3 — Voltar apenas ao estado "Desativado"

```bash
git checkout 607d28f -- src/shared/components/contact-form/contact-modal.tsx
```

Remova a dependência de `mautic-embed.tsx`/`contact.form` se desejar (ver Opção 2,
passos 2–3). A CSP pode permanecer como está.

---

## Como reativar a versão endurecida (padrão recomendado)

É o estado atual do `main`. Basta garantir:

- `NEXT_PUBLIC_CONTACT_FORM_ENABLED` ausente ou diferente de `"false"`;
- `public/vendor/mautic-form.js` presente (cópia verificada — ver `public/vendor/README.md`);
- CSP do `next.config.ts` **sem** `mautic.roco.com.br` no `script-src` (só em
  `connect-src`/`form-action`).

## Checklist de teste no navegador

1. Abrir o site → clicar em "Entre em contato".
2. DevTools → **Console**: não deve haver violações de CSP.
3. DevTools → **Network**: o único request para `mautic.roco.com.br` deve ser o
   **POST** de `form/submit` ao enviar — nenhum `.js` carregado de lá.
4. Preencher e enviar um lead de teste; confirmar recebimento no Mautic.
5. Testar CNPJ inválido → envio bloqueado; CNPJ válido → passa.
