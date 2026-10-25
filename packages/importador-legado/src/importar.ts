import { validarConfiguracao, type ConfiguracaoImportacao } from "./configuracao.js";
import { FORMATO_LOTE } from "./convencoes.js";
import type { DestinoImportacao } from "./destino.js";
import type { FonteLegado, OrigemRegistro, RegistroLegado, TipoRegistro } from "./registros.js";
import { novoAcumulador, type RelatorioImportacao } from "./relatorio.js";
import { ehRejeicao, traduzir, type Rejeicao, type UnidadeImportacao } from "./tradutores.js";

// importar.ts — o pipeline do lote: fonte → tradutores → destino → relatório (Playbook
// Módulo 7). Lê a fonte INTEIRA antes de gravar qualquer coisa: um erro estrutural da fonte
// (arquivo ausente, cabeçalho errado) aborta antes da primeira escrita. Depois processa em
// ordem de dependência (servidores, vínculos, eventos, contracheques), porque um vínculo
// precisa do seu servidor e um evento do seu vínculo (DECISOES #7). Registro rejeitado vai
// para o relatório e o lote segue.

export class ErroImportacao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroImportacao";
  }
}

export interface OpcoesImportacao {
  readonly fonte: FonteLegado;
  readonly destino: DestinoImportacao;
  readonly configuracao: ConfiguracaoImportacao;
  readonly lote: string;
}

const ORDEM: Readonly<Record<TipoRegistro, number>> = { servidor: 0, vinculo: 1, evento: 2, contracheque: 3, ilegivel: 4 };

async function lerFonte(fonte: FonteLegado): Promise<RegistroLegado[]> {
  const registros: RegistroLegado[] = [];
  for await (const registro of fonte.registros()) registros.push(registro);
  // sort estável: dentro de cada tipo, a ordem da fonte é preservada.
  return registros.sort((a, b) => ORDEM[a.tipo] - ORDEM[b.tipo]);
}

function onde(origem: OrigemRegistro): string {
  return `${origem.arquivo}:${origem.linha}`;
}

/** Integridade referencial do lote: dentro dele ou de um lote anterior. Devolve o motivo da recusa. */
async function referenciaAusente(
  unidade: UnidadeImportacao,
  aceitos: { readonly servidores: ReadonlySet<string>; readonly vinculos: ReadonlySet<string> },
  destino: DestinoImportacao,
): Promise<string | undefined> {
  const servidorOk = async (id: string): Promise<boolean> => aceitos.servidores.has(id) || (await destino.servidorConhecido(id));
  const vinculoOk = async (id: string): Promise<boolean> => aceitos.vinculos.has(id) || (await destino.vinculoConhecido(id));
  switch (unidade.tipo) {
    case "servidor":
      return undefined;
    case "vinculo":
      return (await servidorOk(unidade.vinculo.idServidorLegado))
        ? undefined
        : `servidor '${unidade.vinculo.idServidorLegado}' não está neste lote nem em lote anterior`;
    case "evento":
      return (await vinculoOk(unidade.idVinculoLegado)) ? undefined : `vínculo '${unidade.idVinculoLegado}' não está neste lote nem em lote anterior`;
    case "contracheque":
      return (await vinculoOk(unidade.gabarito.idVinculoLegado))
        ? undefined
        : `vínculo '${unidade.gabarito.idVinculoLegado}' não está neste lote nem em lote anterior`;
  }
}

export async function importar(opcoes: OpcoesImportacao): Promise<RelatorioImportacao> {
  const { fonte, destino, configuracao, lote } = opcoes;
  if (!FORMATO_LOTE.test(lote)) {
    throw new ErroImportacao(`identificador de lote inválido: '${lote}' (letras, dígitos, '.', '_' e '-'; até 64)`);
  }
  validarConfiguracao(configuracao);

  const registros = await lerFonte(fonte);
  const acumulador = novoAcumulador(lote, fonte.descricao);
  const primeiraOcorrencia = new Map<string, OrigemRegistro>();
  const servidores = new Set<string>();
  const vinculos = new Set<string>();

  for (const registro of registros) {
    acumulador.lido(registro.tipo);
    const traduzido = traduzir({ configuracao, lote }, registro);
    if (ehRejeicao(traduzido)) {
      acumulador.rejeitado(traduzido);
      continue;
    }

    const rejeitar = (motivo: string): void => acumulador.rejeitado({ origem: traduzido.origem, motivo } satisfies Rejeicao);
    const anterior = primeiraOcorrencia.get(traduzido.chaveNatural);
    if (anterior !== undefined) {
      rejeitar(`'${traduzido.chaveNatural}' repetido no lote (primeira ocorrência em ${onde(anterior)})`);
      continue;
    }
    primeiraOcorrencia.set(traduzido.chaveNatural, traduzido.origem);

    const ausente = await referenciaAusente(traduzido, { servidores, vinculos }, destino);
    if (ausente !== undefined) {
      rejeitar(ausente);
      continue;
    }

    const resultado = await destino.gravar(traduzido);
    if (!resultado.ok) {
      rejeitar(resultado.conflito);
      continue;
    }
    if (traduzido.tipo === "servidor") servidores.add(traduzido.servidor.idServidorLegado);
    if (traduzido.tipo === "vinculo") vinculos.add(traduzido.vinculo.idVinculoLegado);
    acumulador.gravado(traduzido, resultado);
  }

  return acumulador.relatorio();
}
