"use client";

import { useMemo } from "react";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import HideImageIcon from "@mui/icons-material/HideImage";
import InboxIcon from "@mui/icons-material/Inbox";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import StarIcon from "@mui/icons-material/Star";
import ViewCarouselIcon from "@mui/icons-material/ViewCarousel";
import WebIcon from "@mui/icons-material/Web";
import AddIcon from "@mui/icons-material/Add";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/core/trpc-client";
import type { Locale } from "@/i18n/config";
import { can, type PortalPermissionUser } from "@/modules/portal/lib/permissions";
import { buildProductsHref } from "@/modules/portal/lib/product-filters";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { interpolate } from "@/shared/lib/interpolate";
import { CatalogHealthCard } from "./dashboard/catalog-health-card";
import { KpiCard } from "./dashboard/kpi-card";
import { QuickActions, type QuickAction } from "./dashboard/quick-actions";
import { RecentLeadsCard } from "./dashboard/recent-leads-card";

type DashboardSummaryProps = {
  portal: PortalDictionary;
  user: PortalPermissionUser;
  locale: Locale;
};

/**
 * Corpo do dashboard (spec 001, RF28): indicadores clicáveis, atalhos,
 * solicitações recentes e saúde do catálogo. Cada bloco — e cada consulta —
 * depende da MESMA permissão que dá acesso à tela de destino (`products:read`,
 * `representatives:read`, `leads:read`, ...): o gate aqui é só de UX, o
 * servidor (`permissionProcedure`) continua sendo o guarda real, e a consulta
 * nem é disparada (`enabled`) sem a permissão.
 *
 * Os números vêm de agregações no servidor (`products.stats`,
 * `representatives.stats`, `leads.stats`) — nada é contado no client.
 */
export function DashboardSummary({ portal, user, locale }: DashboardSummaryProps) {
  const trpc = useTRPC();
  const dictionary = portal.dashboard;
  const basePath = `/${locale}/portal`;
  const productsPath = `${basePath}/produtos`;

  const canReadProducts = can(user, "products", "read");
  const canCreateProduct = can(user, "products", "create");
  const canReadRepresentatives = can(user, "representatives", "read");
  const canReadLeads = can(user, "leads", "read");
  const canEditHome = can(user, "home_content", "read");
  const canManageHero = can(user, "hero_slides", "read");

  const productsStats = useQuery(
    trpc.products.stats.queryOptions(undefined, { enabled: canReadProducts })
  );
  const representativesStats = useQuery(
    trpc.representatives.stats.queryOptions(undefined, { enabled: canReadRepresentatives })
  );
  const leadsStats = useQuery(trpc.leads.stats.queryOptions(undefined, { enabled: canReadLeads }));

  const formatNumber = useMemo(() => {
    const formatter = new Intl.NumberFormat(locale);
    return (value: number | undefined) => (value === undefined ? undefined : formatter.format(value));
  }, [locale]);

  const products = productsStats.data;
  const reviews = representativesStats.data?.submitted;
  const leads = leadsStats.data;

  const hasAnyIndicator = canReadProducts || canReadRepresentatives || canReadLeads;
  const hasLoadError =
    (canReadProducts && productsStats.isError) ||
    (canReadRepresentatives && representativesStats.isError) ||
    (canReadLeads && leadsStats.isError);

  const quickActions: QuickAction[] = [];
  if (canCreateProduct) {
    quickActions.push({
      key: "newProduct",
      icon: <AddIcon />,
      label: dictionary.quickActions.newProduct.label,
      hint: dictionary.quickActions.newProduct.hint,
      href: buildProductsHref(productsPath, {}, { openNew: true }),
    });
  }
  if (canEditHome) {
    quickActions.push({
      key: "editHome",
      icon: <WebIcon />,
      label: dictionary.quickActions.editHome.label,
      hint: dictionary.quickActions.editHome.hint,
      href: `${basePath}/pagina-inicial`,
    });
  }
  if (canManageHero) {
    quickActions.push({
      key: "manageHero",
      icon: <ViewCarouselIcon />,
      label: dictionary.quickActions.manageHero.label,
      hint: dictionary.quickActions.manageHero.hint,
      href: `${basePath}/hero`,
    });
  }
  quickActions.push({
    key: "viewSite",
    icon: <OpenInNewIcon />,
    label: dictionary.quickActions.viewSite.label,
    hint: dictionary.quickActions.viewSite.hint,
    href: `/${locale}`,
    external: true,
  });

  const showBottomRow = canReadLeads || canReadProducts;
  const bottomColumns =
    canReadLeads && canReadProducts
      ? { xs: "1fr", lg: "minmax(0, 3fr) minmax(0, 2fr)" }
      : { xs: "1fr" };

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      {hasLoadError ? <Alert severity="warning">{dictionary.partialError}</Alert> : null}

      {!hasAnyIndicator ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">{dictionary.emptyState}</Typography>
        </Paper>
      ) : (
        <Box
          component="section"
          aria-label={dictionary.indicatorsLabel}
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
          }}
        >
          {canReadProducts ? (
            <>
              <KpiCard
                icon={<Inventory2Icon />}
                label={dictionary.kpis.published.label}
                value={formatNumber(products?.published)}
                hint={
                  products
                    ? interpolate(dictionary.kpis.published.hint, {
                        total: formatNumber(products.total) ?? products.total,
                      })
                    : undefined
                }
                href={buildProductsHref(productsPath, { status: "published" })}
                loading={productsStats.isLoading}
              />
              <KpiCard
                icon={<StarIcon />}
                label={dictionary.kpis.featured.label}
                value={formatNumber(products?.featured)}
                hint={dictionary.kpis.featured.hint}
                href={buildProductsHref(productsPath, { quick: ["featured"] })}
                loading={productsStats.isLoading}
              />
              <KpiCard
                icon={<EmojiEventsIcon />}
                label={dictionary.kpis.bestSeller.label}
                value={formatNumber(products?.bestSeller)}
                hint={dictionary.kpis.bestSeller.hint}
                href={buildProductsHref(productsPath, { quick: ["bestSeller"] })}
                loading={productsStats.isLoading}
              />
              <KpiCard
                icon={<HideImageIcon />}
                label={dictionary.kpis.noPhoto.label}
                value={formatNumber(products?.publishedWithoutImage)}
                hint={
                  products
                    ? products.publishedWithoutImage > 0
                      ? dictionary.kpis.noPhoto.hint
                      : dictionary.kpis.noPhoto.ok
                    : undefined
                }
                tone={products ? (products.publishedWithoutImage > 0 ? "warning" : "success") : "default"}
                href={buildProductsHref(productsPath, { status: "published", quick: ["noImage"] })}
                loading={productsStats.isLoading}
              />
            </>
          ) : null}

          {canReadRepresentatives ? (
            <KpiCard
              icon={<PendingActionsIcon />}
              label={dictionary.kpis.reviews.label}
              value={formatNumber(reviews)}
              hint={
                reviews === undefined
                  ? undefined
                  : reviews > 0
                    ? dictionary.kpis.reviews.hint
                    : dictionary.kpis.reviews.ok
              }
              tone={reviews === undefined ? "default" : reviews > 0 ? "warning" : "success"}
              href={`${basePath}/representantes`}
              loading={representativesStats.isLoading}
            />
          ) : null}

          {canReadLeads ? (
            <KpiCard
              icon={<InboxIcon />}
              label={dictionary.kpis.leads.label}
              value={formatNumber(leads?.lastDays)}
              hint={
                leads
                  ? interpolate(dictionary.kpis.leads.hint, { days: leads.windowDays })
                  : undefined
              }
              href={`${basePath}/solicitacoes`}
              loading={leadsStats.isLoading}
            />
          ) : null}
        </Box>
      )}

      <QuickActions title={dictionary.quickActions.title} actions={quickActions} />

      {showBottomRow ? (
        <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: bottomColumns }}>
          {canReadLeads ? (
            <RecentLeadsCard
              dictionary={dictionary.recentLeads}
              locale={locale}
              viewAllHref={`${basePath}/solicitacoes`}
              leads={leads?.recent}
              loading={leadsStats.isLoading}
              error={leadsStats.isError}
              errorLabel={portal.errors.generic}
            />
          ) : null}
          {canReadProducts ? (
            <CatalogHealthCard
              dictionary={dictionary.health}
              stats={products}
              loading={productsStats.isLoading}
              error={productsStats.isError}
              errorLabel={portal.errors.generic}
              noPhotoHref={buildProductsHref(productsPath, {
                status: "published",
                quick: ["noImage"],
              })}
              unpublishedHref={buildProductsHref(productsPath, { status: "unpublished" })}
            />
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
