import { describe, expect, it } from "vitest";
import { versaoVigente, type ComVigencia } from "./vigencia.js";
import type { DataEfeito, DataRegistro } from "./competencia.js";

interface VersaoTeste extends ComVigencia {
  readonly nome: string;
}

function v(
  nome: string,
  dataEfeito: string,
  dataRegistro: string,
  dataFimEfeito?: string,
): VersaoTeste {
  return {
    nome,
    dataEfeito: dataEfeito as DataEfeito,
    dataRegistro: dataRegistro as DataRegistro,
    ...(dataFimEfeito !== undefined ? { dataFimEfeito: dataFimEfeito as DataEfeito } : {}),
  };
}

const em = (s: string) => s as DataEfeito;
const corte = (s: string) => s as DataRegistro;

describe("versaoVigente", () => {
  it("escolhe a versão de maior dataEfeito <= em", () => {
    const versoes = [
      v("v1", "2026-01-01", "2026-01-01T00:00:00Z"),
      v("v2", "2026-06-01", "2026-06-01T00:00:00Z"),
      v("v3", "2026-12-01", "2026-12-01T00:00:00Z"),
    ];
    const r = versaoVigente(versoes, em("2026-07-15"), corte("2027-01-01T00:00:00Z"));
    expect(r?.nome).toBe("v2");
  });

  it("retorna undefined quando nenhuma versão tem dataEfeito <= em", () => {
    const versoes = [v("v1", "2026-06-01", "2026-06-01T00:00:00Z")];
    const r = versaoVigente(versoes, em("2026-01-01"), corte("2027-01-01T00:00:00Z"));
    expect(r).toBeUndefined();
  });

  it("ignora versões registradas depois do corte (como foi pago na época)", () => {
    const versoes = [
      v("v1", "2026-01-01", "2026-01-01T00:00:00Z"),
      v("v2-correcao-tardia", "2026-01-01", "2026-08-01T00:00:00Z"),
    ];
    const naEpoca = versaoVigente(versoes, em("2026-05-01"), corte("2026-02-01T00:00:00Z"));
    expect(naEpoca?.nome).toBe("v1");

    const hoje = versaoVigente(versoes, em("2026-05-01"), corte("2027-01-01T00:00:00Z"));
    expect(hoje?.nome).toBe("v2-correcao-tardia");
  });

  it("respeita dataFimEfeito e volta pra base quando a versão temporária expira (limite exclusivo)", () => {
    const versoes = [
      v("base", "2020-01-01", "2020-01-01T00:00:00Z"),
      v("temporaria", "2026-06-01", "2026-06-01T00:00:00Z", "2026-08-01"),
    ];
    expect(versaoVigente(versoes, em("2026-07-01"), corte("2027-01-01T00:00:00Z"))?.nome).toBe("temporaria");
    // no próprio dia de dataFimEfeito, a versão já não vale mais
    expect(versaoVigente(versoes, em("2026-08-01"), corte("2027-01-01T00:00:00Z"))?.nome).toBe("base");
    expect(versaoVigente(versoes, em("2026-09-01"), corte("2027-01-01T00:00:00Z"))?.nome).toBe("base");
  });

  it("em empate de dataEfeito, vence a de maior dataRegistro (correção mais recente)", () => {
    const versoes = [
      v("original", "2026-03-01", "2026-01-01T00:00:00Z"),
      v("corrigida", "2026-03-01", "2026-06-01T00:00:00Z"),
    ];
    const r = versaoVigente(versoes, em("2026-04-01"), corte("2027-01-01T00:00:00Z"));
    expect(r?.nome).toBe("corrigida");
  });

  it("retorna undefined para lista vazia", () => {
    expect(versaoVigente([], em("2026-01-01"), corte("2026-01-01T00:00:00Z"))).toBeUndefined();
  });

  it("o retroativo é a diferença entre o corte de hoje e o corte da época", () => {
    const versoes = [
      v("v1", "2026-01-01", "2026-01-01T00:00:00Z"),
      v("v1-corrigida", "2026-01-01", "2026-09-01T00:00:00Z"),
    ];
    const comoFoiPago = versaoVigente(versoes, em("2026-03-01"), corte("2026-02-01T00:00:00Z"));
    const comoDeveriaSer = versaoVigente(versoes, em("2026-03-01"), corte("2026-12-01T00:00:00Z"));
    expect(comoFoiPago?.nome).toBe("v1");
    expect(comoDeveriaSer?.nome).toBe("v1-corrigida");
  });
});
