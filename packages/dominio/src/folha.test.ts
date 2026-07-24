import { describe, expect, it } from "vitest";
import { TRANSICOES, type EstadoFolha } from "./folha.js";

const TODOS_OS_ESTADOS: readonly EstadoFolha[] = ["aberta", "em_conferencia", "fechada", "cancelada"];

describe("TRANSICOES", () => {
  it("é exaustivo: toda EstadoFolha tem uma entrada na tabela", () => {
    expect(Object.keys(TRANSICOES).sort()).toEqual([...TODOS_OS_ESTADOS].sort());
  });

  describe("linha a linha", () => {
    it("aberta -> em_conferencia ou cancelada, nada mais", () => {
      expect(TRANSICOES.aberta).toEqual(["em_conferencia", "cancelada"]);
    });

    it("em_conferencia -> aberta (devolvida) ou fechada, nada mais", () => {
      expect(TRANSICOES.em_conferencia).toEqual(["aberta", "fechada"]);
    });

    it("fechada é terminal: NENHUMA transição sai dela", () => {
      expect(TRANSICOES.fechada).toEqual([]);
    });

    it("cancelada é terminal: NENHUMA transição sai dela", () => {
      expect(TRANSICOES.cancelada).toEqual([]);
    });
  });

  describe("matriz completa de legalidade (16 combinações)", () => {
    const LEGAIS = new Set(["aberta->em_conferencia", "aberta->cancelada", "em_conferencia->aberta", "em_conferencia->fechada"]);

    for (const de of TODOS_OS_ESTADOS) {
      for (const para of TODOS_OS_ESTADOS) {
        const par = `${de}->${para}`;
        const deveSerLegal = LEGAIS.has(par);
        it(`${par} é ${deveSerLegal ? "legal" : "ilegal"}`, () => {
          expect(TRANSICOES[de].includes(para)).toBe(deveSerLegal);
        });
      }
    }
  });
});
