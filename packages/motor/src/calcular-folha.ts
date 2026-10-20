import { Dinheiro } from "@minimusrh/dominio";
import type {
  Catalogo,
  Classificacao,
  Competencia,
  DataEfeito,
  DataRegistro,
  FatoId,
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
import { type LeitorDeJanelas, type ParcelaClassificacao, type ProvenienciaDerivacao, criarContexto } from "./contexto-impl.js";
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

/** O que o observador de leituras (contexto-impl.ts) anotou durante a execução de UMA regra. */
interface Proveniencia {
  readonly derivacoes: ProvenienciaDerivacao[];
  readonly fatos: FatoId[];
  readonly classificacoes: { readonly classificacao: Classificacao; readonly total: Dinheiro; readonly parcelas: readonly ParcelaClassificacao[] }[];
}

function novaProveniencia(): Proveniencia {
  return { derivacoes: [], fatos: [], classificacoes: [] };
}

/** Valor de derivação como texto: primitivo direto; objeto (ex.: `{dias, diasNoMes}`) em JSON. */
function textoDoValor(valor: unknown): string {
  return typeof valor === "object" && valor !== null ? JSON.stringify(valor) : String(valor);
}

function fonteDeDerivacao(p: ProvenienciaDerivacao): FonteExplicacao {
  const fonte: FonteExplicacao = { tipo: "derivacao", chave: p.chave, valor: textoDoValor(p.valor) };
  if (p.fatos.length === 0) return fonte;
  // Sub-árvore só quando há algo embaixo: "derivação X vN = valor, a partir dos fatos ...".
  return {
    tipo: "no",
    no: {
      descricao: `derivação '${p.chave}' v${p.versao}`,
      fontes: [fonte, ...p.fatos.map((fatoId): FonteExplicacao => ({ tipo: "fato", fatoId }))],
    },
  };
}

/**
 * NoExplicacao é construída a partir do log de leituras do contexto instrumentado
 * (bullet do playbook: "o contexto instrumentado fornece a matéria-prima da árvore") e da
 * proveniência observada (DECISOES #13): cada derivação lida cita os fatos que consultou,
 * cada soma por classificação vira sub-árvore com as parcelas que a compõem, e cada fato
 * lido diretamente pela regra (`vigente`/`existe`) vira fonte `'fato'`. Leituras
 * repetidas da mesma chave na mesma regra (ex.: `quando` e `calcular` lendo `cargo`) citam
 * uma vez só. 'tabela' segue fora: é insumo de regras concretas (Módulo 4), fora do
 * vocabulário genérico do motor.
 */
function construirExplicacao(
  regra: VersaoRegra,
  rubricaChave: RubricaChave,
  valor: Dinheiro,
  leituras: readonly Leitura[],
  proveniencia: Proveniencia,
): NoExplicacao {
  const fontes: FonteExplicacao[] = [];
  const citadas = new Set<string>();
  // Uma proveniência por leitura de derivação, na mesma ordem (o observador dispara
  // dentro da própria leitura, inclusive quando ela devolve undefined).
  let proximaDerivacao = 0;
  for (const leitura of leituras) {
    if (leitura.eixo === "derivacao") {
      const p = proveniencia.derivacoes[proximaDerivacao++]!;
      if (leitura.valor === undefined || citadas.has(`derivacao:${leitura.chave}`)) continue;
      citadas.add(`derivacao:${leitura.chave}`);
      fontes.push(fonteDeDerivacao(p));
    }
    if (leitura.eixo === "rubrica" && leitura.valor !== undefined && !citadas.has(`rubrica:${leitura.chave}`)) {
      citadas.add(`rubrica:${leitura.chave}`);
      fontes.push({ tipo: "rubrica", chave: leitura.chave, valor: leitura.valor.paraString() });
    }
  }
  for (const { classificacao, total, parcelas } of proveniencia.classificacoes) {
    if (citadas.has(`classificacao:${classificacao}`)) continue;
    citadas.add(`classificacao:${classificacao}`);
    fontes.push({
      tipo: "no",
      no: {
        descricao: `soma das rubricas com '${classificacao}'`,
        valor: total.paraString(),
        fontes: parcelas.map((p): FonteExplicacao => ({ tipo: "rubrica", chave: p.rubrica, valor: p.valor.paraString() })),
      },
    });
  }
  for (const fatoId of new Set(proveniencia.fatos)) {
    fontes.push({ tipo: "fato", fatoId });
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
    // Reiniciada a cada regra (abaixo): o observador escreve sempre na da regra corrente.
    let proveniencia = novaProveniencia();
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
      observador: {
        derivacaoLida: (p) => proveniencia.derivacoes.push(p),
        fatoLido: (_tipo, fatoId) => {
          if (fatoId !== undefined) proveniencia.fatos.push(fatoId);
        },
        classificacaoLida: (classificacao, total, parcelas) => proveniencia.classificacoes.push({ classificacao, total, parcelas }),
      },
    });

    for (const rubricaChave of grafo.ordem) {
      // `grafo.ordem` é derivado das chaves de `grafo.regraPorRubrica` (ver grafo.ts) —
      // toda rubrica na ordem tem, por construção, uma regra produtora. Não-nulo.
      const regra = grafo.regraPorRubrica.get(rubricaChave)!;
      if (!aplicavelAHistoria(regra, linha.historiaId)) continue;

      proveniencia = novaProveniencia();
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
          explicacao: construirExplicacao(regra, rubricaChave, valor, instrumentado.leituras, proveniencia),
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
