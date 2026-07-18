import { describe, expect, it } from "vitest";
import { Percentual } from "./percentual.js";

describe("Percentual", () => {
  it.each([
    ["15", "0.15"],
    ["0", "0"],
    ["100", "1"],
    ["33.33", "0.3333"],
    ["-10", "-0.1"],
  ])("de('%s').comoFator() === %s", (valor, esperado) => {
    expect(Percentual.de(valor).comoFator().toString()).toBe(esperado);
  });

  it.each(["abc", ""])("de('%s') lança erro para entrada inválida", (valor) => {
    expect(() => Percentual.de(valor)).toThrow();
  });
});
