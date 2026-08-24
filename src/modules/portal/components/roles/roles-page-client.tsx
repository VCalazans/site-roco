"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import type { PortalDictionary } from "@/modules/portal/lib/types";
import { RolesProfilesTab } from "./roles-profiles-tab";
import { RolesMatrixTab } from "./roles-matrix-tab";
import { RolesUsersTab } from "./roles-users-tab";

type RolesPageClientProps = {
  portal: PortalDictionary;
};

type TabKey = "profiles" | "matrix" | "users";

/**
 * Tela "Perfis e Permissões" (`/portal/perfis`) — 3 abas: Perfis (CRUD de
 * `roles`), Matriz de permissões (edição de `role_permissions` por perfil,
 * exceto `admin` — travado) e Usuários (atribuição via `user_roles`, com
 * busca). Gate único (`roles:manage`) já aplicado na página server; aqui só
 * a navegação entre abas. Ver decisionLog 2026-08-24 ("Perfis e permissões
 * dinâmicos").
 */
export function RolesPageClient({ portal }: RolesPageClientProps) {
  const dictionary = portal.roles;
  const [tab, setTab] = useState<TabKey>("profiles");

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        {dictionary.title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {dictionary.subtitle}
      </Typography>

      <Tabs value={tab} onChange={(_event, value: TabKey) => setTab(value)} sx={{ mb: 3 }}>
        <Tab value="profiles" label={dictionary.tabs.profiles} />
        <Tab value="matrix" label={dictionary.tabs.matrix} />
        <Tab value="users" label={dictionary.tabs.users} />
      </Tabs>

      {tab === "profiles" ? <RolesProfilesTab portal={portal} /> : null}
      {tab === "matrix" ? <RolesMatrixTab portal={portal} /> : null}
      {tab === "users" ? <RolesUsersTab portal={portal} /> : null}
    </Box>
  );
}
