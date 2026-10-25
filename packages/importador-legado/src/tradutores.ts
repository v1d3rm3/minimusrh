import { createHash } from "node:crypto";
import { Amparo, Competencia, Dinheiro, dataEfeito, dataRegistro, versaoVigente } from "@minimusrh/dominio";
import type {
  AlvoFato,
  CampoSchema,
  DataEfeito,
  DataRegistro,
  HistoriaId,
  PessoaId,
  TipoAmparoChave,
  TipoFato,
  TipoFatoChave,
  VersaoTipoFato,
} from "@minimusrh/dominio";
import { validarConteudo, type NovoFato } from "@minimusrh/persistencia";
import type { ConfiguracaoImportacao } from "./configuracao.js";
import { CONVENCAO_REGISTRO_DESCONHECIDO, autorDoLote } from "./convencoes.js";
import { historiaIdDoVinculo, pessoaIdDoServidor } from "./identidade.js";
import type {
  CamposCrus,
  OrigemRegistro,
  RegistroContracheque,
  RegistroEvento,
  RegistroLegado,
  RegistroServidor,
  RegistroVinculo,
} from "./registros.js";

// tradutores.ts — registro cru → fatos (Playbook Módulo 7, item 2). Funções puras: nenhuma
// I/O, nenhum relógio. Cada registro do legado vira uma UNIDADE de importação, gravada de forma
// atômica (destino-pg.ts): o servidor com seu nascimento, o vínculo com sua abertura e seu
// encerramento, o evento com seu fato, a linha de contracheque com sua linha de gabarito.
// Conteúdo validado contra o catálogo ANTES de qualquer gravação; o que não passa vira
// `Rejeicao`, com motivo, e o lote segue (Playbook: "rejeitado NÃO derruba o lote").

export interface Rejeicao {
  readonly origem: OrigemRegistro;
  readonly motivo: string;
}

/** Um fato pronto para gravar, com sua chave natural de idempotência (DECISOES #2). */
export interface FatoTraduzido {
  readonly chaveNatural: string;
  /** SHA-256 do fato sem o autor: reimportar igual é no-op, reimportar diferente é conflito. */
  readonly assinatura: string;
  readonly fato: NovoFato;
  /** A `dataRegistro` veio de CONVENCAO_REGISTRO_DESCONHECIDO, não do legado. */
  readonly registroPorConvencao: boolean;
}

export interface IdentidadeServidor {
  readonly idServidorLegado: string;
  readonly pessoaId: PessoaId;
}

export interface IdentidadeVinculo {
  readonly idVinculoLegado: string;
  readonly historiaId: HistoriaId;
  readonly idServidorLegado: string;
  readonly pessoaId: PessoaId;
}

export interface LinhaGabarito {
  readonly chaveNatural: string;
  readonly idVinculoLegado: string;
  readonly historiaId: HistoriaId;
  readonly competencia: Competencia;
  readonly tipoFolhaLegado: string;
  readonly rubricaLegado: string;
  readonly descricao?: string;
  readonly valor: Dinheiro;
}

export type UnidadeImportacao =
  | { readonly tipo: "servidor"; readonly origem: OrigemRegistro; readonly chaveNatural: string; readonly servidor: IdentidadeServidor; readonly fatos: readonly FatoTraduzido[] }
  | { readonly tipo: "vinculo"; readonly origem: OrigemRegistro; readonly chaveNatural: string; readonly vinculo: IdentidadeVinculo; readonly fatos: readonly FatoTraduzido[] }
  | { readonly tipo: "evento"; readonly origem: OrigemRegistro; readonly chaveNatural: string; readonly idVinculoLegado: string; readonly fatos: readonly FatoTraduzido[] }
  | { readonly tipo: "contracheque"; readonly origem: OrigemRegistro; readonly chaveNatural: string; readonly gabarito: LinhaGabarito };

export interface ContextoTraducao {
  readonly configuracao: ConfiguracaoImportacao;
  readonly lote: string;
}

class FalhaTraducao extends Error {}

function falhar(motivo: string): never {
  throw new FalhaTraducao(motivo);
}

function lerDataEfeito(valor: string, coluna: string): DataEfeito {
  try {
    return dataEfeito(valor);
  } catch {
    return falhar(`'${coluna}' inválida: '${valor}' (esperado 'AAAA-MM-DD')`);
  }
}

/** Data sem hora é lida como 00:00:00Z (docs/layout-importacao.md). */
function lerDataRegistro(valor: string): DataRegistro {
  try {
    return dataRegistro(/^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T00:00:00Z` : valor);
  } catch {
    return falhar(`'data_registro' inválida: '${valor}' (esperado 'AAAA-MM-DD' ou timestamp ISO 8601 com fuso)`);
  }
}

const DECIMAL_COM_PONTO = /^-?\d+(\.\d+)?$/;
const DINHEIRO_COM_CENTAVOS = /^-?\d+(\.\d{1,2})?$/;
const INTEIRO = /^-?\d+$/;
const LOGICOS: Readonly<Record<string, boolean>> = { sim: true, nao: false, "não": false, true: true, false: false };

/**
 * Texto do legado → valor do schema. `TipoCampo` é vocabulário FECHADO da plataforma, não
 * chave de domínio (mesmo argumento de persistencia/validacao-conteudo.ts). Campo fora do
 * schema passa como texto e é recusado por `validarConteudo` ("campo desconhecido").
 */
function converterCampo(campo: CampoSchema | undefined, nome: string, valor: string): unknown {
  if (campo === undefined) return valor;
  switch (campo.tipo) {
    case "texto":
    case "data":
      return valor;
    case "dinheiro":
    case "percentual":
      return DECIMAL_COM_PONTO.test(valor) ? valor : falhar(`campo '${nome}': '${valor}' não é decimal com ponto (ex.: 1234.56)`);
    case "numero":
      return INTEIRO.test(valor) ? Number.parseInt(valor, 10) : falhar(`campo '${nome}': '${valor}' não é inteiro`);
    case "logico": {
      const logico = LOGICOS[valor.toLowerCase()];
      return logico ?? falhar(`campo '${nome}': '${valor}' não é lógico (sim/nao)`);
    }
  }
}

function converterCampos(versao: VersaoTipoFato, campos: CamposCrus): Record<string, unknown> {
  const porNome = new Map(versao.schema.map((c) => [c.nome, c]));
  const conteudo: Record<string, unknown> = {};
  for (const [nome, valor] of Object.entries(campos)) conteudo[nome] = converterCampo(porNome.get(nome), nome, valor);
  return conteudo;
}

/**
 * DECISOES #5. A versão do tipo de fato é a vigente na data de efeito, com o conhecimento mais
 * recente do catálogo (o "corte sem limite" do amparo.ts do dominio). Fato anterior à primeira versão do
 * tipo (o catálogo inicial da ALRN vale desde 2026-01-01; posses são de anos antes) usa a
 * primeira versão: o tipo já existia no mundo, só não estava catalogado.
 */
export function escolherVersaoDoTipo(tipo: TipoFato, em: DataEfeito): VersaoTipoFato {
  const versoes = tipo.versoes;
  const corte = versoes.reduce((maior, v) => (v.dataRegistro > maior ? v.dataRegistro : maior), versoes[0]!.dataRegistro);
  const vigente = versaoVigente(versoes, em, corte);
  if (vigente !== undefined) return vigente;
  return versoes.reduce((primeira, v) => (v.dataEfeito < primeira.dataEfeito ? v : primeira));
}

/** JSON com chaves ordenadas: mesma entrada ⇒ mesma assinatura, independente da ordem das colunas. */
function canonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  if (typeof valor === "object" && valor !== null) {
    // chaves de objeto são únicas: nunca há empate.
    const entradas = Object.entries(valor).sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entradas.map(([k, v]) => `${JSON.stringify(k)}:${canonico(v)}`).join(",")}}`;
  }
  return JSON.stringify(valor);
}

export function assinaturaDoFato(fato: NovoFato): string {
  const { autor: _autor, amparo, ...resto } = fato;
  const comparavel = { ...resto, amparo: amparo === undefined ? null : { tipo: amparo.tipo, comoInformado: amparo.comoInformado } };
  return createHash("sha256").update(canonico(comparavel)).digest("hex");
}

interface ParametrosFato {
  readonly chaveNatural: string;
  readonly tipo: TipoFatoChave;
  readonly alvo: AlvoFato;
  readonly dataEfeito: DataEfeito;
  readonly dataRegistro?: DataRegistro;
  readonly campos: CamposCrus;
  readonly amparo?: Amparo;
}

function traduzirFato(ctx: ContextoTraducao, p: ParametrosFato): FatoTraduzido {
  const tipoFato = ctx.configuracao.tiposDeFato.porChave(p.tipo) ?? falhar(`tipo de fato desconhecido no catálogo: '${p.tipo}'`);
  const versao = escolherVersaoDoTipo(tipoFato, p.dataEfeito);
  const fato: NovoFato = {
    alvo: p.alvo,
    tipo: p.tipo,
    versaoDoTipo: versao.versao,
    conteudo: converterCampos(versao, p.campos),
    dataEfeito: p.dataEfeito,
    dataRegistro: p.dataRegistro ?? CONVENCAO_REGISTRO_DESCONHECIDO.aplicar(p.dataEfeito),
    autor: autorDoLote(ctx.lote),
    ...(p.amparo !== undefined ? { amparo: p.amparo } : {}),
  };
  const validacao = validarConteudo(ctx.configuracao.tiposDeFato, fato);
  if (validacao !== true) falhar(`fato '${p.tipo}': ${validacao.erro}`);
  return { chaveNatural: p.chaveNatural, assinatura: assinaturaDoFato(fato), fato, registroPorConvencao: p.dataRegistro === undefined };
}

function traduzirServidor(ctx: ContextoTraducao, r: RegistroServidor): UnidadeImportacao {
  const pessoaId = pessoaIdDoServidor(r.idServidor);
  const fatos =
    r.dataNascimento === undefined
      ? []
      : [
          traduzirFato(ctx, {
            chaveNatural: `servidor:${r.idServidor}:nascimento`,
            tipo: ctx.configuracao.tipos.nascimento,
            alvo: { escopo: "pessoa", pessoaId },
            dataEfeito: lerDataEfeito(r.dataNascimento, "data_nascimento"),
            campos: {},
          }),
        ];
  return { tipo: "servidor", origem: r.origem, chaveNatural: `servidor:${r.idServidor}`, servidor: { idServidorLegado: r.idServidor, pessoaId }, fatos };
}

function traduzirVinculo(ctx: ContextoTraducao, r: RegistroVinculo): UnidadeImportacao {
  const historiaId = historiaIdDoVinculo(r.idVinculo);
  const alvo: AlvoFato = { escopo: "historia", historiaId };
  const inicio = lerDataEfeito(r.dataInicio, "data_inicio");
  const fim = r.dataFim === undefined ? undefined : lerDataEfeito(r.dataFim, "data_fim");
  if (fim !== undefined && fim < inicio) falhar(`'data_fim' (${fim}) anterior a 'data_inicio' (${inicio})`);

  const fatos = [
    traduzirFato(ctx, { chaveNatural: `vinculo:${r.idVinculo}:abertura`, tipo: ctx.configuracao.tipos.abertura, alvo, dataEfeito: inicio, campos: r.campos }),
    ...(fim === undefined
      ? []
      : [traduzirFato(ctx, { chaveNatural: `vinculo:${r.idVinculo}:encerramento`, tipo: ctx.configuracao.tipos.encerramento, alvo, dataEfeito: fim, campos: {} })]),
  ];
  return {
    tipo: "vinculo",
    origem: r.origem,
    chaveNatural: `vinculo:${r.idVinculo}`,
    vinculo: { idVinculoLegado: r.idVinculo, historiaId, idServidorLegado: r.idServidor, pessoaId: pessoaIdDoServidor(r.idServidor) },
    fatos,
  };
}

function traduzirAmparo(ctx: ContextoTraducao, amparo: NonNullable<RegistroEvento["amparo"]>): Amparo {
  const tipo = amparo.tipo as TipoAmparoChave;
  if (ctx.configuracao.amparos.porChave(tipo) === undefined) falhar(`tipo de amparo desconhecido no catálogo: '${amparo.tipo}'`);
  // Porta do legado (Design §2.1): grafia fora do padrão atual é aceita e preservada.
  return Amparo.legado(tipo, amparo.comoInformado);
}

function traduzirEvento(ctx: ContextoTraducao, r: RegistroEvento): UnidadeImportacao {
  const tipo = r.tipoFato as TipoFatoChave;
  const tipoFato = ctx.configuracao.tiposDeFato.porChave(tipo) ?? falhar(`tipo de fato desconhecido no catálogo: '${r.tipoFato}'`);
  if (tipoFato.alvo !== "historia") falhar(`tipo de fato '${r.tipoFato}' é de pessoa; eventos de vinculos.csv só alvejam a história`);
  if (tipoFato.abreHistoria === true || tipoFato.encerraHistoria === true) {
    falhar(`tipo de fato '${r.tipoFato}' abre ou encerra história: vem de vinculos.csv (data_inicio/data_fim), não de eventos`);
  }
  const fato = traduzirFato(ctx, {
    chaveNatural: `evento:${r.idEvento}`,
    tipo,
    alvo: { escopo: "historia", historiaId: historiaIdDoVinculo(r.idVinculo) },
    dataEfeito: lerDataEfeito(r.dataEfeito, "data_efeito"),
    ...(r.dataRegistro !== undefined ? { dataRegistro: lerDataRegistro(r.dataRegistro) } : {}),
    campos: r.campos,
    ...(r.amparo !== undefined ? { amparo: traduzirAmparo(ctx, r.amparo) } : {}),
  });
  return { tipo: "evento", origem: r.origem, chaveNatural: `evento:${r.idEvento}`, idVinculoLegado: r.idVinculo, fatos: [fato] };
}

function lerCompetencia(valor: string): Competencia {
  const m = /^(\d{4})-(\d{2})$/.exec(valor);
  const mes = m === null ? 0 : Number.parseInt(m[2]!, 10);
  if (m === null || mes < 1 || mes > 12) falhar(`'competencia' inválida: '${valor}' (esperado 'AAAA-MM')`);
  return Competencia.de(Number.parseInt(m[1]!, 10), mes);
}

function traduzirContracheque(r: RegistroContracheque): UnidadeImportacao {
  const competencia = lerCompetencia(r.competencia);
  if (!DINHEIRO_COM_CENTAVOS.test(r.valor)) falhar(`'valor' inválido: '${r.valor}' (esperado decimal com ponto e até 2 casas, ex.: 1234.56)`);
  const chaveNatural = `contracheque:${r.idVinculo}:${competencia.toString()}:${r.tipoFolha}:${r.rubrica}`;
  return {
    tipo: "contracheque",
    origem: r.origem,
    chaveNatural,
    gabarito: {
      chaveNatural,
      idVinculoLegado: r.idVinculo,
      historiaId: historiaIdDoVinculo(r.idVinculo),
      competencia,
      tipoFolhaLegado: r.tipoFolha,
      rubricaLegado: r.rubrica,
      ...(r.descricao !== undefined ? { descricao: r.descricao } : {}),
      valor: Dinheiro.de(r.valor),
    },
  };
}

/** Traduz um registro cru numa unidade de importação, ou explica por que não. */
export function traduzir(ctx: ContextoTraducao, registro: RegistroLegado): UnidadeImportacao | Rejeicao {
  try {
    switch (registro.tipo) {
      case "ilegivel":
        return { origem: registro.origem, motivo: registro.motivo };
      case "servidor":
        return traduzirServidor(ctx, registro);
      case "vinculo":
        return traduzirVinculo(ctx, registro);
      case "evento":
        return traduzirEvento(ctx, registro);
      case "contracheque":
        return traduzirContracheque(registro);
    }
  } catch (e) {
    if (e instanceof FalhaTraducao) return { origem: registro.origem, motivo: e.message };
    throw e;
  }
}

export function ehRejeicao(resultado: UnidadeImportacao | Rejeicao): resultado is Rejeicao {
  return "motivo" in resultado;
}
