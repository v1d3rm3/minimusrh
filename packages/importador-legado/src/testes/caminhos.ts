import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// caminhos.ts — suporte de teste: os lotes de fixture em `fixtures/` (raiz do pacote).
const RAIZ_PACOTE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const LOTE_REFERENCIA = join(RAIZ_PACOTE, "fixtures", "lote-referencia");
export const LOTE_COM_REJEICOES = join(RAIZ_PACOTE, "fixtures", "lote-com-rejeicoes");
