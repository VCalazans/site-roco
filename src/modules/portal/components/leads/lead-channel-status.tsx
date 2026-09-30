"use client";

import type { ComponentType } from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import RemoveCircleOutlinedIcon from "@mui/icons-material/RemoveCircleOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import type { PortalLeadsDictionary } from "@/modules/portal/lib/leads-dictionary";
import { interpolate } from "@/shared/lib/interpolate";
import { describeChannel, type ChannelStatusKey, type ChannelTone } from "./leads-helpers";

/** Ícone por ESTADO (não só cor): sucesso, erro, aviso e neutro têm formas diferentes. */
const STATUS_ICON: Record<ChannelStatusKey, ComponentType<{ fontSize?: "small" }>> = {
  sent: CheckCircleIcon,
  failed: ErrorIcon,
  pending: HourglassEmptyIcon,
  not_configured: WarningAmberIcon,
  skipped: RemoveCircleOutlinedIcon,
  unknown: RemoveCircleOutlinedIcon,
};

const TONE_COLOR: Record<ChannelTone, "success" | "error" | "warning" | "default"> = {
  success: "success",
  error: "error",
  warning: "warning",
  neutral: "default",
};

type LeadChannelStatusProps = {
  /** Nome completo do canal (tooltip e leitor de tela). */
  channel: string;
  /** Rótulo curto exibido no chip. */
  shortLabel: string;
  status: string;
  error?: string | null;
  dictionary: PortalLeadsDictionary["channels"];
};

/**
 * Estado de um canal de envio (RD Station / e-mail) como chip com ícone. O
 * tooltip envolve o chip, que é um elemento HABILITADO — Tooltip em elemento
 * desabilitado é fonte de hydration mismatch no SSR do portal
 * (systemPatterns.md, micro-padrão 2). O nome acessível vem do próprio tooltip.
 */
export function LeadChannelStatus({ channel, shortLabel, status, error, dictionary }: LeadChannelStatusProps) {
  const state = describeChannel(status, error);
  const Icon = STATUS_ICON[state.status];
  const description = interpolate(dictionary.tooltip, {
    channel,
    status: dictionary.status[state.status],
  });

  return (
    <Tooltip title={description}>
      <Chip
        role="img"
        aria-label={description}
        size="small"
        variant="outlined"
        color={TONE_COLOR[state.tone]}
        icon={<Icon fontSize="small" />}
        label={shortLabel}
        sx={{ "& .MuiChip-label": { px: 0.75 } }}
      />
    </Tooltip>
  );
}
