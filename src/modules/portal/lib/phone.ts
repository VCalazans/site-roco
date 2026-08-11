/**
 * Re-export de `@/shared/lib/phone` — a máscara/validação de telefone BR
 * passou a ser compartilhada com o site público (pré-cadastro de
 * representantes) em 2026-08-11. Mantido para não quebrar os imports do
 * portal (`onboarding-wizard`, `personal-step`, testes).
 */
export { formatPhoneBR, isValidPhoneBR } from "@/shared/lib/phone";
