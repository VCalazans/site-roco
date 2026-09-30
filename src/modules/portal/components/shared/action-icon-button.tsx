"use client";

import type { ReactNode } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

type ActionIconButtonProps = {
  /** Texto curto do tooltip ("Baixar original"). */
  label: string;
  /** Nome acessível completo, quando o rótulo sozinho é ambíguo numa lista ("Baixar original: 1122.png"). */
  ariaLabel?: string;
  icon: ReactNode;
  disabled?: boolean;
  color?: "default" | "primary" | "error";
} & ({ onClick: () => void; href?: never } | { href: string; onClick?: () => void });

/**
 * Botão de ícone das telas do portal: nome acessível sempre, tooltip só
 * quando HABILITADO — em elemento desabilitado o MUI avisa e o clone do filho
 * diverge na hidratação (ver "Micro-padrões" em systemPatterns.md). Com
 * `href`, vira um link (downloads: o navegador salva o arquivo da rota).
 */
export function ActionIconButton({
  label,
  ariaLabel,
  icon,
  disabled = false,
  color = "default",
  onClick,
  href,
}: ActionIconButtonProps) {
  const button = href ? (
    <IconButton size="small" color={color} component="a" href={href} onClick={onClick} aria-label={ariaLabel ?? label} disabled={disabled}>
      {icon}
    </IconButton>
  ) : (
    <IconButton size="small" color={color} onClick={onClick} aria-label={ariaLabel ?? label} disabled={disabled}>
      {icon}
    </IconButton>
  );

  return disabled ? button : <Tooltip title={label}>{button}</Tooltip>;
}
