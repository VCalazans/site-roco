import { LogIn } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { portalLoginPath } from "@/core/config/site";
import type { Locale } from "@/i18n/config";

type PortalLoginLinkProps = {
  locale: Locale;
  /**
   * Nome acessível do botão — vem do dicionário, NUNCA do componente. O
   * controle é só um ícone: sem `aria-label` ele chega ao leitor de tela como
   * "link" sem nome (WCAG 4.1.2, Name/Role/Value).
   */
  label: string;
  /** `"bar"` = botão redondo com ícone; `"menu"` = linha do painel mobile. */
  variant?: "bar" | "menu";
  onSelect?: () => void;
  className?: string;
};

/**
 * Acesso DIRETO ao login do portal (`/{locale}/portal/login`).
 *
 * NÃO é o item "Portal ROCO" da nav: aquele aponta para `/{locale}/
 * representantes` (pré-cadastro público, para quem ainda não tem conta). Até
 * aqui a tela de login existia, respondia 200 e não tinha NENHUM link a partir
 * do site público — só se chegava nela pelo redirect do middleware ao tentar
 * `/portal`, ou pelo link dentro do formulário de pré-cadastro.
 *
 * Ícone `LogIn` (lucide) — não um cadeado, que sugere área bloqueada, nem um
 * avatar, que sugere conta já autenticada. Visível em TODOS os breakpoints,
 * inclusive ao lado do hambúrguer no mobile: é o destino de quem já é
 * representante e volta ao site com uma tarefa, e enterrá-lo dentro do painel
 * custaria dois toques em vez de um.
 *
 * Alvo de toque `size-10` (40×40) — passa WCAG 2.5.8 (24px, AA) e é o mesmo
 * tamanho do botão do hambúrguer, com que ele divide a barra no mobile. Fica
 * abaixo dos 44px do 2.5.5 (AAA), como o hambúrguer já ficava.
 */
export function PortalLoginLink({
  locale,
  label,
  variant = "bar",
  onSelect,
  className,
}: PortalLoginLinkProps) {
  const href = portalLoginPath(locale);

  if (variant === "menu") {
    return (
      <a
        href={href}
        onClick={onSelect}
        className={cn(
          "text-nav flex w-full items-center gap-3 rounded-xl px-4 py-3.5 uppercase text-white/85 transition-colors hover:bg-white/5 hover:text-white active:bg-white/10",
          className
        )}
      >
        <LogIn className="size-[18px] shrink-0" aria-hidden />
        {label}
      </a>
    );
  }

  return (
    <a
      href={href}
      onClick={onSelect}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/85 transition hover:border-white/30 hover:bg-white/10 hover:text-white",
        className
      )}
    >
      <LogIn className="size-[18px]" aria-hidden />
    </a>
  );
}
