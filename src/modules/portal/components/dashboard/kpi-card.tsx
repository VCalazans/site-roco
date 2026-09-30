"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";

/**
 * `default` = neutro (cor primária da marca); `warning` chama atenção para algo
 * que pede ação (produtos sem foto, cadastros para revisar); `success` marca o
 * "tudo em dia" — o mesmo indicador vira verde quando zera.
 */
export type KpiTone = "default" | "warning" | "success";

const TONE_PALETTE: Record<KpiTone, "primary" | "warning" | "success"> = {
  default: "primary",
  warning: "warning",
  success: "success",
};

type KpiCardProps = {
  icon: ReactNode;
  label: string;
  /** `undefined` enquanto carrega ou quando a consulta falhou (mostra "—"). */
  value?: string;
  hint?: string;
  href: string;
  loading: boolean;
  tone?: KpiTone;
};

/**
 * Indicador clicável do painel: o card inteiro é um link para a tela já
 * filtrada (`CardActionArea`), então o foco de teclado e o alvo de toque são o
 * card todo. O texto do link é o próprio conteúdo (rótulo + valor + dica), sem
 * `aria-label`, para o nome acessível nunca divergir do que se vê.
 */
export function KpiCard({ icon, label, value, hint, href, loading, tone = "default" }: KpiCardProps) {
  const palette = TONE_PALETTE[tone];

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: tone === "warning" ? "warning.main" : undefined,
        // Levanta o card no hover/foco sem depender só da cor da borda.
        transition: "box-shadow 150ms ease, border-color 150ms ease",
        "&:hover": { borderColor: `${palette}.main` },
      }}
    >
      <CardActionArea component={Link} href={href} sx={{ height: "100%", p: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
          <Box
            aria-hidden
            sx={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              color: `${palette}.main`,
              // Canal RGB do tema: acompanha claro/escuro sem callback de tema.
              bgcolor: `rgba(var(--mui-palette-${palette}-mainChannel) / 0.14)`,
            }}
          >
            {icon}
          </Box>

          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            {loading ? (
              <Skeleton variant="text" width={64} sx={{ fontSize: "2rem" }} />
            ) : (
              <Typography variant="h4" component="p" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
                {value ?? "—"}
              </Typography>
            )}
            {hint ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {hint}
              </Typography>
            ) : null}
          </Box>

          <ArrowForwardIcon
            aria-hidden
            fontSize="small"
            sx={{ color: "text.disabled", flexShrink: 0, mt: 0.5 }}
          />
        </Box>
      </CardActionArea>
    </Card>
  );
}
