import { dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { CatalogoTiposDeFato, TipoFato, TipoFatoChave } from "@minimusrh/dominio";
import { criarCatalogo } from "./catalogo-util.js";

// catalogo-tipos-fato.ts — Módulo 4 do playbook, recorte do MVP (Fundação §3.4): o
// dicionário de acontecimentos possíveis da ALRN. `posse` e `promocao` carregam o campo
// `cargo` no schema — é o que a derivação `cargo` (derivacao-cargo.ts) lê de ambos os
// tipos ("último fato de promoção/posse vigente", texto do próprio playbook).
export const TIPO_FATO_POSSE = "posse" as TipoFatoChave;
export const TIPO_FATO_EXONERACAO = "exoneracao" as TipoFatoChave;
export const TIPO_FATO_NASCIMENTO = "nascimento" as TipoFatoChave;
export const TIPO_FATO_PROMOCAO = "promocao" as TipoFatoChave;
export const TIPO_FATO_COMPROVACAO_PLANO_SAUDE = "comprovacao_plano_saude" as TipoFatoChave;

const DATA_EFEITO_V1 = dataEfeito("2026-01-01");
const DATA_REGISTRO_V1 = dataRegistro("2026-01-01T00:00:00Z");

export const CATALOGO_TIPOS_DE_FATO: readonly TipoFato[] = [
  {
    chave: TIPO_FATO_POSSE,
    alvo: "historia",
    abreHistoria: true,
    versoes: [
      {
        versao: 1,
        dataEfeito: DATA_EFEITO_V1,
        dataRegistro: DATA_REGISTRO_V1,
        exigeAmparo: false,
        schema: [{ nome: "cargo", tipo: "texto", obrigatorio: true }],
      },
    ],
  },
  {
    chave: TIPO_FATO_EXONERACAO,
    alvo: "historia",
    encerraHistoria: true,
    versoes: [
      {
        versao: 1,
        dataEfeito: DATA_EFEITO_V1,
        dataRegistro: DATA_REGISTRO_V1,
        exigeAmparo: false,
        schema: [],
      },
    ],
  },
  {
    chave: TIPO_FATO_NASCIMENTO,
    alvo: "pessoa",
    versoes: [
      {
        versao: 1,
        dataEfeito: DATA_EFEITO_V1,
        dataRegistro: DATA_REGISTRO_V1,
        exigeAmparo: false,
        // Sem campos de conteúdo: a data de nascimento É a dataEfeito do próprio fato.
        schema: [],
      },
    ],
  },
  {
    chave: TIPO_FATO_PROMOCAO,
    alvo: "historia",
    versoes: [
      {
        versao: 1,
        dataEfeito: DATA_EFEITO_V1,
        dataRegistro: DATA_REGISTRO_V1,
        // Promoção é ato legal (Fundação §3.3, exemplo "processo nº X") — exige amparo.
        exigeAmparo: true,
        schema: [{ nome: "cargo", tipo: "texto", obrigatorio: true }],
      },
    ],
  },
  {
    chave: TIPO_FATO_COMPROVACAO_PLANO_SAUDE,
    alvo: "historia",
    versoes: [
      {
        versao: 1,
        dataEfeito: DATA_EFEITO_V1,
        dataRegistro: DATA_REGISTRO_V1,
        exigeAmparo: false,
        schema: [
          { nome: "operadora", tipo: "texto", obrigatorio: true },
          { nome: "mensalidade", tipo: "dinheiro", obrigatorio: true },
          { nome: "periodo_fim", tipo: "data", obrigatorio: true },
        ],
      },
    ],
  },
];

export function criarCatalogoTiposDeFato(): CatalogoTiposDeFato {
  return criarCatalogo((tipo) => tipo.chave, CATALOGO_TIPOS_DE_FATO);
}
