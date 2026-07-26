import { Competencia, Dinheiro, dataEfeito } from "@minimusrh/dominio";
import type {
  Classificacao,
  ConsultaJanela,
  Contexto,
  DataEfeito,
  DerivacaoChave,
  RubricaChave,
  TipoFatoChave,
  TipoFolhaChave,
} from "@minimusrh/dominio";

// contexto-fake.ts — suporte de teste (NÃO é `*.test.ts`, excluído da cobertura): o
// playbook do Módulo 4 é explícito — "regras-alrn não depende de motor; use um
// contexto-fake local simples" para testar `quando()`/`calcular()` das regras. A
// fiscalização via contexto INSTRUMENTADO fica para o Módulo 5 (app-folha).
export interface ContextoFakeConfig {
  readonly competencia?: Competencia;
  readonly tipoFolha?: TipoFolhaChave;
  readonly dataReferencia?: DataEfeito;
  readonly derivacoes?: ReadonlyMap<DerivacaoChave, unknown>;
  readonly rubricas?: ReadonlyMap<RubricaChave, Dinheiro>;
  readonly somasPorClassificacao?: ReadonlyMap<Classificacao, Dinheiro>;
  readonly fatosVigentes?: ReadonlyMap<TipoFatoChave, unknown>;
  readonly agregado?: (consulta: ConsultaJanela) => Dinheiro;
  readonly contagem?: (consulta: ConsultaJanela) => number;
}

const COMPETENCIA_PADRAO = Competencia.de(2026, 7);
const TIPO_FOLHA_PADRAO = "mensal" as TipoFolhaChave;
const DATA_REFERENCIA_PADRAO = dataEfeito("2026-07-31");

export function criarContextoFake(config: ContextoFakeConfig = {}): Contexto {
  return {
    competencia: config.competencia ?? COMPETENCIA_PADRAO,
    tipoFolha: config.tipoFolha ?? TIPO_FOLHA_PADRAO,
    dataReferencia: config.dataReferencia ?? DATA_REFERENCIA_PADRAO,
    derivacao: <T,>(chave: DerivacaoChave): T | undefined => config.derivacoes?.get(chave) as T | undefined,
    rubrica: (chave: RubricaChave): Dinheiro | undefined => config.rubricas?.get(chave),
    somaDasRubricasCom: (classificacao: Classificacao): Dinheiro => config.somasPorClassificacao?.get(classificacao) ?? Dinheiro.zero(),
    agregado: (consulta: ConsultaJanela): Dinheiro => config.agregado?.(consulta) ?? Dinheiro.zero(),
    contagem: (consulta: ConsultaJanela): number => config.contagem?.(consulta) ?? 0,
    vigente: <C,>(tipo: TipoFatoChave): C | undefined => config.fatosVigentes?.get(tipo) as C | undefined,
    existe: (tipo: TipoFatoChave): boolean => config.fatosVigentes?.has(tipo) ?? false,
  };
}
