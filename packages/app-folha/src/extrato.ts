import { Dinheiro } from "@minimusrh/dominio";
import type { CatalogoRubricas, Fato, NaturezaRubrica, FatoId, FonteExplicacao, HistoriaId, NoExplicacao, RegistroCalculo } from "@minimusrh/dominio";

// extrato.ts — a árvore `NoExplicacao` de um registro em texto indentado (Roteiro Marco 1:
// "extrato de cálculo com árvore de explicação"). Será a ferramenta de depuração dos
// Marcos 3–4, por isso é texto puro e determinístico, sem cor nem largura de terminal.

const RECUO = "  ";

const SINAL_POR_NATUREZA: Readonly<Record<NaturezaRubrica, string>> = { vantagem: "+", desconto: "-", informativa: " " };

export interface OpcoesExtrato {
  /** Fatos citados pela explicação, para descrevê-los em vez de mostrar só o id. */
  readonly fatos?: ReadonlyMap<FatoId, Fato>;
}

function descreverFato(fatoId: FatoId, opcoes: OpcoesExtrato): string {
  const fato = opcoes.fatos?.get(fatoId);
  if (fato === undefined) return `fato ${fatoId}`;
  const amparo = fato.amparo === undefined ? "" : `, amparo ${fato.amparo.tipo} ${fato.amparo.identificacaoCanonica}`;
  return (
    `fato '${fato.tipo}' ${JSON.stringify(fato.conteudo)} ` +
    `(efeito ${fato.dataEfeito}, registrado ${fato.dataRegistro}${amparo}) [${fatoId}]`
  );
}

function linhasDaFonte(fonte: FonteExplicacao, nivel: number, opcoes: OpcoesExtrato): string[] {
  const recuo = RECUO.repeat(nivel);
  switch (fonte.tipo) {
    case "derivacao":
      return [`${recuo}derivação ${fonte.chave} = ${fonte.valor}`];
    case "rubrica":
      return [`${recuo}rubrica ${fonte.chave} = ${fonte.valor}`];
    case "fato":
      return [`${recuo}${descreverFato(fonte.fatoId, opcoes)}`];
    case "tabela":
      return [`${recuo}tabela ${fonte.chave} v${fonte.versao}`];
    case "no":
      return linhasDoNo(fonte.no, nivel, opcoes);
  }
}

function linhasDoNo(no: NoExplicacao, nivel: number, opcoes: OpcoesExtrato): string[] {
  const valor = no.valor === undefined ? "" : ` = ${no.valor}`;
  return [`${RECUO.repeat(nivel)}${no.descricao}${valor}`, ...no.fontes.flatMap((f) => linhasDaFonte(f, nivel + 1, opcoes))];
}

/** Extrato de UM registro: cabeçalho com rubrica/valor/versões, depois a árvore. */
export function renderizarExtrato(registro: RegistroCalculo, opcoes: OpcoesExtrato = {}): string {
  return [
    `${registro.rubrica} (rubrica v${registro.versaoRubrica}) = ${registro.valor.paraString()}`,
    ...linhasDoNo(registro.explicacao, 1, opcoes),
  ].join("\n");
}

/** Só a árvore de uma explicação (ex.: a `explicacaoNova` de uma diferença retroativa). */
export function renderizarExplicacao(no: NoExplicacao, opcoes: OpcoesExtrato = {}, nivel = 0): string {
  return linhasDoNo(no, nivel, opcoes).join("\n");
}

/** Todos os FatoIds citados (em qualquer profundidade), sem repetição, na ordem da árvore. */
export function fatosCitados(registros: readonly RegistroCalculo[]): readonly FatoId[] {
  const ids = new Set<FatoId>();
  function visitar(no: NoExplicacao): void {
    for (const fonte of no.fontes) {
      if (fonte.tipo === "fato") ids.add(fonte.fatoId);
      if (fonte.tipo === "no") visitar(fonte.no);
    }
  }
  for (const registro of registros) visitar(registro.explicacao);
  return [...ids];
}

/**
 * Contracheque de uma história: vantagens, descontos, líquido — seguido do extrato de cada
 * rubrica. A natureza vem da VERSÃO da rubrica com que o registro foi calculado.
 */
export function renderizarContracheque(
  historiaId: HistoriaId,
  registros: readonly RegistroCalculo[],
  rubricas: CatalogoRubricas,
  opcoes: OpcoesExtrato = {},
): string {
  const daHistoria = registros.filter((r) => r.historiaId === historiaId);
  let vantagens = Dinheiro.zero();
  let descontos = Dinheiro.zero();
  const linhas = [`Contracheque — história ${historiaId}`, ""];

  for (const registro of daHistoria) {
    const versao = rubricas.porChave(registro.rubrica)?.versoes.find((v) => v.versao === registro.versaoRubrica);
    if (versao === undefined) {
      throw new Error(`contracheque: rubrica '${registro.rubrica}' v${registro.versaoRubrica} ausente do catálogo`);
    }
    // 'informativa' aparece no contracheque mas não entra em nenhum total.
    if (versao.natureza === "vantagem") vantagens = vantagens.somar(registro.valor);
    if (versao.natureza === "desconto") descontos = descontos.somar(registro.valor);
    const sinal = SINAL_POR_NATUREZA[versao.natureza];
    linhas.push(`  ${sinal} ${versao.nome.padEnd(32, " ")} ${registro.valor.paraString().padStart(12, " ")}`);
  }

  linhas.push(
    "",
    `  ${"Total de vantagens".padEnd(34, " ")} ${vantagens.paraString().padStart(12, " ")}`,
    `  ${"Total de descontos".padEnd(34, " ")} ${descontos.paraString().padStart(12, " ")}`,
    `  ${"Líquido".padEnd(34, " ")} ${vantagens.subtrair(descontos).paraString().padStart(12, " ")}`,
    "",
    "Extrato de cálculo",
    "",
    ...daHistoria.map((r) => renderizarExtrato(r, opcoes) + "\n"),
  );
  return linhas.join("\n");
}
