# System Patterns — ROCO
> Atualizar quando houver mudança arquitetural.

## Arquitetura Geral
Next.js App Router + i18n por middleware, organização **modular por feature**.

```
Request → middleware.ts (resolve locale, prefixa /{locale})
        → app/[locale]/page.tsx (server: valida locale, carrega dicionário)
        → modules/landing/components/coming-soon-hero.tsx (client: render + animação)
```

## Padrão Arquitetural
**Monólito modular** com separação por responsabilidade:
- `app/`     → roteamento, layouts, SEO (thin — orquestra, não implementa regra).
- `core/`    → configuração e utilitários transversais (metadata, `cn`).
- `modules/` → features isoladas e autocontidas (`landing/`, e futuras).
- `shared/`  → componentes reutilizáveis entre módulos (layout, forms, i18n UI).
- `i18n/`    → configuração de locales e dicionários tipados.

## Estrutura de Pastas
Ver @AGENTS.md (seção "Estrutura de Pastas") — fonte única para evitar divergência.

## Como Criar uma Nova Feature/Página
1. Crie `src/modules/<feature>/components/…` (componentes da feature).
2. Adicione as chaves de texto em `src/i18n/dictionaries/pt.json` e `en.json`.
3. Crie a rota em `src/app/[locale]/<rota>/page.tsx` (valide o locale, carregue o dicionário).
4. Reaproveite layout/estruturas de `src/shared/components/`.
5. Atualize `sitemap.ts` se for uma rota pública.
6. `npm run lint` + `npm run build` antes de commitar.

## Padrões de Código
- **i18n first**: nada de copy hardcoded; tudo vem do dicionário (tipado via `Dictionary`).
- **Server/Client**: dados e i18n no server; interatividade/animação em `"use client"`.
- **Estilo**: Tailwind v4 (`@theme` em `globals.css`); tokens de marca como CSS vars.
  Classes condicionais via `cn()` (`@/core/lib/utils`).
- **Imagens**: `next/image`, `alt` do dicionário, `priority` só no LCP.
- **Alias**: imports internos com `@/*`.

## Fluxo de Dados (i18n)
`params.locale` → `getDictionary(locale)` → props tipadas para os componentes.
Locale persiste em cookie `NEXT_LOCALE` (30 dias), setado pelo middleware.

## Portal Interno (CRM) — Padrões
### Route Groups: (site) vs (internal)
- **(site)**: `/pt`, `/en`, `/pt/catalogo`, etc. — público, renderiza `MauticTrackingProvider`.
- **(internal)**: `/portal/*`, `/admin/*` — privado (auth guard em proxy.ts), SEM tracking.
Isolação por pasta permitiu convivência Tailwind (site) + MUI (portal).

### Autenticação & Middleware (proxy.ts)
```
Request → proxy.ts (Node runtime)
        → params.locale resolva (cookie/Accept-Language)
        → (site) → passa
        → (internal) → requer sessão (redirect /api/auth/signin)
        → (internal) + role check → passa ou rejeita (403)
```
**`requireAuth()`** (helper em `src/core/auth/rbac.ts`): retorna `session` ou redireciona.
**`withRBAC(permission)`** (procedure factory tRPC): valida permissão antes de executar.

### Padrão RBAC
- Tabelas: roles → role_permissions → permissions (resource + action).
- Exemplo permissões: `"products:read"`, `"products:create"`, `"products:delete"`,
  `"representatives:approve"`, `"audit_logs:read"`.
- Checagem client-side (`can()` no dicionário): **UX only** (validação real no server).
- Server-side: procedures tRPC wrapped com `withRBAC("resource:action")` —
  rejeita request se user não tem permissão.
- Session carrega array de permissões do JWT (atualizado a cada 5min via revalidação).

### Uploads Presigned (2-step)
1. **Presign (frontend → backend)**:
   ```
   POST /api/uploads/presign { filename, contentType, size, productId }
   ← { presignedUrl, uploadId }
   ```
   - Valida: contentType (image/* ou application/pdf), size (max 10MB), produtoId existe.
   - Valida prefixo de key (`/products/{productId}/…`) — anti path-traversal.
   - Gera presigned PUT (5min TTL) para R2.

2. **Upload (browser → R2)**: browser PUTs arquivo direto.

3. **Confirm (frontend → backend)**:
   ```
   POST /api/uploads/confirm { uploadId, productId }
   ```
   - HEAD object no R2 (valida que arquivo existe).
   - INSERT na tabela product_images.
   - Retorna URL pública (para imagens) ou presigned GET (para documentos privados).

**Antipadrão evitado**: upload proxy pelo servidor (banda, latência).

### MUI + Tailwind: Coexistência (Unlayered)
- **MUI**: `src/core/theme` (theme único, CSS variables, `@mui/material-nextjs` com
  InitColorSchemeScript). Componentes Portal isolados em `src/app/[locale]/(internal)/`.
- **Tailwind**: Site público em `src/app/[locale]/(site)/` + shared components.
- **CSS Layers**: Tailwind v4 usa @theme/@base/@components/@utilities (layered); MUI é **unlayered**
  (enableCssLayer removido 2026-08-10). Especificidade bruta do MUI vence layers por regra CSS padrão,
  prevenindo buracos onde preflight pudesse vencer estilos de componentes. Route groups isolam
  fronteiras: nunca compartilham componentes entre site/portal.
- **Tokens**: marca ROCO (cyan #3ec6f0, amber #f5a33c) definidos em ambos (MUI theme + Tailwind @theme).

### Micro-padrões da Stack (Descobertos em Teste Manual)
1. **`sx` em Server Components**: nunca use **função** de tema em `sx={}` de componentes Server
   (revalidação de SSR em runtime não resolvida). Use CSS variables em vez disso:
   `sx={{ bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.16)" }}`.
2. **Tooltip em elemento disabled no SSR**: MUI Tooltip renderiza um Popper que clona o filho
   → em SSR, divergência de atributos (ex.: aria-describedby) causa hydration mismatch **mesmo sem
   style inline**. **Padrão**: usar Chip/Badge visível ou texto inline; nunca Tooltip em disabled
   em árvore Server.
3. **Hidratação única de form com autosave**: se autosave refaz query e invalida cache (ex.: `me`),
   o refetch pode reexecuta hidratação e sobrescrever entrada do usuário + reverter para passo salvo.
   **Padrão**: guard booleano (hidrata UMA vez no mount), form local é fonte de verdade, autosave
   persiste apenas a mudança de passo (não relê do server).

### Fluxo de Dados — Portal (tRPC + REST)
```
Portal (client)
  → tRPC v11 (procedures tipadas, withRBAC)
  → src/server/trpc (routers: products, representatives, sync)
  → Drizzle queries (type-safe)
  → Postgres

Site Público
  → /api/products (Route Handlers REST)
  → unstable_cache + revalidateTag("products")
  → Drizzle queries (mesmo banco)
  → Postgres
```
**Mutação invalidação**: tRPC mutation chama `revalidateTag("products")` →
Next reavalia Route Handlers → cache reset → paginas/ISR refazem.

### Padrão Server Actions (futuro)
Se necessário (form simples, arquivo pequeno): `"use server"` + `cookies()` para auth.
Hoje: tRPC é suficiente para a complexidade (queries type-safe, RBAC, streaming).

## Padrões Novos (Spec 001 — 2026-09-30)

### Conteúdo editável da home
- **Modelo**: um documento jsonb por seção em `site_settings` (`home.*`) + schema zod compartilhado
  em `src/modules/home/lib/home-content.ts` (escrita estrita no router, leitura tolerante no site).
- **Resolução**: `conteúdo salvo[idioma] || dicionário[idioma]`; campo ausente vale vazio, então um
  campo novo no schema não invalida o que já foi salvo.
- **Cache**: `unstable_cache` com tag `home-content` (300 s); toda mutação expira a tag na hora
  (`revalidateTag(tag, { expire: 0 })`). O hero continua em `hero_slides` (tag `hero`).
- **Links editáveis**: sempre por `isSafeHref` (caminho interno `/…`, âncora `#…`, `http(s)://`,
  `mailto:`/`tel:`; bloqueia `javascript:`, `data:`, `//host`, espaço/controle).

### Header persistente + View Transitions
- `SiteHeader` (client component) vive no layout `(site)` e não remonta entre páginas; as páginas não
  o renderizam.
- O conteúdo fica num `<ViewTransition>` do React (Next 16.3): crossfade curto, header ancorado,
  morph da imagem do card para a capa do detalhe (mesmo `name`); `prefers-reduced-motion` desliga.

### Carrossel e filtros
- `src/shared/components/carousel`: setas anterior/próxima + rolagem por toque; as setas somem
  quando tudo cabe. Indicadores e pausa são do slider do hero, não do carrossel genérico.
- `/produtos`: barra lateral (gaveta no mobile) com busca ao vivo, categorias com contagem e
  "só campeões", tudo na URL. **Filtros combinados** (regras em
  `src/modules/products/lib/listing-filters.ts`): categorias em OU, termos de busca em E, grupos
  entre si em E; parâmetros repetidos na URL; Enter ou "+" fixa o termo como chip (até 5).
- **URL como fonte da verdade no explorador**: os filtros vêm de `useSearchParams` +
  `readListingState` (a MESMA leitura que o SSR da página faz). As URLs que o explorador escreve
  com `history.replaceState` entram numa fila e o eco delas é ignorado; qualquer outra mudança de
  URL (menu, busca do header, voltar/avançar) é navegação externa e é adotada. Em voltar/avançar o
  roteador restaura a renderização em cache, que pode ser anterior aos filtros aplicados no
  cliente — `matchesServerRender` compara e, se não bate, o explorador busca os itens certos.
- Busca: `matchAllTerms` (`sql-like.ts`, sem acento via `translate`; teto de palavras
  `maxTerms`: 6 por padrão, 12 na listagem pública, que junta os termos-chip); busca livre NUNCA
  entra no cache (a chave viria do usuário). Consultas sem busca e com no máximo 1 categoria são
  cacheadas (`unstable_cache`, tag "products").

### Solicitações (leads)
- `leads.list` (somente leitura, `leads:read`) não devolve e-mail/telefone; o detalhe (`leads.byId`)
  devolve e grava a ação `leads.view` no audit log a cada abertura.

### Orçamento (ex-carrinho)
- Rota `/{locale}/orcamento`, redirect 308 de `/carrinho`; origem `orcamento` forçada no servidor
  para `subject: "cart"`; `conversion_identifier` `orcamento_lista_produtos`; chave `roco_cart_v1`
  do localStorage mantida.

### Link estável de arquivo privado
- Arquivo privado do R2 nunca vai para a página como URL presignada (vence e o arquivo "some").
- A página aponta para uma rota autenticada (`GET /api/portal/materials/[id]/download`) que confere
  sessão e permissão no clique e redireciona (303) para uma URL do R2 de 60 s com
  `Content-Disposition` seguro (`src/server/lib/content-disposition.ts`).
- Redirect para dentro do próprio site em Route Handler usa `Location` RELATIVA: no servidor
  standalone (Docker) `request.nextUrl.origin` é o host de bind (`http://0.0.0.0:3000`), e um
  redirect absoluto montado com ele quebra. (No middleware `request.url` chega com o host certo.)

### Embalagens sem "padrão"
- Não existe embalagem "padrão": todas as cadastradas aparecem, sempre na ordem de `sortPackagings`
  (tipo → quantidade), com texto de `describePackaging` (`src/shared/lib/packaging.ts`).
- A coluna `is_default` é legado do importador: não é exibida nem editada, só devolvida ao salvar.
- O formulário do portal acusa embalagem repetida (tipo + quantidade) antes do banco.

### Permissão nova de módulo = seed + migration
- O seed não roda no boot; as migrations rodam. Toda permissão nova entra no seed E numa migration
  idempotente (`INSERT … ON CONFLICT DO NOTHING`, ex.: `drizzle/0011_ensure_portal_permissions.sql`),
  aplicada uma única vez por banco, no primeiro boot com o código novo.

### Uma rota, telas por permissão
- Quando gestão e leitura do mesmo conteúdo servem públicos diferentes, a mesma rota decide a tela
  pela permissão (ex.: `/portal/materiais`: CRUD com `materials:create`, biblioteca com
  `materials:read`), com pré-visualização para quem gerencia (`?visao=representante`).

### Paginação numerada reutilizável no portal
- Um rodapé para todas as listas: `PortalPagination` (MUI `TablePagination` com as ações trocadas por
  páginas numeradas; textos do locale do tema; 20/50/100 por página). A aplicação conta páginas a
  partir de 1; a conversão para o 0-based do MUI fica só dentro do componente.
- Em Produtos a URL é a fonte da verdade (`?page=`/`?perPage=`, gravados com `history.replaceState`
  lendo a URL viva); filtro novo volta à página 1 mantendo o tamanho.
- Helpers puros em `src/modules/portal/lib/pagination.ts` (`pageCountOf`, `clampPage`,
  `parsePaging`, `applyPaging`), com testes.
- O servidor limita a página ao intervalo real (`clampPage` depois do `count`) e devolve a página
  efetiva; a URL a adota só com a resposta DAQUELA consulta (nunca com o placeholder da anterior).
- A consulta usa `keepPreviousData` (a página anterior fica na tela enquanto a nova carrega) e trocar
  de página rola até o topo da tabela (sem animação com `prefers-reduced-motion`).

### Downloads pelo portal (arquivos do R2)
- A página nunca recebe URL presignada (vence com a aba aberta). Aponta para uma rota autenticada
  que confere sessão e permissão NO CLIQUE (`authorizePortalRoute`, `src/server/lib/portal-route-auth.ts`)
  e responde 303 para uma URL do R2 de 60 s com `Content-Disposition` seguro (RFC 6266/5987):
  materiais (privados, `materials:read`) e imagens de produto (original com o nome do arquivo,
  `product_images:download`). Sem sessão: 303 RELATIVO para o login no idioma do cookie `NEXT_LOCALE`.
- Vários arquivos = ZIP em streaming (`client-zip`, modo "store": bytes originais):
  - leitura do R2 sob demanda (`getObjectStream` → `toPullStream`) e janela de 4 objetos abertos à
    frente (`PREFETCH_WINDOW`);
  - cancelamento, falha no meio ou 2 min sem progresso fecham o que está aberto no R2 — wrapper nosso,
    porque o client-zip não encerra o gerador de entradas;
  - teto de ZIPs simultâneos por usuário e por processo (`download-slots.ts`, em memória: o pool de
    sockets do S3 é por processo);
  - nomes de pasta/arquivo sempre pelo saneador (`zip-entry-names.ts`), com guarda final de caminho
    (`isSafeZipPath`).

### Links de conta por e-mail (confirmação e redefinição de senha — 2026-09-30)
- O token vai no FRAGMENTO do link (`/{locale}/portal/<página>#token=…`): o navegador não o envia ao
  servidor, então não aparece em log, proxy nem Referer. A página o tira da barra de endereço
  (`history.replaceState`), confere com `POST /api/account/token` (sem consumir) e só consome no clique
  do botão — antivírus e pré-visualização de e-mail que abrem o link não gastam o token.
- No banco só o SHA-256 (`account_tokens`, busca pelo hash); uso único por UPDATE condicional (não usado
  e não vencido) na mesma transação da mudança; pedir outro link invalida os anteriores.
- Esqueci-senha e reenviar confirmação respondem sempre igual, e o e-mail sai em `after()` (depois da
  resposta): nem o conteúdo nem o tempo da resposta dizem se a conta existe.
- Rotas de conta: limite por IP ANTES de ler o corpo, corpo só JSON e até 16 KiB (`readJsonBody`), limite
  por e-mail depois do parse (hash do e-mail normalizado na chave do Redis); tudo fail-closed.
- Links montados de `AUTH_URL` → `NEXT_PUBLIC_SITE_URL` (`src/server/lib/app-url.ts`), nunca do Host.
- Sessão: o JWT guarda `authAt`; na revalidação (≤ 5 min) ela cai se `passwordChangedAt` for posterior.
- Política de senha única no navegador e no servidor: `src/shared/lib/password-policy.ts`.
- Texto digitado por visitante que vai para e-mail da ROCO passa por higienização: nome só com letras
  (`isValidPersonName`) e saudação só com o primeiro nome (`greetingName`).

### Erro inesperado do tRPC não vaza para o cliente
- `errorFormatter` em `src/server/trpc/init.ts`: erro INESPERADO (o tRPC embrulhou uma exceção qualquer —
  `isUnexpectedError`) chega ao cliente só como `internal_error`; a mensagem do Drizzle traz a consulta com
  os parâmetros. `TRPCError` lançado de propósito passa como está.
- Produção loga só path + código do banco (`unexpectedErrorCode`); desenvolvimento, a mensagem inteira.

### Área de atuação (base do IBGE)
- Base versionada em `src/shared/data/ibge-localidades.json` (tuplas), gerada por
  `scripts/build-ibge-localidades.mjs`; lógica pura em `src/shared/lib/territory.ts` com a base por parâmetro.
- Navegador: import dinâmico sob demanda (`loadTerritoryIndex`/`useTerritoryIndex`,
  `src/modules/portal/lib/territory-client.ts`) — o bundle das páginas não carrega os ~200 KB. Servidor:
  import estático (`getTerritoryIndex`, `src/server/lib/representative-territory.ts`).
- Grava-se só `{ kind, code }` + UF em `representative_territories`; o rótulo vem da base (validação no
  servidor) e o resumo legível fica em `representatives.region` (`replaceRepresentativeTerritory`).

## Decisões Arquiteturais
Registradas em @memory-bank/decisionLog.md (nunca deletar entradas).
