ALTER TABLE "products" ADD COLUMN "featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "featured_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "best_seller" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Spec 001 (RF09): o selo legado `top` ("Mais vendido", coluna @TOP da planilha)
-- vira a flag `best_seller` ("Campeão de vendas"). A informação é copiada ANTES
-- do DELETE, na mesma transação do migrator — nada se perde. O valor `top`
-- continua existindo no enum `product_badge` (Postgres não remove valor de enum
-- sem recriar o tipo); a UI simplesmente deixa de oferecê-lo.
UPDATE "products" SET "best_seller" = true
WHERE EXISTS (
  SELECT 1 FROM "product_badges" pb
  WHERE pb."product_id" = "products"."id" AND pb."badge" = 'top'
);--> statement-breakpoint
DELETE FROM "product_badges" WHERE "badge" = 'top';
