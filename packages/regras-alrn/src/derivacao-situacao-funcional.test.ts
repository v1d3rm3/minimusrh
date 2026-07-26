import { Competencia, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { HistoriaId } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { TIPO_FATO_EXONERACAO, TIPO_FATO_POSSE, criarCatalogoTiposDeFato } from "./catalogo-tipos-fato.js";
import { DERIVACAO_SITUACAO_FUNCIONAL_IMPL } from "./derivacao-situacao-funcional.js";
import { linhaDoTempoEmMemoria } from "./linha-do-tempo-em-memoria.js";
import { criarFato } from "./testes/fabrica-fato.js";

const CATALOGO = criarCatalogoTiposDeFato();
const HISTORIA = "h1" as HistoriaId;
const COMPETENCIA = Competencia.de(2026, 6);
const CORTE = dataRegistro("2026-12-31T00:00:00Z");
const V1 = DERIVACAO_SITUACAO_FUNCIONAL_IMPL.versoes[0]!;

const POSSE = criarFato({
  tipo: TIPO_FATO_POSSE,
  dataEfeito: dataEfeito("2020-03-01"),
  dataRegistro: dataRegistro("2020-03-01T00:00:00Z"),
  conteudo: { cargo: "B6" },
});

describe("derivacao situacao_funcional", () => {
  it("inativo antes da abertura da história", () => {
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [POSSE], CORTE);
    expect(V1.derivar(linha, dataEfeito("2020-01-01"), COMPETENCIA)).toBe("inativo");
  });

  it("ativo entre a abertura e o encerramento", () => {
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [POSSE], CORTE);
    expect(V1.derivar(linha, dataEfeito("2026-06-01"), COMPETENCIA)).toBe("ativo");
  });

  it("ativo indefinidamente quando não há fato de encerramento", () => {
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [POSSE], CORTE);
    expect(V1.derivar(linha, dataEfeito("2099-01-01"), COMPETENCIA)).toBe("ativo");
  });

  it("inativo a partir da dataEfeito do encerramento (inclusive)", () => {
    const exoneracao = criarFato({
      tipo: TIPO_FATO_EXONERACAO,
      dataEfeito: dataEfeito("2026-09-30"),
      dataRegistro: dataRegistro("2026-09-30T00:00:00Z"),
    });
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [POSSE, exoneracao], CORTE);

    expect(V1.derivar(linha, dataEfeito("2026-09-29"), COMPETENCIA)).toBe("ativo");
    expect(V1.derivar(linha, dataEfeito("2026-09-30"), COMPETENCIA)).toBe("inativo");
  });
});
