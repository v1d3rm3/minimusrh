import { Competencia, DataEfeito } from "./competencia.js";
import { Dinheiro } from "./dinheiro.js";
import { RubricaChave, Classificacao, TipoFolhaChave, DerivacaoChave, TipoFatoChave } from "./tipos.js";

/** Consulta de janela: os quatro eixos da consolidação (§5.4) como leitura (§7.3, forma 3). */
export interface ConsultaJanela {
  readonly agregacao: 'soma' | 'media' | 'contagem';
  readonly sobre: { readonly rubrica: RubricaChave } | { readonly classificacao: Classificacao };
  readonly competencias: 'corrente' | 'anterior' | { readonly ultimas: number } | 'ano_civil';
  readonly tiposDeFolha: readonly TipoFolhaChave[] | 'todas';
}

/**
 * TUDO que uma regra pode enxergar. Não há outra porta (§7.1: "enxerga só o contexto").
 * Implementado pelo motor; instrumentável em teste para validar a declaração de consumo (§7.4 abaixo).
 */
export interface Contexto {
  readonly competencia: Competencia;
  readonly tipoFolha: TipoFolhaChave;
  readonly dataReferencia: DataEfeito;

  // 1. Derivações de instante
  derivacao<T>(chave: DerivacaoChave): T | undefined;

  // 2. Rubricas da folha corrente (já calculadas — o grafo garante a ordem)
  rubrica(chave: RubricaChave): Dinheiro | undefined;
  somaDasRubricasCom(c: Classificacao): Dinheiro;

  // 3. Fatos financeiros agregados sobre janela (folhas FECHADAS — §7.3)
  agregado(consulta: ConsultaJanela): Dinheiro;
  contagem(consulta: ConsultaJanela): number;

  // 4. Conteúdo de fato vigente na data de referência
  vigente<C>(tipo: TipoFatoChave): C | undefined;
  existe(tipo: TipoFatoChave): boolean;
}