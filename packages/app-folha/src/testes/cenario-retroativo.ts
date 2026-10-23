import { Amparo, Competencia, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { Autor, DataRegistro, Fato, FatoId, FolhaId, HistoriaId, PessoaId, TipoFolhaChave } from "@minimusrh/dominio";
import { fatoRepositorioPg } from "@minimusrh/persistencia";
import {
  TIPO_AMPARO_PROCESSO,
  TIPO_FATO_POSSE,
  TIPO_FATO_PROMOCAO,
  VICTOR_FATO_NASCIMENTO,
  VICTOR_FATO_POSSE,
  VICTOR_FATO_PROMOCAO,
  criarCatalogoAmparos,
  criarCatalogoTiposDeFato,
} from "@minimusrh/regras-alrn";
import type { Pool } from "pg";
import { cadastroEmMemoria, configuracaoAlrn, type AlvoHistoria } from "../configuracao.js";
import { criarServicoFolha, type ServicoFolha } from "../servico-folha.js";
import { semearFatos, VICTOR_ALVO } from "./semear-victor.js";

// cenario-retroativo.ts — suporte de teste (NÃO é `*.test.ts`): o cenário do Marco 2
// (Roteiro; Fundação §5.3), compartilhado pelo teste de integração e por `demo:retroativo`.
// Linha do tempo REAL, na ordem em que as coisas acontecem:
//   1. o Victor (posse B6) e uma segunda história "mesmo cargo" (posse B6) existem;
//   2. as folhas mensais de 01 a 06/2026 fecham, cada uma com corte no dia 1º do mês
//      seguinte — ninguém sabe da promoção ainda;
//   3. em 10/07/2026 registram-se as promoções com efeito em 15/02/2026: a do Victor
//      (B6 → B8, processo 123/2026) e a da segunda história (B6 → B6, não muda valor);
//   4. a folha 07/2026 fecha com corte 01/08 — o estado do Módulo 5, que já sabe do B8.

export const MENSAL = "mensal" as TipoFolhaChave;
const AUTOR: Autor = { tipo: "humano", usuarioId: "cenario-retroativo" };

export const MESMO_CARGO_ALVO: AlvoHistoria = {
  pessoaId: "00000000-0000-4000-8000-00000000b003" as PessoaId,
  historiaId: "00000000-0000-4000-8000-00000000a003" as HistoriaId,
};

export const COMPETENCIAS_FECHADAS: readonly Competencia[] = Competencia.de(2026, 7).ultimas(7);

function corteDe(competencia: Competencia): DataRegistro {
  const seguinte = competencia.mes === 12 ? Competencia.de(competencia.ano + 1, 1) : Competencia.de(competencia.ano, competencia.mes + 1);
  return dataRegistro(`${seguinte.toString()}-01T00:00:00Z`);
}

function fechamentoDe(competencia: Competencia): DataRegistro {
  return dataRegistro(corteDe(competencia).replace("-01T00:00:00.000Z", "-02T12:00:00.000Z"));
}

function amparoProcesso(numero: string, em: string): Amparo {
  const amparo = Amparo.criar(TIPO_AMPARO_PROCESSO, numero, criarCatalogoAmparos(), dataEfeito(em));
  if (!(amparo instanceof Amparo)) throw new Error(`cenário retroativo: amparo '${numero}' inválido: ${amparo.erro}`);
  return amparo;
}

function fatoMesmoCargo(tipo: typeof TIPO_FATO_POSSE, efeito: string, registro: string, amparo?: Amparo): Omit<Fato, "id"> {
  return {
    ...(amparo !== undefined ? { amparo } : {}),
    alvo: { escopo: "historia", historiaId: MESMO_CARGO_ALVO.historiaId },
    tipo,
    versaoDoTipo: 1,
    conteudo: { cargo: "B6" },
    dataEfeito: dataEfeito(efeito),
    dataRegistro: dataRegistro(registro),
    autor: AUTOR,
  };
}

export interface CenarioRetroativo {
  readonly servico: ServicoFolha;
  /** Competência (AAAA-MM) → folha mensal fechada. */
  readonly folhas: ReadonlyMap<string, FolhaId>;
  /** A promoção do Victor como gravada (dataRegistro canônica). */
  readonly promocao: Fato;
  /** Todos os fatos do Victor como gravados, para o extrato. */
  readonly fatos: ReadonlyMap<FatoId, Fato>;
}

async function fecharMensal(servico: ServicoFolha, competencia: Competencia): Promise<FolhaId> {
  const id = await servico.abrir(competencia, MENSAL);
  await servico.travarCorte(id, corteDe(competencia), AUTOR);
  await servico.fechar(id, AUTOR, fechamentoDe(competencia));
  return id;
}

export async function montarCenarioRetroativo(pool: Pool): Promise<CenarioRetroativo> {
  const servico = criarServicoFolha({ pool, configuracao: configuracaoAlrn(), cadastro: cadastroEmMemoria([VICTOR_ALVO, MESMO_CARGO_ALVO]) });
  const fatosRepo = fatoRepositorioPg(pool, criarCatalogoTiposDeFato());
  const folhas = new Map<string, FolhaId>();

  // 1.
  const inicio = await semearFatos(pool, [VICTOR_FATO_POSSE, VICTOR_FATO_NASCIMENTO]);
  await fatosRepo.registrar(fatoMesmoCargo(TIPO_FATO_POSSE, "2020-03-01", "2020-03-01T00:00:00Z"));

  // 2.
  for (const competencia of COMPETENCIAS_FECHADAS.slice(0, 6)) {
    folhas.set(competencia.toString(), await fecharMensal(servico, competencia));
  }

  // 3.
  const promocao = await semearFatos(pool, [VICTOR_FATO_PROMOCAO]);
  await fatosRepo.registrar(fatoMesmoCargo(TIPO_FATO_PROMOCAO, "2026-02-15", "2026-07-10T00:00:00Z", amparoProcesso("124/2026", "2026-02-15")));

  // 4.
  const julho = COMPETENCIAS_FECHADAS[6]!;
  folhas.set(julho.toString(), await fecharMensal(servico, julho));

  return {
    servico,
    folhas,
    promocao: [...promocao.fatos.values()][0]!,
    fatos: new Map([...inicio.fatos, ...promocao.fatos]),
  };
}
