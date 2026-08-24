"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import CloseIcon from "@mui/icons-material/Close";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ImageIcon from "@mui/icons-material/Image";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import PeopleIcon from "@mui/icons-material/People";
import PersonIcon from "@mui/icons-material/Person";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import WavingHandIcon from "@mui/icons-material/WavingHand";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { ThemeToggle, type ThemeToggleLabels } from "@/core/theme/theme-toggle";

const DRAWER_WIDTH = 260;
const DRAWER_COLLAPSED_WIDTH = 72;
const SIDEBAR_COLLAPSE_STORAGE_KEY = "portal_sidebar_collapsed";

export type PortalNavKey =
  | "dashboard"
  | "onboarding"
  | "products"
  | "representatives"
  | "welcome"
  | "hero"
  | "materials"
  | "roles";

export type PortalNavItem = {
  key: PortalNavKey;
  label: string;
  href: string;
  /** Item "em breve" — desabilitado no drawer, mostra `comingSoonLabel`. */
  disabled?: boolean;
};

type PortalUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type PortalShellProps = {
  appName: string;
  /** `alt` do logotipo — reaproveita `dictionary.navigation.brand`. */
  logoAlt: string;
  navItems: PortalNavItem[];
  comingSoonLabel: string;
  /** Reaproveita `dictionary.navigation.{menu,close}`, já existentes nos dois
   *  locales — o portal não precisa de chaves próprias só para o hambúrguer. */
  menuLabels: { open: string; close: string };
  themeToggleLabels: ThemeToggleLabels;
  userMenu: { profileLabel: string; logoutLabel: string };
  /** Sessão do usuário — ainda não disponível nesta onda (depende de
   *  `@/core/auth`, em construção em paralelo). `undefined` cai no avatar
   *  com iniciais placeholder. */
  user?: PortalUser;
  logoutAction: () => Promise<void>;
  children: ReactNode;
};

const NAV_ICONS: Record<PortalNavKey, ComponentType<{ fontSize?: "small" }>> = {
  dashboard: DashboardIcon,
  onboarding: RocketLaunchIcon,
  products: Inventory2Icon,
  representatives: PeopleIcon,
  welcome: WavingHandIcon,
  hero: ImageIcon,
  materials: LibraryBooksIcon,
  roles: AdminPanelSettingsIcon,
};

function DrawerHeader({
  appName,
  logoAlt,
  onClose,
  closeLabel,
}: {
  appName: string;
  logoAlt: string;
  onClose?: () => void;
  closeLabel?: string;
}) {
  return (
    <Toolbar sx={{ gap: 1.5 }}>
      <Image src="/images/hero/roco-logo.png" alt={logoAlt} width={28} height={28} />
      <Typography
        variant="subtitle1"
        noWrap
        sx={{ flexGrow: 1, fontWeight: 700 }}
      >
        {appName}
      </Typography>
      {onClose ? (
        <IconButton aria-label={closeLabel} onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      ) : null}
    </Toolbar>
  );
}

function NavList({
  navItems,
  comingSoonLabel,
  pathname,
  onNavigate,
  collapsed = false,
}: {
  navItems: PortalNavItem[];
  comingSoonLabel: string;
  pathname: string | null;
  onNavigate: () => void;
  /**
   * `true` no modo colapsado (WEG-style — só ícones, largura 72px). Omite o
   * rótulo e o sublabel; centraliza o botão. O tooltip nativo do botão
   * aparece no hover (acessibilidade sem desperdiçar 192px de coluna).
   */
  collapsed?: boolean;
}) {
  return (
    <List sx={{ flexGrow: 1, p: collapsed ? 0.5 : 0 }}>
      {navItems.map((item) => {
        const Icon = NAV_ICONS[item.key];
        const selected = pathname === item.href;

        if (collapsed) {
          return (
            <ListItem
              key={item.key}
              disablePadding
              sx={{ display: "flex", justifyContent: "center" }}
            >
              <Tooltip title={item.label} placement="right">
                <ListItemButton
                  component={Link}
                  href={item.href}
                  disabled={item.disabled}
                  selected={selected}
                  onClick={onNavigate}
                  sx={{
                    minHeight: 44,
                    width: 44,
                    borderRadius: 1,
                    justifyContent: "center",
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 0, justifyContent: "center" }}>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        }

        return (
          <ListItem key={item.key} disablePadding>
            <ListItemButton
              component={Link}
              href={item.href}
              disabled={item.disabled}
              selected={selected}
              onClick={onNavigate}
            >
              <ListItemIcon>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                secondary={item.disabled ? comingSoonLabel : undefined}
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}

/**
 * Shell do Portal Interno: AppBar fixa + Drawer lateral (permanente em `md+`,
 * temporário/hambúrguer abaixo disso) + menu de usuário. Todo texto chega por
 * props, vindas do dicionário (`portal.shell.*`) nas páginas que consomem
 * este componente — o shell em si não importa `getDictionary`.
 */
export function PortalShell({
  appName,
  logoAlt,
  navItems,
  comingSoonLabel,
  menuLabels,
  themeToggleLabels,
  userMenu,
  user,
  logoutAction,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<HTMLElement | null>(
    null
  );

  /**
   * Sidebar colapsável (solicitação do stakeholder 2026-08-23).
   *  - Default: expandido.
   *  - Persistido por usuário em `localStorage` (chave
   *    `portal_sidebar_collapsed`) — sobrevive a refresh e a troca de aba.
   *  - Inicialização LAZY em `useState` (lê o localStorage na primeira
   *    renderização no client) — evita o `setState` em `useEffect` que a
   *    regra `react-hooks/set-state-in-effect` proíbe e o flash de drawer
   *    expandido que ocorreria se hidratássemos via efeito.
   *  - O toggle fica no AppBar (desktop `md+`); no mobile usa o botão
   *    hambúrguer existente que abre o drawer temporário — não muda.
   */
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === "true";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  const initials = (user?.name ?? user?.email ?? "?").trim().charAt(0).toUpperCase();
  const drawerWidth = collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH;

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh" }}>
      <AppBar
        position="fixed"
        color="default"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            aria-label={menuLabels.open}
            onClick={() => setMobileOpen(true)}
            edge="start"
            sx={{ display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Tooltip
            title={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
            placement="bottom"
          >
            <IconButton
              aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
              onClick={() => setCollapsed((c) => !c)}
              sx={{ display: { xs: "none", md: "inline-flex" } }}
            >
              {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
          </Tooltip>

          <Box sx={{ flexGrow: 1 }} />

          <ThemeToggle labels={themeToggleLabels} />

          <IconButton
            aria-label={userMenu.profileLabel}
            onClick={(event) => setUserMenuAnchor(event.currentTarget)}
            sx={{ ml: 1 }}
          >
            <Avatar
              src={user?.image ?? undefined}
              sx={{ width: 32, height: 32, fontSize: 14 }}
            >
              {!user?.image ? initials : null}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={userMenuAnchor}
            open={Boolean(userMenuAnchor)}
            onClose={() => setUserMenuAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem disabled>
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              {userMenu.profileLabel}
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                setUserMenuAnchor(null);
                // Server Action chamada direto do event handler — não precisa
                // de <form> (ver logout-action.ts).
                void logoutAction();
              }}
            >
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              {userMenu.logoutLabel}
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" },
          }}
        >
          <DrawerHeader
            appName={appName}
            logoAlt={logoAlt}
            onClose={() => setMobileOpen(false)}
            closeLabel={menuLabels.close}
          />
          <Divider />
          <NavList
            navItems={navItems}
            comingSoonLabel={comingSoonLabel}
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
            collapsed={collapsed}
          />
        </Drawer>

        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" },
          }}
        >
          <DrawerHeader appName={appName} logoAlt={logoAlt} />
          <Divider />
          <NavList
            navItems={navItems}
            comingSoonLabel={comingSoonLabel}
            pathname={pathname}
            onNavigate={() => {}}
            collapsed={collapsed}
          />
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          p: { xs: 2, sm: 3, md: 4 },
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
