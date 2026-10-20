import { Dinheiro, versaoVigente } from "@minimusrh/dominio";
import type {
  Classificacao,
  Competencia,
  Contexto,
  ConsultaJanela,
  DataEfeito,
  DataRegistro,
  DerivacaoChave,
  Fato,
  FatoId,
  HistoriaId,
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
 * Implementação real em `app-folha` (Módulo 5), sobre `registro_calculo` de folhas
 * FECHADAS (Fundacao §7.3: janela olha o passado selado). Aqui é sempre injetada.
 *
 * Recebe a `historiaId` além da consulta: `ConsultaJanela` (dominio) não carrega história
 * — a regra pergunta "o que ESTA história recebeu", e só o motor sabe qual é a história
 * corrente (DECISOES #12).
 */
export interface LeitorDeJanelas {
  agregado(historiaId: HistoriaId, consulta: ConsultaJanela): Dinheiro;
  contagem(historiaId: HistoriaId, consulta: ConsultaJanela): number;
}

/** Proveniência de UMA leitura de derivação: qual versão respondeu e com base em quais fatos. */
export interface ProvenienciaDerivacao {
  readonly chave: DerivacaoChave;
  /** `undefined` quando a chave não tem implementação ou versão vigente — a leitura devolveu `undefined`. */
  readonly versao: number | undefined;
  readonly valor: unknown;
  /** Fatos que a derivação consultou na `LinhaDoTempo`, sem repetição, na ordem da consulta. */
  readonly fatos: readonly FatoId[];
}

/**
 * Canal lateral de proveniência (DECISOES #13): `Contexto` devolve só valores (Design §11
 * decisão 6), então quem precisa citar FATOS na explicação observa as leituras aqui, sem
 * que a regra veja nada além do de sempre.
 */
export interface ObservadorDeLeituras {
  derivacaoLida(proveniencia: ProvenienciaDerivacao): void;
  /** Leitura direta de fato pela regra (`vigente`/`existe`); `undefined` = nenhum fato vigente. */
  fatoLido(tipo: TipoFatoChave, fatoId: FatoId | undefined): void;
  /** `somaDasRubricasCom`: o total e as parcelas que o compõem, na ordem de cálculo. */
  classificacaoLida(classificacao: Classificacao, total: Dinheiro, parcelas: readonly ParcelaClassificacao[]): void;
}

export interface ParcelaClassificacao {
  readonly rubrica: RubricaChave;
  readonly valor: Dinheiro;
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
  readonly observador?: ObservadorDeLeituras;
}

/**
 * Decorator de `LinhaDoTempo` que anota todo fato devolvido. `todosDoTipo` anota a lista
 * inteira — a derivação pode ter escolhido só um deles, mas todos foram insumo da escolha.
 */
function rastrearFatos(linha: LinhaDoTempo, consultados: Set<FatoId>): LinhaDoTempo {
  function anotar<F extends Fato | undefined>(fato: F): F {
    if (fato !== undefined) consultados.add(fato.id);
    return fato;
  }
  return {
    historiaId: linha.historiaId,
    corte: linha.corte,
    vigenteEm: <C>(tipo: TipoFatoChave, em: DataEfeito) => anotar(linha.vigenteEm<C>(tipo, em)),
    todosDoTipo: <C>(tipo: TipoFatoChave) => {
      const fatos = linha.todosDoTipo<C>(tipo);
      for (const fato of fatos) consultados.add(fato.id);
      return fatos;
    },
    aberturaDaHistoria: () => anotar(linha.aberturaDaHistoria()),
    encerramentoDaHistoria: () => anotar(linha.encerramentoDaHistoria()),
  };
}

export function criarContexto(params: ParametrosContexto): Contexto {
  return {
    competencia: params.competencia,
    tipoFolha: params.tipoFolha,
    dataReferencia: params.dataReferencia,

    derivacao<T>(chave: DerivacaoChave): T | undefined {
      const derivacao = params.registroDeDerivacoes.porChave(chave);
      const versao = derivacao === undefined ? undefined : versaoVigente(derivacao.versoes, params.dataReferencia, params.corte);
      if (versao === undefined) {
        params.observador?.derivacaoLida({ chave, versao: undefined, valor: undefined, fatos: [] });
        return undefined;
      }
      const consultados = new Set<FatoId>();
      const linha = params.observador === undefined ? params.linha : rastrearFatos(params.linha, consultados);
      const valor = versao.derivar(linha, params.dataReferencia, params.competencia) as T | undefined;
      params.observador?.derivacaoLida({ chave, versao: versao.versao, valor, fatos: [...consultados] });
      return valor;
    },

    rubrica(chave: RubricaChave): Dinheiro | undefined {
      return params.rubricasCalculadas.get(chave);
    },

    somaDasRubricasCom(c: Classificacao): Dinheiro {
      let total = Dinheiro.zero();
      const parcelas: ParcelaClassificacao[] = [];
      for (const [chave, valor] of params.rubricasCalculadas) {
        const versaoRubrica = params.rubricasResolvidas.get(chave);
        if (versaoRubrica !== undefined && versaoRubrica.classificacoes.has(c)) {
          total = total.somar(valor);
          parcelas.push({ rubrica: chave, valor });
        }
      }
      params.observador?.classificacaoLida(c, total, parcelas);
      return total;
    },

    agregado(consulta: ConsultaJanela): Dinheiro {
      return params.leitorJanelas.agregado(params.linha.historiaId, consulta);
    },

    contagem(consulta: ConsultaJanela): number {
      return params.leitorJanelas.contagem(params.linha.historiaId, consulta);
    },

    vigente<C>(tipo: TipoFatoChave): C | undefined {
      const fato = params.linha.vigenteEm<C>(tipo, params.dataReferencia);
      params.observador?.fatoLido(tipo, fato?.id);
      return fato?.conteudo;
    },

    existe(tipo: TipoFatoChave): boolean {
      const fato = params.linha.vigenteEm(tipo, params.dataReferencia);
      params.observador?.fatoLido(tipo, fato?.id);
      return fato !== undefined;
    },
  };
}
