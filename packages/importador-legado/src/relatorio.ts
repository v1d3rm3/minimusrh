import { CONVENCAO_REGISTRO_DESCONHECIDO } from "./convencoes.js";
import type { ResultadoGravacao } from "./destino.js";
import type { TipoRegistro } from "./registros.js";
import type { FatoTraduzido, Rejeicao, UnidadeImportacao } from "./tradutores.js";

// relatorio.ts — o relatório de importação (Playbook Módulo 7, item 5): totais, rejeições com
// motivo e uma amostra dos fatos gerados por tipo, para o humano conferir a tradução a olho.

export const TAMANHO_AMOSTRA = 3;

export interface RelatorioImportacao {
  readonly lote: string;
  readonly fonte: string;
  readonly lidos: Readonly<Record<TipoRegistro, number>>;
  /** Unidades com algo gravado agora (identidade, fato ou linha de gabarito). */
  readonly unidadesGravadas: number;
  /** Unidades que já estavam gravadas, idênticas (reimportação). */
  readonly unidadesSemMudanca: number;
  /** Fatos gravados agora, por tipo de fato. */
  readonly fatosGerados: ReadonlyMap<string, number>;
  readonly fatosJaImportados: number;
  /** Entre os fatos gravados agora, quantos usaram CONVENCAO_REGISTRO_DESCONHECIDO. */
  readonly fatosPorConvencao: number;
  readonly gabaritoGravadas: number;
  readonly gabaritoJaImportadas: number;
  readonly rejeicoes: readonly Rejeicao[];
  readonly amostra: ReadonlyMap<string, readonly FatoTraduzido[]>;
}

export interface Acumulador {
  lido(tipo: TipoRegistro): void;
  rejeitado(rejeicao: Rejeicao): void;
  gravado(unidade: UnidadeImportacao, resultado: Extract<ResultadoGravacao, { ok: true }>): void;
  relatorio(): RelatorioImportacao;
}

export function novoAcumulador(lote: string, fonte: string): Acumulador {
  const lidos: Record<TipoRegistro, number> = { servidor: 0, vinculo: 0, evento: 0, contracheque: 0, ilegivel: 0 };
  const fatosGerados = new Map<string, number>();
  const amostra = new Map<string, FatoTraduzido[]>();
  const rejeicoes: Rejeicao[] = [];
  let unidadesGravadas = 0;
  let unidadesSemMudanca = 0;
  let fatosJaImportados = 0;
  let fatosPorConvencao = 0;
  let gabaritoGravadas = 0;
  let gabaritoJaImportadas = 0;

  return {
    lido(tipo) {
      lidos[tipo]++;
    },
    rejeitado(rejeicao) {
      rejeicoes.push(rejeicao);
    },
    gravado(unidade, resultado) {
      if (resultado.semMudanca) unidadesSemMudanca++;
      else unidadesGravadas++;
      if (unidade.tipo === "contracheque") {
        if (resultado.semMudanca) gabaritoJaImportadas++;
        else gabaritoGravadas++;
      }
      fatosJaImportados += resultado.fatosJaImportados;
      for (const traduzido of resultado.fatosNovos) {
        const tipo = traduzido.fato.tipo;
        fatosGerados.set(tipo, (fatosGerados.get(tipo) ?? 0) + 1);
        if (traduzido.registroPorConvencao) fatosPorConvencao++;
        const doTipo = amostra.get(tipo) ?? [];
        if (doTipo.length < TAMANHO_AMOSTRA) amostra.set(tipo, [...doTipo, traduzido]);
      }
    },
    relatorio() {
      const ordenadas = [...rejeicoes].sort(
        (a, b) => (a.origem.arquivo < b.origem.arquivo ? -1 : a.origem.arquivo > b.origem.arquivo ? 1 : a.origem.linha - b.origem.linha),
      );
      return {
        lote,
        fonte,
        lidos: { ...lidos },
        unidadesGravadas,
        unidadesSemMudanca,
        fatosGerados: new Map(fatosGerados),
        fatosJaImportados,
        fatosPorConvencao,
        gabaritoGravadas,
        gabaritoJaImportadas,
        rejeicoes: ordenadas,
        amostra: new Map(amostra),
      };
    },
  };
}

function totalFatos(r: RelatorioImportacao): number {
  return [...r.fatosGerados.values()].reduce((soma, n) => soma + n, 0);
}

function descreverFato(t: FatoTraduzido): string {
  const { fato } = t;
  const alvo = fato.alvo.escopo === "pessoa" ? `pessoa ${fato.alvo.pessoaId}` : `história ${fato.alvo.historiaId}`;
  const registro = `registro ${fato.dataRegistro}${t.registroPorConvencao ? " (convenção)" : ""}`;
  const amparo = fato.amparo === undefined ? "" : ` · amparo ${fato.amparo.tipo} '${fato.amparo.comoInformado}'`;
  return `${alvo} · efeito ${fato.dataEfeito} · ${registro} · v${fato.versaoDoTipo} · ${JSON.stringify(fato.conteudo)}${amparo}`;
}

/** Texto legível para o terminal. */
export function renderizarRelatorio(r: RelatorioImportacao): string {
  const l = r.lidos;
  const porTipo = [...r.fatosGerados.entries()].map(([tipo, n]) => `${tipo} ${n}`).join(", ");
  const linhas = [
    `Importação do lote '${r.lote}' — fonte ${r.fonte}`,
    "",
    `Registros lidos: servidores ${l.servidor} · vínculos ${l.vinculo} · eventos ${l.evento} · contracheques ${l.contracheque} · ilegíveis ${l.ilegivel}`,
    `Unidades: ${r.unidadesGravadas} gravada(s) · ${r.unidadesSemMudanca} já importada(s), sem mudança · ${r.rejeicoes.length} rejeitada(s)`,
    `Fatos gerados: ${totalFatos(r)}${porTipo === "" ? "" : ` (${porTipo})`} · já importados antes: ${r.fatosJaImportados}`,
    `  CONVENCAO_REGISTRO_DESCONHECIDO [${CONVENCAO_REGISTRO_DESCONHECIDO.descricao}]: ${r.fatosPorConvencao} fato(s)`,
    `Gabarito (contracheques do legado): ${r.gabaritoGravadas} linha(s) gravada(s) · ${r.gabaritoJaImportadas} já importada(s)`,
    "",
    `Rejeições (${r.rejeicoes.length}):`,
    ...(r.rejeicoes.length === 0 ? ["  nenhuma"] : r.rejeicoes.map((x) => `  ${x.origem.arquivo}:${x.origem.linha} — ${x.motivo}`)),
    "",
    `Amostra de fatos gerados (até ${TAMANHO_AMOSTRA} por tipo):`,
    ...(r.amostra.size === 0
      ? ["  nenhum fato novo"]
      : [...r.amostra.entries()].flatMap(([tipo, fatos]) => [`  ${tipo}`, ...fatos.map((f) => `    ${descreverFato(f)}`)])),
  ];
  return `${linhas.join("\n")}\n`;
}
