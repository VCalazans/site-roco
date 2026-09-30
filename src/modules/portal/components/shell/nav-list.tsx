"use client";

import { Fragment, useId, type ComponentType } from "react";
import Link from "next/link";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import DashboardIcon from "@mui/icons-material/Dashboard";
import InboxIcon from "@mui/icons-material/Inbox";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import PeopleIcon from "@mui/icons-material/People";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import SettingsIcon from "@mui/icons-material/Settings";
import ViewCarouselIcon from "@mui/icons-material/ViewCarousel";
import WavingHandIcon from "@mui/icons-material/WavingHand";
import WebIcon from "@mui/icons-material/Web";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Tooltip from "@mui/material/Tooltip";
import {
  groupPortalNavItems,
  isPortalNavItemActive,
  type PortalNavGroupKey,
  type PortalNavItem,
  type PortalNavKey,
} from "@/modules/portal/lib/nav-items";

const NAV_ICONS: Record<PortalNavKey, ComponentType<{ fontSize?: "small" }>> = {
  dashboard: DashboardIcon,
  welcome: WavingHandIcon,
  onboarding: RocketLaunchIcon,
  products: Inventory2Icon,
  leads: InboxIcon,
  representatives: PeopleIcon,
  homeContent: WebIcon,
  hero: ViewCarouselIcon,
  materials: LibraryBooksIcon,
  settings: SettingsIcon,
  roles: AdminPanelSettingsIcon,
};

type NavListProps = {
  navItems: PortalNavItem[];
  groupLabels: Record<PortalNavGroupKey, string>;
  /** `aria-label` do landmark `<nav>` (`portal.shell.navLabel`). */
  navLabel: string;
  comingSoonLabel: string;
  pathname: string | null;
  onNavigate: () => void;
  /**
   * `true` no modo recolhido (só ícones, 72px): os títulos de grupo viram
   * divisores e o rótulo aparece num tooltip. O tooltip nativo do botão
   * substitui os 192px de texto sem perder a acessibilidade (o nome do link
   * continua sendo o rótulo do item).
   */
  collapsed?: boolean;
};

/**
 * Lista de navegação da sidebar, agrupada (`ListSubheader`). Grupos sem itens
 * visíveis para a sessão são omitidos por `groupPortalNavItems`.
 */
export function NavList({
  navItems,
  groupLabels,
  navLabel,
  comingSoonLabel,
  pathname,
  onNavigate,
  collapsed = false,
}: NavListProps) {
  const baseId = useId();
  const groups = groupPortalNavItems(navItems);

  return (
    <Box
      component="nav"
      aria-label={navLabel}
      sx={{
        flexGrow: 1,
        overflowY: "auto",
        overflowX: "hidden",
        px: collapsed ? 0.5 : 1.5,
        pb: 2,
      }}
    >
      {groups.map((group, index) => {
        const headerId = `${baseId}-${group.key}`;
        return (
          <Fragment key={group.key}>
            {collapsed && index > 0 ? <Divider sx={{ my: 1, mx: 1 }} /> : null}
            <List
              disablePadding
              aria-labelledby={collapsed ? undefined : headerId}
              aria-label={collapsed ? groupLabels[group.key] : undefined}
              subheader={
                collapsed ? undefined : (
                  <ListSubheader
                    id={headerId}
                    disableSticky
                    sx={{
                      bgcolor: "transparent",
                      px: 1.5,
                      pt: index === 0 ? 1 : 2,
                      pb: 0.75,
                      lineHeight: 1.2,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "text.secondary",
                    }}
                  >
                    {groupLabels[group.key]}
                  </ListSubheader>
                )
              }
            >
              {group.items.map((item) => (
                <NavEntry
                  key={item.key}
                  item={item}
                  active={isPortalNavItemActive(pathname, item)}
                  collapsed={collapsed}
                  comingSoonLabel={comingSoonLabel}
                  onNavigate={onNavigate}
                />
              ))}
            </List>
          </Fragment>
        );
      })}
    </Box>
  );
}

function NavEntry({
  item,
  active,
  collapsed,
  comingSoonLabel,
  onNavigate,
}: {
  item: PortalNavItem;
  active: boolean;
  collapsed: boolean;
  comingSoonLabel: string;
  onNavigate: () => void;
}) {
  const Icon = NAV_ICONS[item.key];

  const button = (
    <ListItemButton
      component={Link}
      href={item.href}
      disabled={item.disabled}
      selected={active}
      aria-current={active ? "page" : undefined}
      // Recolhido não há texto visível: o nome do link vem daqui (o Tooltip
      // repete o mesmo valor, mas não existe em item desabilitado).
      aria-label={collapsed ? item.label : undefined}
      onClick={onNavigate}
      sx={{
        position: "relative",
        minHeight: 44,
        borderRadius: 1.5,
        px: collapsed ? 0 : 1.5,
        justifyContent: collapsed ? "center" : "flex-start",
        ...(collapsed ? { width: 44, mx: "auto" } : null),
        // Filete de acento do item ativo: reforça a seleção sem depender só
        // do tom de fundo (que some em contraste baixo no tema claro).
        "&.Mui-selected::before": {
          content: '""',
          position: "absolute",
          left: 0,
          top: 9,
          bottom: 9,
          width: 3,
          borderRadius: 2,
          bgcolor: "primary.main",
        },
      }}
    >
      <ListItemIcon
        sx={{
          minWidth: 0,
          mr: collapsed ? 0 : 1.5,
          justifyContent: "center",
          color: active ? "primary.main" : "text.secondary",
        }}
      >
        <Icon fontSize="small" />
      </ListItemIcon>
      {collapsed ? null : (
        <ListItemText
          primary={item.label}
          secondary={item.disabled ? comingSoonLabel : undefined}
          slotProps={{
            primary: { noWrap: true, sx: { fontSize: 14, fontWeight: active ? 600 : 500 } },
          }}
        />
      )}
    </ListItemButton>
  );

  return (
    <ListItem disablePadding sx={{ display: "block", mb: 0.25 }}>
      {/* Tooltip só no modo recolhido e nunca em item desabilitado (o MUI
          avisa, e no SSR o clone do filho desabilitado diverge — ver
          "Micro-padrões" em memory-bank/systemPatterns.md). */}
      {collapsed && !item.disabled ? (
        <Tooltip title={item.label} placement="right">
          {button}
        </Tooltip>
      ) : (
        button
      )}
    </ListItem>
  );
}
