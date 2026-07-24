// regra.ts

import { DataEfeito, DataRegistro } from "./competencia.js";
import { ConsultaJanela, Contexto } from "./contexto.js";
import { Dinheiro } from "./dinheiro.js";
import { Classificacao, DerivacaoChave, HistoriaId, RegraChave, RubricaChave, TipoFatoChave, TipoFolhaChave } from "./tipos.js";
import { ComVigencia } from "./vigencia.js";

/** Espelho do cabeçalho da DSL (§7.6). No MVP, escrito à mão; no Marco 5, extraído por parse. */
export interface DeclaracaoConsumo {
  readonly derivacoes: readonly DerivacaoChave[];
  readonly rubricas: readonly RubricaChave[];
  readonly classificacoes: readonly Classificacao[];
  readonly tiposFato: readonly TipoFatoChave[];
  readonly janelas: readonly ConsultaJanela[];
}

export type EscopoRegra =
  | { readonly tipo: 'global' }
  | { readonly tipo: 'individual'; readonly historiaId: HistoriaId };  // o caso raro (§3.7)

export interface VersaoRegra extends ComVigencia {
  readonly regra: RegraChave;
  readonly versao: number;
  readonly dataEfeito: DataEfeito;
  readonly dataFimEfeito?: DataEfeito;               // "depreciada" = fim de efeito (§3.7)
  readonly dataRegistro: DataRegistro;               // publicação — sem isto, o §5.3 não existe (§1.4)
  readonly aplicaSeAFolhas: readonly TipoFolhaChave[]; // a 2ª dimensão da vigência (§3.7)
  readonly escopo: EscopoRegra;
  readonly produz: RubricaChave;                     // a tupla <valor, rubrica>
  readonly consome: DeclaracaoConsumo;               // insumo do grafo (§5.1)

  /** Guarda de aplicabilidade: falso => NÃO produz rubrica ("não se aplica" ≠ "vale zero", §7.6). */
  quando(ctx: Contexto): boolean;

  /** FUNÇÃO PURA. Sem I/O, sem relógio, sem estado — imposto pelo layout de pacotes (Roteiro §2.5.1). */
  calcular(ctx: Contexto): Dinheiro;
}