-- Permissões das imagens de produto (2026-09-30, 4ª rodada).
--
--   product_images:update   → marcar quais imagens aparecem no site e escolher a
--                             capa da listagem (antes só existiam create/delete).
--   product_images:download → baixar as imagens ORIGINAIS (uma a uma ou em ZIP),
--                             inclusive as que não aparecem no site.
--
-- Concessões (as mesmas do seed):
--   admin          → as duas
--   sales_manager  → download
--   representative → download
--
-- Mesmo padrão da 0011: roda sozinha no boot do container, é idempotente
-- (ON CONFLICT DO NOTHING), inofensiva num banco ainda sem roles e não remove
-- nada que tenha sido ajustado à mão na tela de Perfis.

INSERT INTO "permissions" ("resource", "action") VALUES
  ('product_images', 'update'),
  ('product_images', 'download')
ON CONFLICT ("resource", "action") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON (
  (r."slug" = 'admin' AND p."resource" = 'product_images' AND p."action" IN ('update', 'download'))
  OR (r."slug" IN ('sales_manager', 'representative')
      AND p."resource" = 'product_images' AND p."action" = 'download')
)
ON CONFLICT DO NOTHING;
