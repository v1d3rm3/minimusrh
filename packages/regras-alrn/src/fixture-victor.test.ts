import { Amparo, Competencia, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { TIPO_AMPARO_PROCESSO } from "./catalogo-amparos.js";
import { TIPO_FATO_POSSE, TIPO_FATO_PROMOCAO } from "./catalogo-tipos-fato.js";
import { DERIVACAO_CARGO_IMPL } from "./derivacao-cargo.js";
import { VICTOR_FATO_PROMOCAO, VICTOR_HISTORIA_ID, amparoOuFalha, criarLinhaDoTempoVictor } from "./fixture-victor.js";

const CARGO_V1 = DERIVACAO_CARGO_IMPL.versoes[0]!;
const COMPETENCIA_ABRIL = Competencia.de(2026, 4);

describe("fixture Victor", () => {
  it("aberturaDaHistoria é a posse, com o cargo inicial B6", () => {
    const linha = criarLinhaDoTempoVictor(dataRegistro("2026-12-31T00:00:00Z"));
    expect(linha.historiaId).toBe(VICTOR_HISTORIA_ID);
    expect(linha.aberturaDaHistoria().tipo).toBe(TIPO_FATO_POSSE);
  });

  it("não tem fato de encerramento (história em curso)", () => {
    const linha = criarLinhaDoTempoVictor(dataRegistro("2026-12-31T00:00:00Z"));
    expect(linha.encerramentoDaHistoria()).toBeUndefined();
  });

  it("a promoção carrega o amparo 'processo 123/2026' já validado", () => {
    expect(VICTOR_FATO_PROMOCAO.amparo).toBeInstanceOf(Amparo);
    expect(VICTOR_FATO_PROMOCAO.amparo?.identificacaoCanonica).toBe("123/2026");
  });

  it("bitemporalidade: corte em maio (antes do registro em julho) vê cargo B6 em abril", () => {
    const linha = criarLinhaDoTempoVictor(dataRegistro("2026-05-01T00:00:00Z"));
    const cargoEmAbril = CARGO_V1.derivar(linha, dataEfeito("2026-04-20"), COMPETENCIA_ABRIL);
    expect(cargoEmAbril).toBe("B6");
    expect(linha.vigenteEm(TIPO_FATO_PROMOCAO, dataEfeito("2026-04-20"))).toBeUndefined();
  });

  it("bitemporalidade: corte em agosto (depois do registro em julho) vê cargo B8 em abril", () => {
    const linha = criarLinhaDoTempoVictor(dataRegistro("2026-08-01T00:00:00Z"));
    const cargoEmAbril = CARGO_V1.derivar(linha, dataEfeito("2026-04-20"), COMPETENCIA_ABRIL);
    expect(cargoEmAbril).toBe("B8");
  });

  it("amparoOuFalha lança um erro legível quando a entrada não bate com a máscara do catálogo", () => {
    expect(() => amparoOuFalha(TIPO_AMPARO_PROCESSO, "nao-eh-um-processo", dataEfeito("2026-02-15"))).toThrow(
      /amparo/,
    );
  });
});
