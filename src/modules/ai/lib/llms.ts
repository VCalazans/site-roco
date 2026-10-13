import type { Dictionary } from "@/i18n/get-dictionary";
import { toInternationalPhone } from "@/modules/ai/lib/json-ld";
import { interpolate } from "@/shared/lib/interpolate";

/**
 * `llms.txt` e `llms-full.txt` (proposta llmstxt.org) — spec 003.
 *
 * Módulo PURO: recebe tudo resolvido (dicionário, contato do rodapé,
 * catálogo) e devolve markdown. Links sempre absolutos, sem HTML, sem dado
 * pessoal (só o contato comercial público do rodapé).
 */

export type LlmsCategory = { name: string; count: number; url: string };
export type LlmsProduct = { sku: string; name: string; categories: string[]; url: string };

export type LlmsInput = {
  copy: Dictionary["ai"]["llms"];
  organization: Dictionary["ai"]["organization"];
  brand: string;
  description: string;
  productLines: string[];
  categories: LlmsCategory[];
  contact: { email: string; phone: string; addressHeadquarters: string; addressPlant: string };
  profiles: string[];
  urls: {
    site: string;
    home: string;
    products: string;
    about: string;
    contact: string;
    representatives: string;
    catalog: string;
    full: string;
    mcp: string;
  };
  mcpTools: string[];
};

/** Uma linha de markdown não pode quebrar a lista: sem quebras nem espaços duplos. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function link(label: string, url: string): string {
  return `[${oneLine(label).replace(/[[\]]/g, "")}](${url})`;
}

function sections(input: LlmsInput): string[] {
  const { copy, organization, urls } = input;
  const lines: string[] = [];

  lines.push(`# ${input.brand}`, "");
  lines.push(
    `> ${oneLine(interpolate(copy.summary, { legalName: organization.legalName, foundingYear: organization.foundingYear }))}`,
    ""
  );
  lines.push(oneLine(organization.homonyms), "");
  lines.push(interpolate(copy.officialSite, { url: urls.site }), "");
  lines.push(oneLine(input.description), "");

  if (input.productLines.length > 0) {
    lines.push(`## ${copy.linesTitle}`, "");
    lines.push(...input.productLines.map((line) => `- ${oneLine(line)}`), "");
  }

  if (input.categories.length > 0) {
    lines.push(`## ${copy.categoriesTitle}`, "");
    lines.push(
      ...input.categories.map(
        (category) => `- ${link(category.name, category.url)}: ${category.count === 1 ? copy.categoryLineOne : interpolate(copy.categoryLine, { count: category.count })}`
      ),
      ""
    );
  }

  lines.push(`## ${copy.howToBuyTitle}`, "");
  lines.push(
    ...copy.howToBuy.map(
      (item) =>
        `- ${interpolate(item, {
          contactUrl: urls.contact,
          catalogUrl: urls.catalog,
          representativesUrl: urls.representatives,
        })}`
    ),
    ""
  );

  const phone = toInternationalPhone(input.contact.phone) ?? "";
  const contactLines = [
    input.contact.email ? interpolate(copy.contactEmail, { email: input.contact.email }) : "",
    phone ? interpolate(copy.contactPhone, { phone }) : "",
    input.contact.addressHeadquarters ? interpolate(copy.contactHeadquarters, { address: oneLine(input.contact.addressHeadquarters) }) : "",
    input.contact.addressPlant ? interpolate(copy.contactPlant, { address: oneLine(input.contact.addressPlant) }) : "",
    ...input.profiles,
  ].filter(Boolean);
  if (contactLines.length > 0) {
    lines.push(`## ${copy.contactTitle}`, "");
    lines.push(...contactLines.map((line) => `- ${line}`), "");
  }

  lines.push(`## ${copy.mcpTitle}`, "");
  lines.push(interpolate(copy.mcp, { mcpUrl: urls.mcp, tools: input.mcpTools.join(", ") }), "");

  lines.push(`## ${copy.notForTitle}`, "");
  lines.push(oneLine(copy.notFor), "");

  lines.push(`## ${copy.pagesTitle}`, "");
  lines.push(
    `- ${link(copy.pages.home, urls.home)}`,
    `- ${link(copy.pages.products, urls.products)}`,
    `- ${link(copy.pages.about, urls.about)}`,
    `- ${link(copy.pages.contact, urls.contact)}`,
    `- ${link(copy.pages.representatives, urls.representatives)}`,
    ""
  );

  return lines;
}

export function buildLlmsTxt(input: LlmsInput): string {
  const lines = sections(input);
  lines.push(interpolate(input.copy.fullVersion, { url: input.urls.full }), "");
  return lines.join("\n");
}

export function buildLlmsFullTxt(input: LlmsInput, products: LlmsProduct[]): string {
  const lines = sections(input);
  lines.push(`## ${input.copy.productsTitle}`, "");
  lines.push(oneLine(input.copy.productsIntro), "");
  lines.push(
    ...products.map((product) => {
      const categories = product.categories.length > 0 ? ` — ${product.categories.map(oneLine).join(", ")}` : "";
      return `- ${link(`${product.sku} — ${product.name}`, product.url)}${categories}`;
    }),
    ""
  );
  return lines.join("\n");
}
