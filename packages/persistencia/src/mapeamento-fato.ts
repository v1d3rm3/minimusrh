import { Amparo } from "@minimusrh/dominio";
import type {
  AlvoFato,
  Autor,
  DataEfeito,
  DataRegistro,
  Fato,
  FatoId,
  HistoriaId,
  PessoaId,
  TipoAmparoChave,
  TipoFatoChave,
} from "@minimusrh/dominio";
import type { NovoFato } from "./fato-repositorio.js";

// mapeamento-fato.ts — Fato ⇄ linha da tabela `fato`. AlvoFato/Amparo decompostos em
// colunas (DECISOES #3); datas sempre convertidas para o formato canônico do dominio
// DENTRO do SQL via `to_char` (ver SELECT_FATO abaixo) — sem instanciar objeto de data
// nenhum em JS, e independente do `DateStyle` do servidor.

/**
 * Fragmento de SELECT reutilizado por toda query que lê `fato` — mantém o mapeamento
 * `linhaParaFato` simples (repasse direto de campos, sem parsing de data em JS).
 */
export const SELECT_FATO = `
  id, alvo_escopo, alvo_pessoa_id, alvo_historia_id, tipo, versao_do_tipo, conteudo,
  to_char(data_efeito, 'YYYY-MM-DD') AS data_efeito,
  to_char(data_registro AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS data_registro,
  autor, amparo_tipo, amparo_identificacao_canonica, amparo_como_informado,
  amparo_validado_contra_versao, substitui_fato_id
`;

export interface LinhaFato {
  readonly id: string;
  readonly alvo_escopo: "pessoa" | "historia";
  readonly alvo_pessoa_id: string | null;
  readonly alvo_historia_id: string | null;
  readonly tipo: string;
  readonly versao_do_tipo: number;
  readonly conteudo: unknown;
  readonly data_efeito: string;
  readonly data_registro: string;
  readonly autor: Autor;
  readonly amparo_tipo: string | null;
  readonly amparo_identificacao_canonica: string | null;
  readonly amparo_como_informado: string | null;
  readonly amparo_validado_contra_versao: number | null;
  readonly substitui_fato_id: string | null;
}

export interface ParametrosInsercaoFato {
  readonly id: string;
  readonly alvo_escopo: string;
  readonly alvo_pessoa_id: string | null;
  readonly alvo_historia_id: string | null;
  readonly tipo: string;
  readonly versao_do_tipo: number;
  readonly conteudo: string;
  readonly data_efeito: string;
  readonly data_registro: string;
  readonly autor: string;
  readonly amparo_tipo: string | null;
  readonly amparo_identificacao_canonica: string | null;
  readonly amparo_como_informado: string | null;
  readonly amparo_validado_contra_versao: number | null;
  readonly substitui_fato_id: string | null;
}

function alvoParaColunas(alvo: AlvoFato): Pick<ParametrosInsercaoFato, "alvo_escopo" | "alvo_pessoa_id" | "alvo_historia_id"> {
  if (alvo.escopo === "pessoa") {
    return { alvo_escopo: "pessoa", alvo_pessoa_id: alvo.pessoaId, alvo_historia_id: null };
  }
  return { alvo_escopo: "historia", alvo_pessoa_id: null, alvo_historia_id: alvo.historiaId };
}

function colunasParaAlvo(linha: LinhaFato): AlvoFato {
  if (linha.alvo_escopo === "pessoa") {
    return { escopo: "pessoa", pessoaId: linha.alvo_pessoa_id as PessoaId };
  }
  return { escopo: "historia", historiaId: linha.alvo_historia_id as HistoriaId };
}

type ColunasAmparo = Pick<
  ParametrosInsercaoFato,
  "amparo_tipo" | "amparo_identificacao_canonica" | "amparo_como_informado" | "amparo_validado_contra_versao"
>;

function amparoParaColunas(amparo: Amparo | undefined): ColunasAmparo {
  if (amparo === undefined) {
    return {
      amparo_tipo: null,
      amparo_identificacao_canonica: null,
      amparo_como_informado: null,
      amparo_validado_contra_versao: null,
    };
  }
  return {
    amparo_tipo: amparo.tipo,
    amparo_identificacao_canonica: amparo.identificacaoCanonica,
    amparo_como_informado: amparo.comoInformado,
    amparo_validado_contra_versao: amparo.validadoContraVersao ?? null,
  };
}

/**
 * DECISOES #6: `dominio` não expõe porta de reidratação para `Amparo` — só `criar`
 * (recalcula a canônica a partir da entrada crua, exigindo catálogo) e `legado` (idem,
 * sem catálogo). Nenhuma serve para reconstruir um `Amparo` já persistido sem
 * recomputar (e possivelmente divergir d)a canônica gravada, quebrando o round-trip.
 * `Amparo` não tem CAMPOS privados (só o construtor é privado, apagado em tempo de
 * compilação — só bloqueia `new Amparo(...)` fora da classe); reidratar via
 * `Object.create(Amparo.prototype)` produz uma instância real (`instanceof Amparo`),
 * com `mesmoDocumentoQue` herdado do prototype, sem tocar no pacote `dominio` já
 * revisado (fora do escopo deste módulo).
 */
export function reidratarAmparo(dados: {
  tipo: TipoAmparoChave;
  identificacaoCanonica: string;
  comoInformado: string;
  validadoContraVersao?: number;
}): Amparo {
  return Object.assign(Object.create(Amparo.prototype) as Amparo, dados);
}

export function linhaParaFato<C>(linha: LinhaFato): Fato<C> {
  const temAmparo =
    linha.amparo_tipo !== null && linha.amparo_identificacao_canonica !== null && linha.amparo_como_informado !== null;

  const amparo = temAmparo
    ? reidratarAmparo({
        tipo: linha.amparo_tipo as TipoAmparoChave,
        identificacaoCanonica: linha.amparo_identificacao_canonica as string,
        comoInformado: linha.amparo_como_informado as string,
        validadoContraVersao: linha.amparo_validado_contra_versao ?? undefined,
      })
    : undefined;

  return {
    id: linha.id as FatoId,
    alvo: colunasParaAlvo(linha),
    tipo: linha.tipo as TipoFatoChave,
    versaoDoTipo: linha.versao_do_tipo,
    conteudo: linha.conteudo as C,
    dataEfeito: linha.data_efeito as DataEfeito,
    dataRegistro: linha.data_registro as DataRegistro,
    autor: linha.autor,
    ...(amparo !== undefined ? { amparo } : {}),
    ...(linha.substitui_fato_id !== null ? { substituiFatoId: linha.substitui_fato_id as FatoId } : {}),
  };
}

export function fatoParaParametrosInsercao<C>(id: FatoId, fato: NovoFato<C>): ParametrosInsercaoFato {
  return {
    id,
    ...alvoParaColunas(fato.alvo),
    tipo: fato.tipo,
    versao_do_tipo: fato.versaoDoTipo,
    conteudo: JSON.stringify(fato.conteudo),
    data_efeito: fato.dataEfeito,
    data_registro: fato.dataRegistro,
    autor: JSON.stringify(fato.autor),
    ...amparoParaColunas(fato.amparo),
    substitui_fato_id: fato.substituiFatoId ?? null,
  };
}
