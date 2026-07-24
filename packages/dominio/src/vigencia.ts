import { DataEfeito, DataRegistro } from "./competencia.js";

export interface ComVigencia {
  readonly dataEfeito: DataEfeito;
  readonly dataFimEfeito?: DataEfeito;
  readonly dataRegistro: DataRegistro;  // quando a versão foi PUBLICADA — o corte filtra por isto
}

/**
 * A função de resolução temporal do sistema — ÚNICA, compartilhada por regras, rubricas
 * e os seis catálogos. Semântica: entre as versões CONHECIDAS até o corte
 * (dataRegistro <= corte), a de maior dataEfeito <= em, respeitando dataFimEfeito.
 * É a maquinaria do §5.3: corte da época => "como foi pago"; corte de hoje => "como
 * deveria ser"; a subtração entre os dois é o retroativo.
 */
export function versaoVigente<V extends ComVigencia>(
  versoes: readonly V[], em: DataEfeito, corte: DataRegistro,
): V | undefined {
  let escolhida: V | undefined;
  for (const v of versoes) {
    if (v.dataRegistro > corte) continue;
    if (v.dataEfeito > em) continue;
    if (v.dataFimEfeito !== undefined && v.dataFimEfeito <= em) continue;

    const ganha =
      escolhida === undefined ||
      v.dataEfeito > escolhida.dataEfeito ||
      (v.dataEfeito === escolhida.dataEfeito && v.dataRegistro > escolhida.dataRegistro);
    if (ganha) escolhida = v;
  }
  return escolhida;
}