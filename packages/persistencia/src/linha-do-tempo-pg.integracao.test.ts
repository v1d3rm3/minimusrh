import { randomUUID } from "node:crypto";
import { dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { HistoriaId, PessoaId } from "@minimusrh/dominio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fatoRepositorioPg } from "./fato-repositorio.js";
import { linhaDoTempoPg } from "./linha-do-tempo-pg.js";
import { subirAmbiente, type AmbienteIntegracao } from "./testes/ambiente-integracao.js";
import { catalogoDeTeste, fatoCargo, fatoPosse, TIPO_CARGO } from "./testes/fixtures.js";

// linha-do-tempo-pg.integracao.test.ts — cenário Victor (Módulo 3, testes obrigatórios):
// bitemporalidade, substituição e a cadeia A←B←C (DECISOES #5). `cargo` é o tipo de fato
// de fixture descrito em testes/fixtures.ts (a derivação real posse+promoção→cargo
// pertence a `regras-alrn`, fora de escopo deste módulo).

describe("linha-do-tempo-pg (integracao)", () => {
  let ambiente: AmbienteIntegracao;

  beforeAll(async () => {
    ambiente = await subirAmbiente();
  });

  afterAll(async () => {
    await ambiente.encerrar();
  });

  it("cenario Victor: promocao com efeito fev/registro jul - corte maio ve B6, corte agosto ve B8", async () => {
    const catalogo = catalogoDeTeste();
    const repositorio = fatoRepositorioPg(ambiente.poolApp, catalogo);
    const pessoaId = randomUUID() as PessoaId;
    const historiaId = randomUUID() as HistoriaId;

    await repositorio.registrar(fatoPosse(historiaId, "B6", "2026-01-01", "2026-01-01T00:00:00Z"));
    await repositorio.registrar(fatoCargo(historiaId, "B6", "2026-01-01", "2026-01-01T00:00:00Z"));
    await repositorio.registrar(fatoCargo(historiaId, "B8", "2026-02-01", "2026-07-01T00:00:00Z"));

    const alvo = { pessoaId, historiaId };

    const linhaCorteMaio = await linhaDoTempoPg(ambiente.poolApp, catalogo, alvo, dataRegistro("2026-05-01T00:00:00Z"));
    const cargoAbrilCorteMaio = linhaCorteMaio.vigenteEm<{ cargo: string }>(TIPO_CARGO, dataEfeito("2026-04-01"));
    expect(cargoAbrilCorteMaio?.conteudo.cargo).toBe("B6");

    const linhaCorteAgosto = await linhaDoTempoPg(ambiente.poolApp, catalogo, alvo, dataRegistro("2026-08-01T00:00:00Z"));
    const cargoAbrilCorteAgosto = linhaCorteAgosto.vigenteEm<{ cargo: string }>(TIPO_CARGO, dataEfeito("2026-04-01"));
    expect(cargoAbrilCorteAgosto?.conteudo.cargo).toBe("B8");
  });

  it("substituicao: fato corrigido some da leitura apos o corte incluir a correcao; permanece visivel com corte anterior", async () => {
    const catalogo = catalogoDeTeste();
    const repositorio = fatoRepositorioPg(ambiente.poolApp, catalogo);
    const pessoaId = randomUUID() as PessoaId;
    const historiaId = randomUUID() as HistoriaId;

    await repositorio.registrar(fatoPosse(historiaId, "B6", "2026-01-01", "2026-01-01T00:00:00Z"));
    const idOriginal = await repositorio.registrar(fatoCargo(historiaId, "B7", "2026-01-01", "2026-01-02T00:00:00Z"));
    await repositorio.registrar(fatoCargo(historiaId, "B6", "2026-01-01", "2026-03-01T00:00:00Z", idOriginal));

    const alvo = { pessoaId, historiaId };

    const linhaAntesDaCorrecao = await linhaDoTempoPg(
      ambiente.poolApp,
      catalogo,
      alvo,
      dataRegistro("2026-02-01T00:00:00Z"),
    );
    const fatosAntes = linhaAntesDaCorrecao.todosDoTipo<{ cargo: string }>(TIPO_CARGO);
    expect(fatosAntes).toHaveLength(1);
    expect(fatosAntes[0]?.id).toBe(idOriginal);
    expect(fatosAntes[0]?.conteudo.cargo).toBe("B7");

    const linhaDepoisDaCorrecao = await linhaDoTempoPg(
      ambiente.poolApp,
      catalogo,
      alvo,
      dataRegistro("2026-04-01T00:00:00Z"),
    );
    const fatosDepois = linhaDepoisDaCorrecao.todosDoTipo<{ cargo: string }>(TIPO_CARGO);
    expect(fatosDepois).toHaveLength(1);
    expect(fatosDepois[0]?.id).not.toBe(idOriginal);
    expect(fatosDepois[0]?.conteudo.cargo).toBe("B6");
  });

  it("cadeia de substituicao A<-B<-C: cada corte enxerga exatamente a ponta conhecida ate ele (DECISOES #5)", async () => {
    const catalogo = catalogoDeTeste();
    const repositorio = fatoRepositorioPg(ambiente.poolApp, catalogo);
    const pessoaId = randomUUID() as PessoaId;
    const historiaId = randomUUID() as HistoriaId;

    await repositorio.registrar(fatoPosse(historiaId, "B6", "2026-01-01", "2026-01-01T00:00:00Z"));
    const idA = await repositorio.registrar(fatoCargo(historiaId, "errado-1", "2026-01-01", "2026-01-02T00:00:00Z"));
    const idB = await repositorio.registrar(
      fatoCargo(historiaId, "errado-2", "2026-01-01", "2026-02-01T00:00:00Z", idA),
    );
    const idC = await repositorio.registrar(
      fatoCargo(historiaId, "correto", "2026-01-01", "2026-03-01T00:00:00Z", idB),
    );

    const alvo = { pessoaId, historiaId };

    const soA = await linhaDoTempoPg(ambiente.poolApp, catalogo, alvo, dataRegistro("2026-01-15T00:00:00Z"));
    expect(soA.todosDoTipo(TIPO_CARGO).map((f) => f.id)).toEqual([idA]);

    const aEB = await linhaDoTempoPg(ambiente.poolApp, catalogo, alvo, dataRegistro("2026-02-15T00:00:00Z"));
    expect(aEB.todosDoTipo(TIPO_CARGO).map((f) => f.id)).toEqual([idB]);

    const aBeC = await linhaDoTempoPg(ambiente.poolApp, catalogo, alvo, dataRegistro("2026-03-15T00:00:00Z"));
    expect(aBeC.todosDoTipo(TIPO_CARGO).map((f) => f.id)).toEqual([idC]);
  });
});
