import generalContent from "../../../content/general.json" with { type: "json" };
import teocraticoContent from "../../../content/teocratico.json" with { type: "json" };
import type { GameMode } from "../../../shared/domain/types.js";
import { contentEntrySchema, type ContentEntry } from "../../../shared/validation/schemas.js";

const parsedGeneralContent = contentEntrySchema.array().safeParse(generalContent);
const parsedTeocraticoContent = contentEntrySchema.array().safeParse(teocraticoContent);

if (!parsedGeneralContent.success) {
  throw new Error(`El banco general incluido en la aplicación no es válido: ${parsedGeneralContent.error.message}`);
}
if (!parsedTeocraticoContent.success) {
  throw new Error(`El banco teocrático incluido en la aplicación no es válido: ${parsedTeocraticoContent.error.message}`);
}

const GENERAL_CONTENT: ContentEntry[] = parsedGeneralContent.data;
const TEOCRATICO_CONTENT: ContentEntry[] = parsedTeocraticoContent.data;

export function contentForMode(mode: GameMode): ContentEntry[] {
  return mode === "general" ? GENERAL_CONTENT : TEOCRATICO_CONTENT;
}
