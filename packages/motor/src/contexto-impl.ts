import { Dinheiro, versaoVigente } from "@minimusrh/dominio";
import type {
  Classificacao,
  Competencia,
  Contexto,
  ConsultaJanela,
  DataEfeito,
  DataRegistro,
  DerivacaoChave,
  LinhaDoTempo,
  RegistroDeDerivacoes,
  RubricaChave,
  TipoFatoChave,
  TipoFolhaChave,
  VersaoRubrica,
} from "@minimusrh/dominio";

// contexto-impl.ts — implementação de `Contexto` (Design §6) sobre `LinhaDoTempo`,
// `RegistroDeDerivacoes`, os valores de rubrica já calculados NESTA execução, e um
// `LeitorDeJanelas` injetado. Nunca expõe `LinhaDoTempo` crua à regra (Design §11 decisão
// 6) — só pelas quatro portas.

/**
 * Implementação real fica para o Módulo 5 (app-folha), sobre `registro_calculo` de folhas
 * FECHADAS (Fundacao §7.3: janela olha o passado selado). Aqui é sempre injetada.
 */
export interface LeitorDeJanelas {
  agregado(consulta: ConsultaJanela): Dinheiro;
  contagem(consulta: ConsultaJanela): number;
}

export interface ParametrosContexto {
  readonly linha: LinhaDoTempo;
  readonly competencia: Competencia;
  readonly tipoFolha: TipoFolhaChave;
  readonly dataReferencia: DataEfeito;
  /** Corte de conhecimento da folha — usado para resolver a versão vigente de cada derivação. */
  readonly corte: DataRegistro;
  readonly registroDeDerivacoes: RegistroDeDerivacoes;
  readonly rubricasResolvidas: ReadonlyMap<RubricaChave, VersaoRubrica>;
  /**
   * Mapa MUTÁVEL: o motor escreve aqui conforme cada regra é executada, na ordem do
   * grafo. `criarContexto` captura a referência, não uma cópia — regras posteriores do
   * mesmo história enxergam, via `rubrica()`/`somaDasRubricasCom()`, os valores já
   * produzidos por regras anteriores na mesma execução (Design §6, porta 2).
   */
  readonly rubricasCalculadas: ReadonlyMap<RubricaChave, Dinheiro>;
  readonly leitorJanelas: LeitorDeJanelas;
}

export function criarContexto(params: ParametrosContexto): Contexto {
  return {
    competencia: params.competencia,
    tipoFolha: params.tipoFolha,
    dataReferencia: params.dataReferencia,

    derivacao<T>(chave: DerivacaoChave): T | undefined {
      const derivacao = params.registroDeDerivacoes.porChave(chave);
      if (derivacao === undefined) return undefined;
      const versao = versaoVigente(derivacao.versoes, params.dataReferencia, params.corte);
      if (versao === undefined) return undefined;
      return versao.derivar(params.linha, params.dataReferencia, params.competencia) as T | undefined;
    },

    rubrica(chave: RubricaChave): Dinheiro | undefined {
      return params.rubricasCalculadas.get(chave);
    },

    somaDasRubricasCom(c: Classificacao): Dinheiro {
      let total = Dinheiro.zero();
      for (const [chave, valor] of params.rubricasCalculadas) {
        const versaoRubrica = params.rubricasResolvidas.get(chave);
        if (versaoRubrica !== undefined && versaoRubrica.classificacoes.has(c)) {
          total = total.somar(valor);
        }
      }
      return total;
    },

    agregado(consulta: ConsultaJanela): Dinheiro {
      return params.leitorJanelas.agregado(consulta);
    },

    contagem(consulta: ConsultaJanela): number {
      return params.leitorJanelas.contagem(consulta);
    },

    vigente<C>(tipo: TipoFatoChave): C | undefined {
      return params.linha.vigenteEm<C>(tipo, params.dataReferencia)?.conteudo;
    },

    existe(tipo: TipoFatoChave): boolean {
      return params.linha.vigenteEm(tipo, params.dataReferencia) !== undefined;
    },
  };
}
