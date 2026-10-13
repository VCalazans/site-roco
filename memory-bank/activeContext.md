# Active Context — ROCO
> Atualizado: 2026-10-13

## Foco Atual
Spec 003 — "Site pronto para IA" (SEO técnico, JSON-LD, llms.txt, MCP público e WebMCP): **implementada no código em
2026-10-13**, commitada e enviada à `main` (junto com a camada de segurança), ainda NÃO implantada (deploy automático desligado). Spec: `memory-bank/specs/003-site-pronto-para-ia.md`.
Decisões D1–D7 em `decisionLog.md` (2026-10-13).

## Tarefas em Andamento
- Implementado (lista "Implementado" da spec): lang pela URL, canonical/hreflang, listagem com regra de indexação, robots e
  sitemap com produtos, OG, JSON-LD, `/sobre`, `/llms*.txt`, `/mcp`, `/.well-known`, WebMCP, IndexNow.
- Verificado: tsc ok, lint 0 erros (6 warnings pré-existentes), 2067 testes em 92 arquivos, `next build` verde, smoke no build
  de produção local (rotas 200, JSON-LD e hreflang no HTML, `lang="en"` em `/en` sem cookie, MCP com curl e MCP Inspector CLI).
- **WebMCP não testado no navegador**: a API não está ativa no Chrome local (sem token nem flag). Só teste de unidade.

- **Google Analytics**: não há GA4/GTM no site nem no repositório (conferido em 2026-10-13). O stakeholder quer GA e
  configurações de rastreamento; falta o ID de medição (`G-…`) da conta da ROCO e a decisão de consentimento (LGPD).

## Decisões Recentes
- 2026-10-13: D1 bots de IA liberados (inclusive treinamento); D2 CNPJ fora até confirmação; D3 homônimo citado; D4 FAQ
  adiada; D5 llms só em pt; D6 WebMCP agora; D7 `?category=` indexável sem rota nova.
- 2026-10-13: sitemap passa a listar produtos (revisa a decisão de 2026-08-11).
- 2026-10-13: `/mcp` na raiz exige entrada em `ROOT_ROUTES` e no matcher do `src/proxy.ts`.

## Próximos Passos Prioritários
1. **Deploy** da spec 003 junto com a camada de segurança (depende do avanço da `main` e do aval do stakeholder; ver abaixo).
2. Em produção: conferir "AI Crawl Control"/"Block AI bots" na Cloudflare (podem bloquear sem aparecer no robots.txt); gerar
   `INDEXNOW_KEY`; registrar o origin trial do WebMCP para `roco.com.br` (`WEBMCP_ORIGIN_TRIAL_TOKEN`).
3. Search Console e Bing Webmaster (sitemap, pedido de indexação); Rich Results Test na home, listagem e 3 produtos.
4. Conector MCP no Claude (3 perguntas reais sobre a ROCO); avaliar `/mcp` na regra de rate limiting da Cloudflare.
5. Confirmar com a ROCO: CNPJ e data de fundação (D2), FAQ real (D4), descrições de produto faltando (pt/en) e nomes de
   categoria do ERP em caixa alta (ex.: HIDRO_LATÃO), que aparecem em llms e `/sobre`.

## Contexto anterior (resumo)
**2026-10-12 — camada de segurança (commits `b09a9a9`, `9fae93d`, `febc6ab`, `64589f9`, `9a17f92`)**: Turnstile nos formulários
e na conta (fail-closed; sem `TURNSTILE_SECRET_KEY` fica desligado com aviso no log); IP do visitante só pela borda da
Cloudflare (`resolveClientIp`); WAF de varreduras e limite de 10 POST/10 s na zona `roco.com.br`; TLS mínimo 1.2. Dois bugs
corrigidos: worker do ERP fora da imagem standalone (`instrumentation.ts` movido para `src/`) e exclusão de representante
sem tirar o perfil. Produção segue em `71744a7`.
**2026-10-12 — ambiente de produção**: site novo no ar em `roco.com.br` (`71744a7`). Arquivos no MinIO (`s3.roco.com.br`,
`midia.roco.com.br`, console `painel-midia.roco.com.br`), tudo pela Cloudflare; `whats/roco-db` e `whats/roco-redis`; carga
inicial feita de dentro da rede privada. Next 16.3.8. Detalhes em techContext › "Ambiente de Produção".
**2026-09-30 — rodadas 3 a 5**: filtros combinados e redes sociais; paginação numerada, imagens por capa e download de
originais; contas com confirmação de e-mail, reset de senha por link, área de atuação com base do IBGE e aviso "cadastro em
análise". Detalhes no decisionLog e em `progress.md`.

## Pendências herdadas (fora da spec 003)
- **Chaves do Turnstile** no `site-roco` e no `roco-test`: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (build-arg, exige rebuild) e
  `TURNSTILE_SECRET_KEY` (runtime), do mesmo widget. Conferir `client.viaCloudflare` no `/api/health` (`x-health-token`).
- **Smoke da camada**: `workers.running: true`; widget visível; "esqueci a senha" com e-mail inexistente recebe resposta
  genérica; 429 acima de 10 POST em 10 s. Incluir cada rota pública nova de formulário na regra da Cloudflare.
- **RD Station**: `cf_origem` é o único campo que o código envia e a conta não tem. Sonda de 2026-08-31: a API responde 200
  para campo inexistente e descarta em silêncio. Chave de produção (`RD_STATION_API_KEY`) ainda não existe.
- **Resend**: `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` e `CONTACT_NOTIFICATION_EMAIL` (aviso de lead).
- **SMTP de produção**: remetente do domínio da ROCO, SPF/DKIM, `AUTH_URL` https; desligar rastreio de clique do provedor.
- **Backup automático do `roco-db`** (EasyPanel › Cópias de segurança, destino S3 num bucket do MinIO).
- **Guia de operação** (PDF para o cliente, fora do repo): tirar o aviso "Excluir cadastro não apaga o perfil" depois do deploy
  de `febc6ab`; incluir a verificação de segurança nas seções de acesso.
- **Antes de ligar o Google SSO**: corrigir a role `representative` concedida no 1º login (Riscos em `progress.md`).
- **Decisões de produto**: destino de `/catalogo` (sem link desde 2026-09-30); representante baixar imagens de produtos não
  publicados (hoje sim).
- **Ambiente**: atualizar o Node local para 22; `db:seed` em produção (`db:seed:qa` recusa fora de banco local); apagar o
  cadastro de teste "Teste Envio SMTP" do banco local.
- **Em espera**: spec 002 (embalagens GS1) com 4 decisões do stakeholder (`memory-bank/specs/002-embalagens-gs1.md`).
- Compartilhar com o cliente o manual de uso e o resumo de entregas (artifacts privados).
