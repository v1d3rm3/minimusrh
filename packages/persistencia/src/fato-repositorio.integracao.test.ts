import { randomUUID } from "node:crypto";
import { Amparo, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { Autor, FatoId, HistoriaId, PessoaId, TipoAmparoChave } from "@minimusrh/dominio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErroRegistroFato, fatoRepositorioPg } from "./fato-repositorio.js";
import { subirAmbiente, type AmbienteIntegracao } from "./testes/ambiente-integracao.js";
import { catalogoDeTeste, fatoNascimento, TIPO_POSSE } from "./testes/fixtures.js";

// fato-repositorio.integracao.test.ts — round-trip completo de Fato com amparo (canônica
// indexável) e as 6 combinações Autor×AlvoFato exigidas pelo Módulo 3.

const AUTORES: ReadonlyArray<readonly [string, Autor]> = [
  ["humano", { tipo: "humano", usuarioId: "u1" }],
  ["sistema", { tipo: "sistema", regraConsistencia: "regra-x", versao: 1, gatilhos: ["f0" as FatoId] }],
  ["importacao", { tipo: "importacao", lote: "lote-1" }],
];

describe("fato-repositorio-pg (integracao)", () => {
  let ambiente: AmbienteIntegracao;
  const catalogo = catalogoDeTeste();

  beforeAll(async () => {
    ambiente = await subirAmbiente();
  });

  afterAll(async () => {
    await ambiente.encerrar();
  });

  it.each(AUTORES)("round-trip de Fato com Autor tipo '%s', alvo historia", async (_nome, autor) => {
    const repositorio = fatoRepositorioPg(ambiente.poolApp, catalogo);
    const historiaId = randomUUID() as HistoriaId;

    const id = await repositorio.registrar({
      alvo: { escopo: "historia", historiaId },
      tipo: TIPO_POSSE,
      versaoDoTipo: 1,
      conteudo: { cargo: "B6" },
      dataEfeito: dataEfeito("2026-01-01"),
      dataRegistro: dataRegistro("2026-01-01T00:00:00Z"),
      autor,
    });

    const lido = await repositorio.buscarPorId<{ cargo: string }>(id);
    expect(lido?.autor).toEqual(autor);
    expect(lido?.alvo).toEqual({ escopo: "historia", historiaId });
    expect(lido?.conteudo).toEqual({ cargo: "B6" });
  });

  it.each(AUTORES)("round-trip de Fato com Autor tipo '%s', alvo pessoa", async (_nome, autor) => {
    const repositorio = fatoRepositorioPg(ambiente.poolApp, catalogo);
    const pessoaId = randomUUID() as PessoaId;

    const id = await repositorio.registrar({
      ...fatoNascimento(pessoaId, "2026-01-01", "2026-01-01T00:00:00Z"),
      autor,
    });

    const lido = await repositorio.buscarPorId(id);
    expect(lido?.autor).toEqual(autor);
    expect(lido?.alvo).toEqual({ escopo: "pessoa", pessoaId });
  });

  it("round-trip de Fato com amparo (identificacao canonica indexavel)", async () => {
    const repositorio = fatoRepositorioPg(ambiente.poolApp, catalogo);
    const historiaId = randomUUID() as HistoriaId;
    const amparo = Amparo.legado("processo" as TipoAmparoChave, "0045/2026");

    const id = await repositorio.registrar({
      alvo: { escopo: "historia", historiaId },
      tipo: TIPO_POSSE,
      versaoDoTipo: 1,
      conteudo: { cargo: "B6" },
      dataEfeito: dataEfeito("2026-01-01"),
      dataRegistro: dataRegistro("2026-01-01T00:00:00Z"),
      autor: { tipo: "humano", usuarioId: "u1" },
      amparo,
    });

    const lido = await repositorio.buscarPorId<{ cargo: string }>(id);
    expect(lido?.amparo).toBeInstanceOf(Amparo);
    expect(lido?.amparo?.identificacaoCanonica).toBe("0045/2026");
    expect(lido?.amparo?.comoInformado).toBe("0045/2026");
  });

  it("mapeia substituiFatoId no round-trip", async () => {
    const repositorio = fatoRepositorioPg(ambiente.poolApp, catalogo);
    const historiaId = randomUUID() as HistoriaId;

    const idOriginal = await repositorio.registrar({
      alvo: { escopo: "historia", historiaId },
      tipo: TIPO_POSSE,
      versaoDoTipo: 1,
      conteudo: { cargo: "B6" },
      dataEfeito: dataEfeito("2026-01-01"),
      dataRegistro: dataRegistro("2026-01-01T00:00:00Z"),
      autor: { tipo: "humano", usuarioId: "u1" },
    });

    const idCorrecao = await repositorio.registrar({
      alvo: { escopo: "historia", historiaId },
      tipo: TIPO_POSSE,
      versaoDoTipo: 1,
      conteudo: { cargo: "B7" },
      dataEfeito: dataEfeito("2026-01-01"),
      dataRegistro: dataRegistro("2026-01-02T00:00:00Z"),
      autor: { tipo: "humano", usuarioId: "u1" },
      substituiFatoId: idOriginal,
    });

    const lido = await repositorio.buscarPorId<{ cargo: string }>(idCorrecao);
    expect(lido?.substituiFatoId).toBe(idOriginal);
  });

  it("registrar rejeita conteudo invalido ANTES de qualquer insert (ErroRegistroFato)", async () => {
    const repositorio = fatoRepositorioPg(ambiente.poolApp, catalogo);
    const historiaId = randomUUID() as HistoriaId;

    await expect(
      repositorio.registrar({
        alvo: { escopo: "historia", historiaId },
        tipo: TIPO_POSSE,
        versaoDoTipo: 1,
        conteudo: { cargoErrado: 123 },
        dataEfeito: dataEfeito("2026-01-01"),
        dataRegistro: dataRegistro("2026-01-01T00:00:00Z"),
        autor: { tipo: "humano", usuarioId: "u1" },
      }),
    ).rejects.toBeInstanceOf(ErroRegistroFato);
  });
});
