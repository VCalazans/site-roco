import { router } from "../init";
import { healthRouter } from "./health";
import { productsRouter } from "./products";
import { representativesRouter } from "./representatives";
import { syncRouter } from "./sync";

/** Router raiz do portal. */
export const appRouter = router({
  health: healthRouter,
  products: productsRouter,
  representatives: representativesRouter,
  sync: syncRouter,
});

export type AppRouter = typeof appRouter;
