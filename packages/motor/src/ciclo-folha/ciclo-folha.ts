import { TRANSICOES } from "@minimusrh/dominio";
import type { Amparo, Autor, DataRegistro, EstadoFolha, Folha, TransicaoFolha } from "@minimusrh/dominio";
import { ErroTransicaoFolha } from "./erro-transicao-folha.js";

/**
 * É fundamental que uma folha possa ser recalculada a qualquer momento. Para que isso aconteça, 
 * é necessário que ela seja executada nas mesmas condições em que foi executada da última vez,
 * caso já tenha sido executada. 
 * 
 * Essa função permite estabelecer "quando" a folha deve ser executada para gerar os mesmos 
 * resultados.
 * 
 * @param folha 
 * @param para 
 * @param instante 
 * @returns 
 */
function calcularCorte(folha: Folha, para: EstadoFolha, instante: DataRegistro): DataRegistro | undefined {
  if (para === "em_conferencia") return instante;
  if (folha.estado === "em_conferencia" && para === "aberta") return undefined;
  return folha.corte;
}

/**
 * Transita uma folha de um estado para outro.
 * 
 * @param folha 
 * @param para 
 * @param autor 
 * @param instante 
 * @param amparo 
 * @returns 
 */
export function transitar(
  folha: Folha,
  para: EstadoFolha,
  autor: Autor,
  instante: DataRegistro,
  amparo?: Amparo,
): { readonly folha: Folha; readonly transicao: TransicaoFolha } | ErroTransicaoFolha {
  const legais = TRANSICOES[folha.estado];
  if (!legais.includes(para)) {
    return {
      erro: "transicao_ilegal",
      de: folha.estado,
      para,
      mensagem: `transição ilegal: '${folha.estado}' → '${para}' (permitidas a partir de '${folha.estado}': ${
        legais.length > 0 ? legais.join(", ") : "nenhuma — estado terminal"
      })`,
    };
  }

  const folhaNova: Folha = { ...folha, estado: para, corte: calcularCorte(folha, para, instante) };
  const transicao: TransicaoFolha = {
    folhaId: folha.id,
    de: folha.estado,
    para,
    instante,
    autor,
    ...(amparo !== undefined ? { amparo } : {}),
  };

  return { folha: folhaNova, transicao };
}
