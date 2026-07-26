import { Dinheiro, Percentual } from "@minimusrh/dominio";

// tabela-progressiva.ts — utilitário puro por trás de `aplica tabela_progressiva(...) sobre
// base` (Fundação §7.8: "alíquotas marginais — previdência/IR sem escadinhas de se"). Cada
// faixa tributa só a fatia de `base` que cai dentro dela (cálculo marginal, não "alíquota
// única sobre o total"). Implementado só com a API pública de Dinheiro/Percentual — nunca
// toca em `number` bruto para dinheiro (Regra Global #1).
//
// Convenção de fronteira: uma faixa "até X" inclui X (um valor exatamente igual ao limite
// pertence à faixa em que esse limite aparece, não à faixa seguinte) — mesmo estilo das
// tabelas do conceitual (ex.: "0 a 29", "30 a 39").
export interface FaixaProgressiva {
  readonly ate: Dinheiro | "infinito";
  readonly aliquota: Percentual;
}

export function aplicarTabelaProgressiva(faixas: readonly FaixaProgressiva[], base: Dinheiro): Dinheiro {
  let limiteAnterior = Dinheiro.zero();
  let total = Dinheiro.zero();

  for (const faixa of faixas) {
    const limiteSuperior = faixa.ate === "infinito" ? base : faixa.ate.menorEntre(base);
    const porcaoNestaFaixa = limiteSuperior.subtrair(limiteAnterior);

    if (!porcaoNestaFaixa.ehNegativo() && !porcaoNestaFaixa.ehZero()) {
      total = total.somar(porcaoNestaFaixa.vezes(faixa.aliquota));
    }

    limiteAnterior = limiteSuperior;
    if (faixa.ate === "infinito") break;
  }

  return total;
}
