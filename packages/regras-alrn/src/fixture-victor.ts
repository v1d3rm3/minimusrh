import { Amparo, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { DataRegistro, Fato, FatoId, HistoriaId, LinhaDoTempo, PessoaId } from "@minimusrh/dominio";
import { TIPO_AMPARO_PROCESSO, criarCatalogoAmparos } from "./catalogo-amparos.js";
import { TIPO_FATO_NASCIMENTO, TIPO_FATO_POSSE, TIPO_FATO_PROMOCAO, criarCatalogoTiposDeFato } from "./catalogo-tipos-fato.js";
import { linhaDoTempoEmMemoria } from "./linha-do-tempo-em-memoria.js";
import { criarFato } from "./testes/fabrica-fato.js";

// fixture-victor.ts — o cenário de referência da série (Fundação Decisão 1 e §5.3, Roteiro
// Marco 1-2): Victor toma posse em B6 em 2020, nasce em 1990, e é promovido a B8 com
// EFEITO em 15/02/2026, mas só REGISTRADO em 10/07/2026 — o caso que prova a
// bitemporalidade em código. Reutilizável pelos testes deste pacote e pelos módulos 5-6
// (por isso mora em `src/` e é reexportada por `index.ts`, não em `src/testes/`, que fica
// de fora do `package.json exports` — ver DECISOES #11).
export const VICTOR_HISTORIA_ID = "vitor" as HistoriaId;
export const VICTOR_PESSOA_ID = "vitor-pessoa" as PessoaId;

const CATALOGO_AMPAROS = criarCatalogoAmparos();

export function amparoOuFalha(tipo: Parameters<typeof Amparo.criar>[0], entrada: string, em: ReturnType<typeof dataEfeito>): Amparo {
  const resultado = Amparo.criar(tipo, entrada, CATALOGO_AMPAROS, em);
  if (!(resultado instanceof Amparo)) {
    throw new Error(`fixture Victor: amparo '${entrada}' inválido contra o catálogo: ${resultado.erro}`);
  }
  return resultado;
}

export const VICTOR_FATO_POSSE: Fato<{ readonly cargo: string }> = criarFato({
  id: "fato-vitor-posse" as FatoId,
  tipo: TIPO_FATO_POSSE,
  dataEfeito: dataEfeito("2020-03-01"),
  dataRegistro: dataRegistro("2020-03-01T00:00:00Z"),
  historiaId: VICTOR_HISTORIA_ID,
  conteudo: { cargo: "B6" },
});

export const VICTOR_FATO_NASCIMENTO: Fato = criarFato({
  id: "fato-vitor-nascimento" as FatoId,
  tipo: TIPO_FATO_NASCIMENTO,
  dataEfeito: dataEfeito("1990-05-20"),
  dataRegistro: dataRegistro("1990-05-20T00:00:00Z"),
  alvo: { escopo: "pessoa", pessoaId: VICTOR_PESSOA_ID },
});

// Promoção B6 → B8: efeito em fevereiro, registro em julho (o processo que sustenta a
// concessão, Fundação §3.3). Amparo já validado contra o catálogo desta ALRN.
export const VICTOR_FATO_PROMOCAO: Fato<{ readonly cargo: string }> = criarFato({
  id: "fato-vitor-promocao" as FatoId,
  tipo: TIPO_FATO_PROMOCAO,
  dataEfeito: dataEfeito("2026-02-15"),
  dataRegistro: dataRegistro("2026-07-10T00:00:00Z"),
  historiaId: VICTOR_HISTORIA_ID,
  conteudo: { cargo: "B8" },
  amparo: amparoOuFalha(TIPO_AMPARO_PROCESSO, "123/2026", dataEfeito("2026-02-15")),
});

export const VICTOR_FATOS: readonly Fato[] = [VICTOR_FATO_POSSE, VICTOR_FATO_NASCIMENTO, VICTOR_FATO_PROMOCAO];

// A LinhaDoTempo do Victor tal como conhecida até `corte` — parametrizada para comparar
// cortes diferentes sobre o MESMO conjunto de fatos (Fundação §5.3).
export function criarLinhaDoTempoVictor(corte: DataRegistro): LinhaDoTempo {
  return linhaDoTempoEmMemoria(criarCatalogoTiposDeFato(), VICTOR_HISTORIA_ID, VICTOR_FATOS, corte);
}
