import { router } from "../init";
import { healthRouter } from "./health";
import { heroSlidesRouter } from "./hero-slides";
import { productsRouter } from "./products";
import { representativesRouter } from "./representatives";
import { siteSettingsRouter } from "./site-settings";
import { syncRouter } from "./sync";

/** Router raiz do portal. */
export const appRouter = router({
  health: healthRouter,
  products: productsRouter,
  representatives: representativesRouter,
  sync: syncRouter,
  heroSlides: heroSlidesRouter,
  siteSettings: siteSettingsRouter,
});

export type AppRouter = typeof appRouter;
