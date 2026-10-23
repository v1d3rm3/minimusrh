import { Dinheiro, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { Contexto, DeclaracaoConsumo, RegraChave, VersaoRegra } from "@minimusrh/dominio";
import { RUBRICA_SALARIO_BASE } from "./catalogo-rubricas.js";
import { TIPO_FOLHA_MENSAL } from "./catalogo-tipos-folha.js";
import { DERIVACAO_CARGO } from "./derivacao-cargo.js";
import { DERIVACAO_DIAS_TRABALHADOS, type DiasTrabalhados } from "./derivacao-dias-trabalhados.js";
import { DERIVACAO_PERIODOS_CARGO, type PeriodosCargo } from "./derivacao-periodos-cargo.js";

// regra-salario-base.ts — Fundação §3.6: salario_base "sofre o fator de dias trabalhados".
// DECISOES #2: a proporcionalidade é aplicada AQUI, dentro da regra — não no motor (Módulo
// 2, já fechado, que só aplica a política de arredondamento da rubrica ao resultado).
export const REGRA_SALARIO_BASE = "salario_base" as RegraChave;

// Tabela cargo→valor (dado versionado consumido pela regra). Valores INVENTADOS —
// placeholder pendente da tabela real da ALRN (ver DECISOES #6).
const TABELA_SALARIO_POR_CARGO_V1: ReadonlyMap<string, Dinheiro> = new Map([
  ["B5", Dinheiro.de("4600.00")],
  ["B6", Dinheiro.de("5000.00")],
  ["B7", Dinheiro.de("5600.00")],
  ["B8", Dinheiro.de("6200.00")],
]);

// Soma `valorIntegral` dividido em `diasNoMes` partes, `dias` vezes — só usa a API pública
// de Dinheiro (dividirPor/somar), nunca ponto flutuante (Regra Global #1).
function proporcional(valorIntegral: Dinheiro, dias: number, diasNoMes: number): Dinheiro {
  const valorPorDia = valorIntegral.dividirPor(diasNoMes);
  let total = Dinheiro.zero();
  for (let i = 0; i < dias; i += 1) {
    total = total.somar(valorPorDia);
  }
  return total;
}

function valorDoCargo(cargo: string | undefined): Dinheiro {
  const valorIntegral = cargo === undefined ? undefined : TABELA_SALARIO_POR_CARGO_V1.get(cargo);
  if (valorIntegral === undefined) {
    throw new Error(`salario_base: cargo '${cargo}' nao consta na tabela salarial vigente`);
  }
  return valorIntegral;
}

const CONSOME: DeclaracaoConsumo = {
  derivacoes: [DERIVACAO_CARGO, DERIVACAO_DIAS_TRABALHADOS],
  rubricas: [],
  classificacoes: [],
  tiposFato: [],
  janelas: [],
};

const V1: VersaoRegra = {
  regra: REGRA_SALARIO_BASE,
  versao: 1,
  dataEfeito: dataEfeito("2026-01-01"),
  dataRegistro: dataRegistro("2026-01-01T00:00:00Z"),
  aplicaSeAFolhas: [TIPO_FOLHA_MENSAL],
  escopo: { tipo: "global" },
  produz: RUBRICA_SALARIO_BASE,
  consome: CONSOME,

  quando(ctx: Contexto): boolean {
    return ctx.derivacao<string>(DERIVACAO_CARGO) !== undefined;
  },

  calcular(ctx: Contexto): Dinheiro {
    const valorIntegral = valorDoCargo(ctx.derivacao<string>(DERIVACAO_CARGO));

    const diasInfo = ctx.derivacao<DiasTrabalhados>(DERIVACAO_DIAS_TRABALHADOS);
    if (diasInfo === undefined || diasInfo.dias === diasInfo.diasNoMes) {
      return valorIntegral;
    }
    return proporcional(valorIntegral, diasInfo.dias, diasInfo.diasNoMes);
  },
};

export const REGRA_SALARIO_BASE_V1 = V1;

// V2 (DECISOES #14): a V1 pega o cargo do último dia da competência, então uma promoção no
// meio do mês paga o cargo novo no mês inteiro. A V2 soma, período a período, a fração de
// cada cargo vigente nos dias trabalhados. Mesma vigência de efeito da V1 (corrige o
// cálculo desde sempre), publicada depois: folhas fechadas com corte anterior continuam
// reproduzindo a V1 — e a diferença entre as duas vira retroativo (Fundação §5.3).
const CONSOME_V2: DeclaracaoConsumo = {
  derivacoes: [DERIVACAO_PERIODOS_CARGO],
  rubricas: [],
  classificacoes: [],
  tiposFato: [],
  janelas: [],
};

const V2: VersaoRegra = {
  ...V1,
  versao: 2,
  dataRegistro: dataRegistro("2026-10-22T00:00:00Z"),
  consome: CONSOME_V2,

  quando(ctx: Contexto): boolean {
    return ctx.derivacao<PeriodosCargo>(DERIVACAO_PERIODOS_CARGO) !== undefined;
  },

  calcular(ctx: Contexto): Dinheiro {
    const info = ctx.derivacao<PeriodosCargo>(DERIVACAO_PERIODOS_CARGO);
    if (info === undefined) {
      throw new Error("salario_base: periodos_cargo nao derivavel nesta competencia");
    }
    let total = Dinheiro.zero();
    for (const { cargo, dias } of info.periodos) {
      const valorIntegral = valorDoCargo(cargo);
      total = total.somar(dias === info.diasNoMes ? valorIntegral : proporcional(valorIntegral, dias, info.diasNoMes));
    }
    return total;
  },
};

export const REGRA_SALARIO_BASE_V2 = V2;
