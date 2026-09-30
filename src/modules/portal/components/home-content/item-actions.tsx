"use client";

import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DeleteIcon from "@mui/icons-material/Delete";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";

type ItemActionsProps = {
  index: number;
  count: number;
  onMove: (delta: -1 | 1) => void;
  /** `undefined` = a lista não permite remover (ex.: só a vitrine remove pela API). */
  onRemove?: () => void;
  moveUpLabel: string;
  moveDownLabel: string;
  removeLabel?: string;
  /** Desliga tudo (somente leitura / salvando). */
  disabled?: boolean;
  /** Desliga só o remover (ex.: lista com um único item). */
  removeDisabled?: boolean;
};

/**
 * Subir / descer / remover de um item de lista. Sem Tooltip: os botões ficam
 * `disabled` nas pontas da lista, e Tooltip em elemento desabilitado é fonte
 * de hydration mismatch no SSR do portal (systemPatterns.md, micro-padrão 2).
 * O nome acessível vem do `aria-label`, e as setas são autoexplicativas.
 */
export function ItemActions({
  index,
  count,
  onMove,
  onRemove,
  moveUpLabel,
  moveDownLabel,
  removeLabel,
  disabled = false,
  removeDisabled = false,
}: ItemActionsProps) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", flexShrink: 0 }}>
      <IconButton size="small" aria-label={moveUpLabel} disabled={disabled || index === 0} onClick={() => onMove(-1)}>
        <ArrowUpwardIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        aria-label={moveDownLabel}
        disabled={disabled || index >= count - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDownwardIcon fontSize="small" />
      </IconButton>
      {onRemove && removeLabel ? (
        <IconButton
          size="small"
          color="error"
          aria-label={removeLabel}
          disabled={disabled || removeDisabled}
          onClick={onRemove}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      ) : null}
    </Stack>
  );
}
