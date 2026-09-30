"use client";

import { useState } from "react";
import LogoutIcon from "@mui/icons-material/Logout";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";

export type PortalShellUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type UserMenuProps = {
  user?: PortalShellUser;
  /** Nome acessível do botão do avatar (`portal.shell.userMenu.profile`). */
  profileLabel: string;
  logoutLabel: string;
  logoutAction: () => Promise<void>;
};

/**
 * Menu da conta: cabeçalho com nome e e-mail de quem está logado (antes era um
 * item desabilitado "Meu Perfil", que não dizia quem era o usuário) e a ação
 * de sair.
 */
export function UserMenu({ user, profileLabel, logoutLabel, logoutAction }: UserMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const displayName = user?.name?.trim() || user?.email || "";
  const initials = (displayName || "?").charAt(0).toUpperCase();

  return (
    <>
      <IconButton
        aria-label={profileLabel}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ ml: 0.5 }}
      >
        <Avatar
          src={user?.image ?? undefined}
          alt=""
          sx={{ width: 32, height: 32, fontSize: 14 }}
        >
          {!user?.image ? initials : null}
        </Avatar>
      </IconButton>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 240, maxWidth: 320 } } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" noWrap>
            {displayName}
          </Typography>
          {user?.name && user.email ? (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
              {user.email}
            </Typography>
          ) : null}
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            // Server Action chamada direto do event handler — não precisa
            // de <form> (ver logout-action.ts).
            void logoutAction();
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          {logoutLabel}
        </MenuItem>
      </Menu>
    </>
  );
}
