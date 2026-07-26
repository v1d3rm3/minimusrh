import { dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { CatalogoAmparos, TipoAmparo, TipoAmparoChave } from "@minimusrh/dominio";
import { criarCatalogo } from "./catalogo-util.js";

// catalogo-amparos.ts — Design Domínio §2.1: o formato de identificador é vocabulário da
// instituição, versionado como sexto catálogo. Máscara copiada LITERALMENTE do exemplo do
// próprio Design §2.1 (a notação `999/9999` do playbook é só a descrição informal do
// mesmo formato — ver DECISOES).
export const TIPO_AMPARO_PROCESSO = "processo" as TipoAmparoChave;

export const CATALOGO_AMPAROS: readonly TipoAmparo[] = [
  {
    chave: TIPO_AMPARO_PROCESSO,
    versoes: [
      {
        versao: 1,
        dataEfeito: dataEfeito("2026-01-01"),
        dataRegistro: dataRegistro("2026-01-01T00:00:00Z"),
        mascara: "^(\\d{1,4})\\/(\\d{4})$",
        grupos: [
          { nome: "numero", tipo: "numero" },
          { nome: "ano", tipo: "ano" },
        ],
        formatoCanonico: "{numero}/{ano}",
        exemplo: "123/2026",
      },
    ],
  },
];

export function criarCatalogoAmparos(): CatalogoAmparos {
  return criarCatalogo((tipo) => tipo.chave, CATALOGO_AMPAROS);
}
