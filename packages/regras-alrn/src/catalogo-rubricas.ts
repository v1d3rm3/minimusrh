import { dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { CatalogoRubricas, Classificacao, Rubrica, RubricaChave } from "@minimusrh/dominio";
import { criarCatalogo } from "./catalogo-util.js";

// catalogo-rubricas.ts — Fundação §3.6: "a informação de quem entra na base mora na
// rubrica, não nas regras que calculam bases". `regra-contribuicao-previdencia.ts` soma
// só pela classificação 'incide_previdencia', nunca por nome de rubrica.
export const RUBRICA_SALARIO_BASE = "salario_base" as RubricaChave;
export const RUBRICA_AUXILIO_SAUDE = "auxilio_saude" as RubricaChave;
export const RUBRICA_CONTRIBUICAO_PREVIDENCIA = "contribuicao_previdencia" as RubricaChave;

export const CLASSIFICACAO_INCIDE_PREVIDENCIA = "incide_previdencia" as Classificacao;
export const CLASSIFICACAO_COMPOE_TETO = "compoe_teto" as Classificacao;

const DATA_EFEITO_V1 = dataEfeito("2026-01-01");
const DATA_REGISTRO_V1 = dataRegistro("2026-01-01T00:00:00Z");

export const CATALOGO_RUBRICAS: readonly Rubrica[] = [
  {
    chave: RUBRICA_SALARIO_BASE,
    versoes: [
      {
        versao: 1,
        dataEfeito: DATA_EFEITO_V1,
        dataRegistro: DATA_REGISTRO_V1,
        nome: "Salário base",
        natureza: "vantagem",
        classificacoes: new Set([CLASSIFICACAO_INCIDE_PREVIDENCIA, CLASSIFICACAO_COMPOE_TETO]),
        arredondamento: "meio_para_cima",
        proporcionalizavel: true,
      },
    ],
  },
  {
    chave: RUBRICA_AUXILIO_SAUDE,
    versoes: [
      {
        versao: 1,
        dataEfeito: DATA_EFEITO_V1,
        dataRegistro: DATA_REGISTRO_V1,
        nome: "Auxílio saúde",
        natureza: "vantagem",
        // Confirmado (DECISOES): não incide previdência, não compõe teto, não proporcionalizável.
        classificacoes: new Set(),
        arredondamento: "meio_para_cima",
        proporcionalizavel: false,
      },
    ],
  },
  {
    chave: RUBRICA_CONTRIBUICAO_PREVIDENCIA,
    versoes: [
      {
        versao: 1,
        dataEfeito: DATA_EFEITO_V1,
        dataRegistro: DATA_REGISTRO_V1,
        nome: "Contribuição previdenciária",
        natureza: "desconto",
        classificacoes: new Set(),
        arredondamento: "meio_para_cima",
        proporcionalizavel: false,
      },
    ],
  },
];

export function criarCatalogoRubricas(): CatalogoRubricas {
  return criarCatalogo((rubrica) => rubrica.chave, CATALOGO_RUBRICAS);
}
