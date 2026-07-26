import { Competencia, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { Fato, HistoriaId } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { TIPO_FATO_POSSE, TIPO_FATO_PROMOCAO, criarCatalogoTiposDeFato } from "./catalogo-tipos-fato.js";
import { DERIVACAO_CARGO_IMPL } from "./derivacao-cargo.js";
import { linhaDoTempoEmMemoria } from "./linha-do-tempo-em-memoria.js";
import { criarFato } from "./testes/fabrica-fato.js";

const CATALOGO = criarCatalogoTiposDeFato();
const HISTORIA = "h1" as HistoriaId;
const COMPETENCIA = Competencia.de(2026, 4);
const V1 = DERIVACAO_CARGO_IMPL.versoes[0]!;

const POSSE_B6: Fato<{ cargo: string }> = criarFato({
  tipo: TIPO_FATO_POSSE,
  dataEfeito: dataEfeito("2020-03-01"),
  dataRegistro: dataRegistro("2020-03-01T00:00:00Z"),
  conteudo: { cargo: "B6" },
});

// Cenário Victor: promoção com efeito em fevereiro, registrada em julho (Fundação §5.3).
const PROMOCAO_B8: Fato<{ cargo: string }> = criarFato({
  tipo: TIPO_FATO_PROMOCAO,
  dataEfeito: dataEfeito("2026-02-15"),
  dataRegistro: dataRegistro("2026-07-10T00:00:00Z"),
  conteudo: { cargo: "B8" },
});

describe("derivacao cargo", () => {
  it("sem nenhum fato de posse/promocao: undefined", () => {
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [], dataRegistro("2026-01-01T00:00:00Z"));
    expect(V1.derivar(linha, dataEfeito("2021-01-01"), COMPETENCIA)).toBeUndefined();
  });

  it("só a posse conhecida: cargo da posse", () => {
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [POSSE_B6], dataRegistro("2026-01-01T00:00:00Z"));
    expect(V1.derivar(linha, dataEfeito("2021-01-01"), COMPETENCIA)).toBe("B6");
  });

  it("bitemporalidade Victor: corte em maio (antes do registro em julho) ⇒ cargo B6 em abril", () => {
    const corteMaio = dataRegistro("2026-05-01T00:00:00Z");
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [POSSE_B6, PROMOCAO_B8], corteMaio);
    expect(V1.derivar(linha, dataEfeito("2026-04-20"), COMPETENCIA)).toBe("B6");
  });

  it("bitemporalidade Victor: corte em agosto (depois do registro em julho) ⇒ cargo B8 em abril", () => {
    const corteAgosto = dataRegistro("2026-08-01T00:00:00Z");
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [POSSE_B6, PROMOCAO_B8], corteAgosto);
    expect(V1.derivar(linha, dataEfeito("2026-04-20"), COMPETENCIA)).toBe("B8");
  });

  it("com o corte de agosto, referência em janeiro ainda vê B6 (a promoção só tem efeito em fevereiro)", () => {
    const corteAgosto = dataRegistro("2026-08-01T00:00:00Z");
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [POSSE_B6, PROMOCAO_B8], corteAgosto);
    expect(V1.derivar(linha, dataEfeito("2026-01-15"), COMPETENCIA)).toBe("B6");
  });

  it("quando os dois tipos têm fato vigente, prevalece o de dataEfeito mais recente (aqui, a posse)", () => {
    const posseTardia = criarFato<{ cargo: string }>({
      tipo: TIPO_FATO_POSSE,
      dataEfeito: dataEfeito("2026-03-01"),
      dataRegistro: dataRegistro("2026-03-01T00:00:00Z"),
      conteudo: { cargo: "B9" },
    });
    const promocaoAntiga = criarFato<{ cargo: string }>({
      tipo: TIPO_FATO_PROMOCAO,
      dataEfeito: dataEfeito("2020-01-01"),
      dataRegistro: dataRegistro("2020-01-01T00:00:00Z"),
      conteudo: { cargo: "B1" },
    });
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [posseTardia, promocaoAntiga], dataRegistro("2026-04-01T00:00:00Z"));
    expect(V1.derivar(linha, dataEfeito("2026-04-01"), COMPETENCIA)).toBe("B9");
  });
});
