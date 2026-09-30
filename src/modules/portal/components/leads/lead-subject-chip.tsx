"use client";

import type { ComponentType } from "react";
import ListAltIcon from "@mui/icons-material/ListAlt";
import MailIcon from "@mui/icons-material/Mail";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import PhoneCallbackIcon from "@mui/icons-material/PhoneCallback";
import RequestQuoteIcon from "@mui/icons-material/RequestQuote";
import Chip, { type ChipProps } from "@mui/material/Chip";
import type { ContactSubject } from "@/server/lib/contact-submit";

/**
 * Cor E ícone por assunto: a cor sozinha não distingue os assuntos para quem
 * não enxerga bem as cores (WCAG 1.4.1), então cada um tem também um glifo
 * próprio. `Record` sobre o tipo do sistema — assunto novo sem estilo não compila.
 */
const SUBJECT_STYLE: Record<
  ContactSubject,
  { color: NonNullable<ChipProps["color"]>; Icon: ComponentType }
> = {
  cart: { color: "primary", Icon: ListAltIcon },
  quote: { color: "secondary", Icon: RequestQuoteIcon },
  call_back: { color: "success", Icon: PhoneCallbackIcon },
  general: { color: "default", Icon: MailIcon },
  catalog: { color: "info", Icon: MenuBookIcon },
};

export function LeadSubjectChip({ subject, label }: { subject: ContactSubject; label: string }) {
  const { color, Icon } = SUBJECT_STYLE[subject];
  return <Chip size="small" color={color} icon={<Icon />} label={label} sx={{ maxWidth: "100%" }} />;
}
