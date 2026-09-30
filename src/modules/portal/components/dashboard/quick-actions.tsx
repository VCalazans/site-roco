"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Typography from "@mui/material/Typography";

export type QuickAction = {
  key: string;
  icon: ReactNode;
  label: string;
  hint: string;
  href: string;
  /** Abre em nova aba (o site público sai do portal). */
  external?: boolean;
};

type QuickActionsProps = {
  title: string;
  actions: QuickAction[];
};

const AREA_SX = {
  height: "100%",
  p: 2,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  gap: 1.5,
  textAlign: "left",
} as const;

function ActionBody({ action }: { action: QuickAction }) {
  return (
    <>
      <Box aria-hidden sx={{ color: "primary.main", display: "flex", mt: 0.25 }}>
        {action.icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {action.label}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {action.hint}
        </Typography>
      </Box>
    </>
  );
}

/**
 * Atalhos do painel: as tarefas que o operador mais repete (cadastrar produto,
 * editar a home, mexer no hero, conferir o site). Cada atalho aparece só se a
 * sessão tem a permissão da tela de destino — decidido pelo chamador.
 */
export function QuickActions({ title, actions }: QuickActionsProps) {
  if (actions.length === 0) return null;

  return (
    <Box component="section" aria-labelledby="dashboard-quick-actions">
      <Typography
        id="dashboard-quick-actions"
        variant="subtitle1"
        component="h2"
        sx={{ fontWeight: 600, mb: 1.5 }}
      >
        {title}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        {actions.map((action) => (
          <Card key={action.key} variant="outlined">
            {action.external ? (
              <CardActionArea
                component="a"
                href={action.href}
                target="_blank"
                rel="noopener noreferrer"
                sx={AREA_SX}
              >
                <ActionBody action={action} />
              </CardActionArea>
            ) : (
              <CardActionArea component={Link} href={action.href} sx={AREA_SX}>
                <ActionBody action={action} />
              </CardActionArea>
            )}
          </Card>
        ))}
      </Box>
    </Box>
  );
}
