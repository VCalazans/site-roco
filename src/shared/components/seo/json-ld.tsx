import { serializeJsonLd } from "@/modules/ai/lib/json-ld";

/**
 * `<script type="application/ld+json">` de um ou mais nós schema.org. Server
 * Component: o JSON sai no HTML inicial (robôs não executam JS). O conteúdo
 * passa por `serializeJsonLd`, que impede um valor de fechar a tag.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON serializado e escapado por `serializeJsonLd`.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
