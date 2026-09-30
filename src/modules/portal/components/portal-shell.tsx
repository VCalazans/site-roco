"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import MenuIcon from "@mui/icons-material/Menu";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { ThemeToggle } from "@/core/theme/theme-toggle";
import type { Locale } from "@/i18n/config";
import type { PortalNavItem } from "@/modules/portal/lib/nav-items";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import {
  getSidebarCollapsedServerSnapshot,
  getSidebarCollapsedSnapshot,
  setSidebarCollapsed,
  subscribeSidebarCollapsed,
} from "./shell/sidebar-collapse-store";
import { SidebarContent } from "./shell/sidebar-content";
import { UserMenu, type PortalShellUser } from "./shell/user-menu";

// Os tipos de navegação moram em `lib/nav-items.ts` (puros, testáveis); o
// reexport mantém quem já importava daqui.
export type { PortalNavGroupKey, PortalNavItem, PortalNavKey } from "@/modules/portal/lib/nav-items";
export type { PortalShellUser } from "./shell/user-menu";

const DRAWER_WIDTH = 260;
const DRAWER_COLLAPSED_WIDTH = 72;
/** Largura máxima do conteúdo de TODAS as páginas do painel (centralizado). */
const PORTAL_CONTENT_MAX_WIDTH = 1280;

type PortalShellComponentProps = {
  /** `portal.shell` inteiro: rótulos do cabeçalho, grupos, busca, menu e toggles. */
  labels: PortalDictionary["shell"];
  /** `alt` da logo — reaproveita `dictionary.navigation.brand`. */
  logoAlt: string;
  /** Reaproveita `dictionary.navigation.{menu,close}`, já existentes nos dois
   *  locales — o portal não precisa de chaves próprias só para o hambúrguer. */
  menuLabels: { open: string; close: string };
  /** Locale da rota: destino do "Ver site" (`/{locale}`). */
  locale: Locale;
  navItems: PortalNavItem[];
  /** Destino da busca de produtos da sidebar. Só é passado a quem tem
   *  `products:read` — sem ele o campo nem é renderizado. */
  productSearchHref?: string;
  user?: PortalShellUser;
  logoutAction: () => Promise<void>;
  children: ReactNode;
};

/**
 * Shell do Portal Interno: AppBar fixa + Drawer lateral (permanente em `md+`,
 * temporário/hambúrguer abaixo disso) + menu de usuário. Todo texto chega por
 * props, vindas do dicionário (`portal.shell.*`) — as páginas montam tudo com
 * `buildPortalShellProps` (`lib/shell-props.ts`); o shell em si não importa
 * `getDictionary`.
 *
 * Sidebar colapsável (pedido do stakeholder, 2026-08-23): recolhida = só
 * ícones (72px), persistida por navegador (`sidebar-collapse-store.ts`). O
 * drawer mobile é sempre expandido.
 */
export function PortalShell({
  labels,
  logoAlt,
  menuLabels,
  locale,
  navItems,
  productSearchHref,
  user,
  logoutAction,
  children,
}: PortalShellComponentProps) {
  const pathname = usePathname();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const collapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    getSidebarCollapsedServerSnapshot
  );
  const drawerWidth = collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH;

  // O drawer temporário fica `display: none` em `md+`, mas isso NÃO desmonta o
  // Modal: com `open` preso em `true` ele continuaria travando a rolagem do
  // body e marcando o resto da página como `aria-hidden`, sem nenhum controle
  // visível para fechar. Ao cruzar o breakpoint (girar o tablet, redimensionar
  // a janela) o estado é zerado aqui — padrão "ajustar estado durante o
  // render", condicional, sem efeito.
  if (isDesktop && mobileOpen) {
    setMobileOpen(false);
  }

  // --- Foco na busca (Ctrl/⌘ + K e ícone do modo recolhido) ----------------
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  // Pedidos de foco que dependem de algo montar primeiro (o campo do desktop só
  // existe com a sidebar expandida; o do mobile só depois do drawer abrir).
  const pendingDesktopFocus = useRef(false);
  const pendingMobileFocus = useRef(false);

  useEffect(() => {
    if (!collapsed && pendingDesktopFocus.current) {
      pendingDesktopFocus.current = false;
      desktopSearchRef.current?.focus();
    }
  }, [collapsed]);

  function focusProductSearch() {
    if (isDesktop) {
      if (collapsed) {
        pendingDesktopFocus.current = true;
        setSidebarCollapsed(false);
      } else {
        desktopSearchRef.current?.focus();
        desktopSearchRef.current?.select();
      }
    } else {
      pendingMobileFocus.current = true;
      setMobileOpen(true);
    }
  }

  // Recria o listener a cada render: ele precisa enxergar `collapsed`/
  // `isDesktop` atuais, e o custo (um add/removeEventListener) é irrisório.
  useEffect(() => {
    if (!productSearchHref) return;
    function onKeyDown(event: KeyboardEvent) {
      const isShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "k";
      if (!isShortcut) return;
      // Sobrescreve o atalho do navegador (Ctrl+K = barra de endereço), como
      // fazem GitHub/Slack: aqui ele significa "buscar".
      event.preventDefault();
      focusProductSearch();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh" }}>
      <Box
        component="a"
        href="#portal-main"
        sx={(t) => ({
          position: "absolute",
          left: 8,
          top: -64,
          zIndex: t.zIndex.tooltip + 1,
          px: 2,
          py: 1,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          color: "text.primary",
          fontSize: 14,
          "&:focus": { top: 8 },
        })}
      >
        {labels.skipToContent}
      </Box>

      <AppBar
        position="fixed"
        color="default"
        elevation={0}
        sx={(t) => ({
          // Acima do drawer só em `md+`, onde o drawer permanente fica AO LADO
          // da barra (sem sobreposição). No mobile a barra tem de ficar ABAIXO
          // do drawer temporário (modal, z-index `drawer`): com o valor alto em
          // todos os tamanhos ela cobria o topo do menu aberto — logo e botão de
          // fechar inalcançáveis.
          zIndex: { md: t.zIndex.drawer + 1 },
          borderBottom: "1px solid",
          borderColor: "divider",
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          transition: t.transitions.create(["width", "margin"], {
            easing: t.transitions.easing.sharp,
            duration: t.transitions.duration.shorter,
          }),
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        })}
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
            title={collapsed ? labels.sidebar.expand : labels.sidebar.collapse}
            placement="bottom"
          >
            <IconButton
              aria-label={collapsed ? labels.sidebar.expand : labels.sidebar.collapse}
              aria-expanded={!collapsed}
              onClick={() => setSidebarCollapsed(!collapsed)}
              sx={{ display: { xs: "none", md: "inline-flex" } }}
            >
              {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
          </Tooltip>

          <Box sx={{ flexGrow: 1 }} />

          {/* Abre o site público (`/{locale}`) numa nova aba: quem edita a home
              ou um produto confere o resultado sem perder o lugar no painel.
              Rótulo visível a partir de `sm`; no xs vira só o ícone (mesmo
              nome acessível nos dois). */}
          <Button
            href={`/${locale}`}
            target="_blank"
            rel="noopener noreferrer"
            color="inherit"
            size="small"
            aria-label={labels.viewSite.aria}
            startIcon={<OpenInNewIcon fontSize="small" />}
            sx={{ display: { xs: "none", sm: "inline-flex" } }}
          >
            {labels.viewSite.label}
          </Button>
          <IconButton
            href={`/${locale}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={labels.viewSite.aria}
            sx={{ display: { xs: "inline-flex", sm: "none" } }}
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>

          <ThemeToggle labels={labels.themeToggle} />

          <UserMenu
            user={user}
            profileLabel={labels.userMenu.profile}
            logoutLabel={labels.userMenu.logout}
            logoutAction={logoutAction}
          />
        </Toolbar>
      </AppBar>

      <Box
        sx={(t) => ({
          width: { md: drawerWidth },
          flexShrink: { md: 0 },
          transition: t.transitions.create("width", {
            easing: t.transitions.easing.sharp,
            duration: t.transitions.duration.shorter,
          }),
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        })}
      >
        {/* Mobile: sempre expandido, com o campo de busca e o botão de fechar. */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          slotProps={{
            root: { keepMounted: true },
            // Ctrl+K no mobile abre o drawer e só então foca o campo (antes o
            // input ainda está oculto e o foco cairia no vazio).
            transition: {
              onEntered: () => {
                if (pendingMobileFocus.current) {
                  pendingMobileFocus.current = false;
                  mobileSearchRef.current?.focus();
                }
              },
            },
          }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          <SidebarContent
            labels={labels}
            logoAlt={logoAlt}
            navItems={navItems}
            pathname={pathname}
            productSearchHref={productSearchHref}
            searchInputRef={mobileSearchRef}
            onNavigate={() => setMobileOpen(false)}
            onClose={() => setMobileOpen(false)}
            closeLabel={menuLabels.close}
          />
        </Drawer>

        <Drawer
          variant="permanent"
          open
          sx={(t) => ({
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              overflowX: "hidden",
              transition: t.transitions.create("width", {
                easing: t.transitions.easing.sharp,
                duration: t.transitions.duration.shorter,
              }),
              "@media (prefers-reduced-motion: reduce)": { transition: "none" },
            },
          })}
        >
          <SidebarContent
            labels={labels}
            logoAlt={logoAlt}
            navItems={navItems}
            pathname={pathname}
            collapsed={collapsed}
            productSearchHref={productSearchHref}
            searchInputRef={desktopSearchRef}
            onNavigate={() => {}}
            onExpandRequest={focusProductSearch}
          />
        </Drawer>
      </Box>

      <Box
        component="main"
        id="portal-main"
        tabIndex={-1}
        sx={(t) => ({
          flexGrow: 1,
          // Sem isso um filho largo (tabela) estica a coluna flex além da tela.
          minWidth: 0,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          p: { xs: 2, sm: 3, md: 4 },
          outline: "none",
          transition: t.transitions.create("width", {
            easing: t.transitions.easing.sharp,
            duration: t.transitions.duration.shorter,
          }),
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        })}
      >
        <Toolbar />
        {/* Conteúdo CENTRALIZADO numa largura única para todas as telas do
            painel: antes cada página definia a própria largura alinhada à
            esquerda (1200px no painel/boas-vindas, 100% nas tabelas) e o
            conteúdo "pulava" de lugar a cada navegação. */}
        <Box sx={{ width: "100%", maxWidth: PORTAL_CONTENT_MAX_WIDTH, mx: "auto" }}>{children}</Box>
      </Box>
    </Box>
  );
}
