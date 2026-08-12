"use client";

import { useContactForm } from "@/shared/components/contact-form";

type QuoteCtaButtonProps = {
  label: string;
};

/**
 * "Solicitar orçamento" no detalhe do produto — abre o MESMO modal de contato
 * (Mautic, id=1) usado pelo nav (`SiteHeader`/`NavItems`), via
 * `useContactForm()`. Isolado num Client Component pequeno para que
 * `ProductDetailView` (o resto da página) continue Server.
 */
export function QuoteCtaButton({ label }: QuoteCtaButtonProps) {
  const { open } = useContactForm();

  return (
    <button type="button" onClick={open} className="btn-neon-grad w-fit">
      {label}
    </button>
  );
}
