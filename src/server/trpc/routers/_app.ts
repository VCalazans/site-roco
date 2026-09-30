import { router } from "../init";
import { healthRouter } from "./health";
import { heroSlidesRouter } from "./hero-slides";
import { homeContentRouter } from "./home-content";
import { leadsRouter } from "./leads";
import { materialsRouter } from "./materials";
import { productsRouter } from "./products";
import { representativesRouter } from "./representatives";
import { rolesRouter } from "./roles";
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
  materials: materialsRouter,
  roles: rolesRouter,
  homeContent: homeContentRouter,
  leads: leadsRouter,
});

export type AppRouter = typeof appRouter;
