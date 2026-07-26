import { dataEfeito } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { partesDataEfeito } from "./data-util.js";

describe("partesDataEfeito", () => {
  it("extrai ano, mês e dia como números", () => {
    expect(partesDataEfeito(dataEfeito("2026-02-15"))).toEqual({ ano: 2026, mes: 2, dia: 15 });
  });

  it("não perde zeros à esquerda em mês/dia", () => {
    expect(partesDataEfeito(dataEfeito("2026-01-01"))).toEqual({ ano: 2026, mes: 1, dia: 1 });
  });
});
