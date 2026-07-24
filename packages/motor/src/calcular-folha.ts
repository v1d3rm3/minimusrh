import { Dinheiro } from "@minimusrh/dominio";
import type {
  Catalogo,
  Competencia,
  DataEfeito,
  DataRegistro,
  FolhaId,
  FonteExplicacao,
  HistoriaId,
  LinhaDoTempo,
  NoExplicacao,
  RegistroDeDerivacoes,
  RegraChave,
  RegistroCalculo,
  Rubrica,
  RubricaChave,
  TipoFolhaChave,
  VersaoRegra,
} from "@minimusrh/dominio";
import { type LeitorDeJanelas, criarContexto } from "./contexto-impl.js";
import { instrumentar, type Leitura } from "./contexto-instrumentado.js";
import { montarGrafo, type ErroCiclo } from "./grafo.js";
import { resolverParaExecucao } from "./resolucao.js";

// calcular-folha.ts — a função central do motor (Fundacao §5.2), PURA: nenhuma leitura de
// relógio, nenhum I/O. Toda referência temporal chega em `entrada` (Regra Global #2 do
// playbook).

export interface NaoAplicavel {
  readonly historiaId: HistoriaId;
  readonly regra: RegraChave;
  readonly versao: number;
}

export type ErroCalculoFolha =
  | { readonly tipo: "ciclo"; readonly erro: ErroCiclo }
  | { readonly tipo: "excecao"; readonly historiaId: HistoriaId; readonly regra: RegraChave; readonly mensagem: string };

export interface ResultadoCalculo {
  readonly registros: readonly RegistroCalculo[];
  readonly naoAplicaveis: readonly NaoAplicavel[];
  readonly erros: readonly ErroCalculoFolha[];
}

export interface EntradaCalculoFolha {
  readonly folhaId: FolhaId;
  readonly competencia: Competencia;
  readonly tipoFolha: TipoFolhaChave;
  readonly corte: DataRegistro;
  readonly historias: readonly LinhaDoTempo[];
  readonly regras: ReadonlyMap<RegraChave, readonly VersaoRegra[]>;
  readonly rubricas: Catalogo<RubricaChave, Rubrica>;
  readonly derivacoes: RegistroDeDerivacoes;
  readonly leitorJanelas: LeitorDeJanelas;
}

/**
 * §5.2 passo 1: uma história participa se já abriu (dataEfeito da abertura <= referência) e
 * ainda não encerrou (sem encerramento, ou encerramento com dataEfeito > referência).
 * `situacao_funcional = ativo`, citado no conceitual como EXEMPLO, é uma derivação da ALRN
 * — motor não pode conhecê-la (Regra Global #3). Mecanismo genérico equivalente, só com os
 * métodos estruturais de LinhaDoTempo: decisão registrada em DECISOES-IMPLEMENTACAO.md.
 */
function participa(linha: LinhaDoTempo, dataReferencia: DataEfeito): boolean {
  const abertura = linha.aberturaDaHistoria();
  if (abertura.dataEfeito > dataReferencia) return false;
  const encerramento = linha.encerramentoDaHistoria();
  if (encerramento !== undefined && encerramento.dataEfeito <= dataReferencia) return false;
  return true;
}

/**
 * `regra.escopo` é a guarda "individual vs. global" (Design §3.7) — decidida por história,
 * então não faz parte de `resolucao.ts` (que resolve uma vez, para a folha inteira).
 */
function aplicavelAHistoria(regra: VersaoRegra, historiaId: HistoriaId): boolean {
  return regra.escopo.tipo === "global" || regra.escopo.historiaId === historiaId;
}

/**
 * NoExplicacao é construída a partir do log de leituras do contexto instrumentado
 * (bullet do playbook: "o contexto instrumentado fornece a matéria-prima da árvore").
 * Limitação registrada em DECISOES: só derivação e rubrica viram FonteExplicacao — 'fato'
 * exigiria o FatoId, que Contexto.vigente()/existe() não expõem (Design §11 decisão 6:
 * Contexto nunca dá acesso à LinhaDoTempo crua); 'tabela' é insumo de regras concretas
 * (Módulo 4), fora do vocabulário genérico do motor.
 */
function construirExplicacao(regra: VersaoRegra, rubricaChave: RubricaChave, valor: Dinheiro, leituras: readonly Leitura[]): NoExplicacao {
  const fontes: FonteExplicacao[] = [];
  for (const leitura of leituras) {
    if (leitura.eixo === "derivacao" && leitura.valor !== undefined) {
      fontes.push({ tipo: "derivacao", chave: leitura.chave, valor: String(leitura.valor) });
    }
    if (leitura.eixo === "rubrica" && leitura.valor !== undefined) {
      fontes.push({ tipo: "rubrica", chave: leitura.chave, valor: leitura.valor.paraString() });
    }
  }
  return {
    descricao: `regra '${regra.regra}' v${regra.versao} calcula '${rubricaChave}'`,
    valor: valor.paraString(),
    fontes,
  };
}

function mensagemDeErro(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function calcularFolha(entrada: EntradaCalculoFolha): ResultadoCalculo {
  const dataReferencia = entrada.competencia.dataReferencia();

  const resolucao = resolverParaExecucao(
    entrada.regras,
    entrada.rubricas,
    entrada.competencia,
    entrada.tipoFolha,
    entrada.corte,
  );

  const grafo = montarGrafo(resolucao.regrasResolvidas, resolucao.rubricasResolvidas);
  if ("erro" in grafo) {
    return { registros: [], naoAplicaveis: [], erros: [{ tipo: "ciclo", erro: grafo }] };
  }

  const registros: RegistroCalculo[] = [];
  const naoAplicaveis: NaoAplicavel[] = [];
  const erros: ErroCalculoFolha[] = [];

  for (const linha of entrada.historias) {
    if (!participa(linha, dataReferencia)) continue;

    const rubricasCalculadas = new Map<RubricaChave, Dinheiro>();
    const base = criarContexto({
      linha,
      competencia: entrada.competencia,
      tipoFolha: entrada.tipoFolha,
      dataReferencia,
      corte: entrada.corte,
      registroDeDerivacoes: entrada.derivacoes,
      rubricasResolvidas: resolucao.rubricasResolvidas,
      rubricasCalculadas,
      leitorJanelas: entrada.leitorJanelas,
    });

    for (const rubricaChave of grafo.ordem) {
      // `grafo.ordem` é derivado das chaves de `grafo.regraPorRubrica` (ver grafo.ts) —
      // toda rubrica na ordem tem, por construção, uma regra produtora. Não-nulo.
      const regra = grafo.regraPorRubrica.get(rubricaChave)!;
      if (!aplicavelAHistoria(regra, linha.historiaId)) continue;

      const instrumentado = instrumentar(base);
      try {
        if (!regra.quando(instrumentado.ctx)) {
          naoAplicaveis.push({ historiaId: linha.historiaId, regra: regra.regra, versao: regra.versao });
          continue;
        }

        const valorBruto = regra.calcular(instrumentado.ctx);
        // toda rubrica produzida por uma regra resolvida tem versão resolvida — senão
        // `resolverParaExecucao` já teria lançado ErroRubricaNaoResolvida antes de chegar aqui.
        const rubricaResolvida = resolucao.rubricasResolvidas.get(rubricaChave)!;
        const valor = valorBruto.arredondar(rubricaResolvida.arredondamento);

        rubricasCalculadas.set(rubricaChave, valor);
        registros.push({
          folhaId: entrada.folhaId,
          historiaId: linha.historiaId,
          rubrica: rubricaChave,
          versaoRubrica: rubricaResolvida.versao,
          regra: regra.regra,
          versaoRegra: regra.versao,
          valor,
          explicacao: construirExplicacao(regra, rubricaChave, valor, instrumentado.leituras),
        });
      } catch (e) {
        erros.push({
          tipo: "excecao",
          historiaId: linha.historiaId,
          regra: regra.regra,
          mensagem: mensagemDeErro(e),
        });
      }
    }
  }

  return { registros, naoAplicaveis, erros };
}
