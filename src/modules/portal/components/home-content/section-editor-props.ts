import type { Locale } from "@/i18n/config";
import type { PortalHomeContentDictionary } from "@/modules/portal/lib/home-content-dictionary";
import type {
  EditableSection,
  FieldErrors,
  HomeEditorDefaults,
  SectionFormMap,
} from "./home-editor-model";

/** Contrato comum dos cinco editores de seção (controlados: o estado vive na página). */
export type SectionEditorProps<K extends EditableSection> = {
  form: SectionFormMap[K];
  onChange: (next: SectionFormMap[K]) => void;
  /** Idioma da interface do painel (não confundir com PT/EN do conteúdo). */
  locale: Locale;
  defaults: HomeEditorDefaults;
  errors: FieldErrors;
  /** Campos desligados: somente leitura (sem `home_content:update`) OU salvando. */
  disabled: boolean;
  /** Só a permissão: sem ela, o envio de imagem some (não basta desabilitar). */
  readOnly: boolean;
  dictionary: PortalHomeContentDictionary;
  /** Chave R2 → URL pública (imagens salvas + as enviadas nesta sessão). */
  imageUrls: Readonly<Record<string, string>>;
  onImageUrl: (key: string, url: string) => void;
};

/** Monta o par `{ pt, en }` de padrões que os campos localizados esperam. */
export function pairOf(pick: (locale: Locale) => string): Record<Locale, string> {
  return { pt: pick("pt"), en: pick("en") };
}
