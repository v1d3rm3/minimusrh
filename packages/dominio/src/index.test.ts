import { describe, expect, it } from "vitest";
import { Dinheiro, Percentual, Competencia, versaoVigente, TRANSICOES, Amparo, normalizarAmparo } from "./index.js";

describe("@minimusrh/dominio", () => {
  it("expõe os tipos e funções públicos do domínio pelo index", () => {
    expect(Dinheiro.de("10").paraString()).toBe("10.00");
    expect(Percentual.de("10").comoFator().toString()).toBe("0.1");
    expect(Competencia.de(2026, 1).toString()).toBe("2026-01");
    expect(typeof versaoVigente).toBe("function");
    expect(TRANSICOES.fechada).toEqual([]);
    expect(typeof Amparo.legado).toBe("function");
    expect(typeof normalizarAmparo).toBe("function");
  });
});
