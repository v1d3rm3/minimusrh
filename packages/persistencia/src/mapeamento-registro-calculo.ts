import { Dinheiro } from "@minimusrh/dominio";
import type { FolhaId, HistoriaId, NoExplicacao, RegistroCalculo, RegraChave, RubricaChave } from "@minimusrh/dominio";

// mapeamento-registro-calculo.ts — o ponto crítico do NUMERIC ⇄ Dinheiro: SEMPRE via
// string (Dinheiro.de/.paraString), nunca por conversão numérica nativa (Roteiro §2.5.2,
// regra global #1). `NoExplicacao` é interface pura (não classe) — o JSONB
// desserializado pelo driver já satisfaz o tipo diretamente, sem reidratação.

export const SELECT_REGISTRO_CALCULO = `
  folha_id, historia_id, rubrica, versao_rubrica, regra, versao_regra, valor, explicacao
`;

export interface LinhaRegistroCalculo {
  readonly folha_id: string;
  readonly historia_id: string;
  readonly rubrica: string;
  readonly versao_rubrica: number;
  readonly regra: string;
  readonly versao_regra: number;
  readonly valor: string;
  readonly explicacao: NoExplicacao;
}

export interface ParametrosInsercaoRegistroCalculo {
  readonly folha_id: string;
  readonly historia_id: string;
  readonly rubrica: string;
  readonly versao_rubrica: number;
  readonly regra: string;
  readonly versao_regra: number;
  readonly valor: string;
  readonly explicacao: string;
}

export function linhaParaRegistroCalculo(linha: LinhaRegistroCalculo): RegistroCalculo {
  return {
    folhaId: linha.folha_id as FolhaId,
    historiaId: linha.historia_id as HistoriaId,
    rubrica: linha.rubrica as RubricaChave,
    versaoRubrica: linha.versao_rubrica,
    regra: linha.regra as RegraChave,
    versaoRegra: linha.versao_regra,
    valor: Dinheiro.de(linha.valor),
    explicacao: linha.explicacao,
  };
}

export function registroCalculoParaParametrosInsercao(registro: RegistroCalculo): ParametrosInsercaoRegistroCalculo {
  return {
    folha_id: registro.folhaId,
    historia_id: registro.historiaId,
    rubrica: registro.rubrica,
    versao_rubrica: registro.versaoRubrica,
    regra: registro.regra,
    versao_regra: registro.versaoRegra,
    valor: registro.valor.paraString(),
    explicacao: JSON.stringify(registro.explicacao),
  };
}
