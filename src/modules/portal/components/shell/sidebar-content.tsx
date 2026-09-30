"use client";

import type { Ref } from "react";
import Link from "next/link";
import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import type { PortalNavItem } from "@/modules/portal/lib/nav-items";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { PortalLogo } from "@/modules/portal/components/shared/portal-logo";
import { NavList } from "./nav-list";
import { SidebarSearch } from "./sidebar-search";

type SidebarContentProps = {
  labels: PortalDictionary["shell"];
  /** `alt` da logo — `dictionary.navigation.brand`. */
  logoAlt: string;
  navItems: PortalNavItem[];
  pathname: string | null;
  /** Modo só-ícones (72px). O drawer mobile é SEMPRE expandido. */
  collapsed?: boolean;
  /** Presente só para quem tem `products:read` — sem ele não há busca. */
  productSearchHref?: string;
  searchInputRef?: Ref<HTMLInputElement>;
  onNavigate: () => void;
  /** Ícone de busca do modo recolhido: expandir a sidebar e focar o campo. */
  onExpandRequest?: () => void;
  /** Só no drawer mobile: botão de fechar no cabeçalho. */
  onClose?: () => void;
  closeLabel?: string;
};

/**
 * Conteúdo da sidebar (cabeçalho com a logo, busca de produtos e navegação
 * agrupada), compartilhado pelos dois drawers do shell — o permanente (`md+`)
 * e o temporário do mobile.
 */
export function SidebarContent({
  labels,
  logoAlt,
  navItems,
  pathname,
  collapsed = false,
  productSearchHref,
  searchInputRef,
  onNavigate,
  onExpandRequest,
  onClose,
  closeLabel,
}: SidebarContentProps) {
  const homeHref = navItems.find((item) => item.key === "dashboard")?.href ?? "/";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Toolbar
        sx={{
          gap: 1.5,
          flexShrink: 0,
          justifyContent: collapsed ? "center" : "flex-start",
          px: collapsed ? 1 : undefined,
        }}
      >
        <Box
          component={Link}
          href={homeHref}
          onClick={onNavigate}
          aria-label={labels.appName}
          sx={{ display: "inline-flex", alignItems: "center", gap: 1.5, textDecoration: "none" }}
        >
          <PortalLogo alt={logoAlt} width={collapsed ? 44 : 72} />
          {collapsed ? null : (
            <Typography
              variant="overline"
              component="span"
              sx={{
                color: "text.secondary",
                lineHeight: 1,
                letterSpacing: "0.12em",
                fontWeight: 600,
                pl: 1.5,
                borderLeft: "1px solid",
                borderColor: "divider",
              }}
            >
              {labels.brandCaption}
            </Typography>
          )}
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        {onClose ? (
          <IconButton aria-label={closeLabel} onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        ) : null}
      </Toolbar>
      <Divider />

      {productSearchHref ? (
        <Box sx={{ pt: 1.5, flexShrink: 0 }}>
          <SidebarSearch
            href={productSearchHref}
            labels={labels.search}
            collapsed={collapsed}
            onExpandRequest={onExpandRequest}
            onSubmitted={onNavigate}
            inputRef={searchInputRef}
          />
        </Box>
      ) : null}

      <NavList
        navItems={navItems}
        groupLabels={labels.navGroups}
        navLabel={labels.navLabel}
        comingSoonLabel={labels.comingSoon}
        pathname={pathname}
        onNavigate={onNavigate}
        collapsed={collapsed}
      />
    </Box>
  );
}
