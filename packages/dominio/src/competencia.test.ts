import { describe, expect, it } from "vitest";
import { Competencia, dataEfeito, dataRegistro, type DataEfeito } from "./competencia.js";

describe("dataEfeito()", () => {
  it.each(["2026-03-15", "2024-02-29", "2000-01-01"])("aceita data válida: %s", (iso) => {
    expect(dataEfeito(iso)).toBe(iso);
  });

  it.each([
    "2026-02-30",     // fevereiro não tem dia 30
    "2023-02-29",     // 2023 não é bissexto
    "2026-13-01",     // mês inválido
    "2026-00-01",     // mês inválido
    "2026-04-31",     // abril tem 30 dias
    "26-03-15",       // ano com menos de 4 dígitos
    "2026-3-15",      // mês sem zero à esquerda
    "2026-03-15T00:00:00Z", // não é data-de-efeito, é timestamp
    "",
  ])("rejeita data inválida: '%s'", (iso) => {
    expect(() => dataEfeito(iso)).toThrow();
  });
});

describe("dataRegistro()", () => {
  it.each([
    ["2026-03-15T00:00:00Z", "2026-03-15T00:00:00.000Z"],
    ["2026-03-15T10:30:00.123Z", "2026-03-15T10:30:00.123Z"],
    ["2026-03-15T10:30:00.5Z", "2026-03-15T10:30:00.500Z"],
    ["2026-03-15T10:30:00-03:00", "2026-03-15T13:30:00.000Z"],
    ["2026-03-15T01:00:00+02:00", "2026-03-14T23:00:00.000Z"],
    ["2024-02-29T23:59:59.999Z", "2024-02-29T23:59:59.999Z"],
  ])("aceita %s e devolve a forma canônica %s (UTC, milissegundos)", (iso, canonica) => {
    expect(dataRegistro(iso)).toBe(canonica);
  });

  it("o mesmo instante em grafias diferentes vira a MESMA DataRegistro — comparação textual segura", () => {
    const grafias = ["2026-08-01T00:00:00Z", "2026-08-01T00:00:00.000Z", "2026-07-31T21:00:00-03:00"].map(dataRegistro);
    expect(new Set(grafias).size).toBe(1);
    // o caso que motivou a canonização: sem ela, "…00Z" > "…00.000Z" e o fato ficaria fora do corte
    expect(dataRegistro("2026-08-01T00:00:00Z") <= dataRegistro("2026-08-01T00:00:00.000Z")).toBe(true);
  });

  it("canônica é ponto fixo: canonizar de novo não muda nada", () => {
    const uma = dataRegistro("2026-07-31T21:00:00-03:00");
    expect(dataRegistro(uma)).toBe(uma);
  });

  it.each([
    "2026-03-15",                       // falta a parte de horário
    "2026-13-15T00:00:00Z",             // mês inválido
    "2026-02-30T00:00:00Z",             // dia fora do calendário (o Date do JS "rolaria" para 02/03)
    "2025-02-29T00:00:00Z",             // 29/02 em ano não bissexto
    "2026-03-15T24:00:00Z",             // hora 24 (o Date do JS rolaria para o dia seguinte)
    "2026-03-15T10:60:00Z",             // minuto 60
    "2026-03-15T10:30:60Z",             // segundo 60
    "2026-03-15T10:30:00+24:00",        // fuso fora do intervalo
    "2026-03-15T10:30:00+03:60",        // minuto de fuso fora do intervalo
    "2026-03-15T10:30:00.123456Z",      // abaixo do milissegundo: truncar mudaria o instante
    "2026-03-15T10:30:00",              // sem fuso: instante ambíguo
    "não é uma data",
    "",
  ])("rejeita timestamp inválido: '%s'", (iso) => {
    expect(() => dataRegistro(iso)).toThrow(/dataRegistro inválida/);
  });
});

describe("Competencia", () => {
  describe("de()", () => {
    it("cria uma competência válida", () => {
      const c = Competencia.de(2026, 3);
      expect(c.ano).toBe(2026);
      expect(c.mes).toBe(3);
    });

    it.each([0, 13, -1, 1.5])("lança erro para mes inválido: %s", (mes) => {
      expect(() => Competencia.de(2026, mes)).toThrow();
    });

    it.each([0, -1, 1.5])("lança erro para ano inválido: %s", (ano) => {
      expect(() => Competencia.de(ano, 1)).toThrow();
    });
  });

  describe("anterior()", () => {
    it("decrementa o mês dentro do mesmo ano", () => {
      const c = Competencia.de(2026, 3).anterior();
      expect(c.igual(Competencia.de(2026, 2))).toBe(true);
    });

    it("vira o ano ao cruzar janeiro", () => {
      const c = Competencia.de(2026, 1).anterior();
      expect(c.igual(Competencia.de(2025, 12))).toBe(true);
    });
  });

  describe("ultimas()", () => {
    it("retorna n competências da mais antiga pra mais nova, incluindo this", () => {
      const janela = Competencia.de(2026, 3).ultimas(3);
      expect(janela.map((c) => c.toString())).toEqual(["2026-01", "2026-02", "2026-03"]);
    });

    it("cruza a virada de ano quando necessário", () => {
      const janela = Competencia.de(2026, 2).ultimas(4);
      expect(janela.map((c) => c.toString())).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    });

    it.each([0, -1, 1.5])("lança erro para n inválido: %s", (n) => {
      expect(() => Competencia.de(2026, 3).ultimas(n)).toThrow();
    });
  });

  describe("dataReferencia()", () => {
    it.each([
      [2026, 1, "2026-01-31"],
      [2026, 4, "2026-04-30"],
      [2024, 2, "2024-02-29"], // bissexto
      [2023, 2, "2023-02-28"], // não bissexto
      [1900, 2, "1900-02-28"], // múltiplo de 100, não múltiplo de 400 -> não bissexto
      [2000, 2, "2000-02-29"], // múltiplo de 400 -> bissexto
    ])("competência %i-%i tem data de referência %s", (ano, mes, esperado) => {
      expect(Competencia.de(ano, mes).dataReferencia()).toBe(esperado);
    });
  });

  describe("contem()", () => {
    const competencia = Competencia.de(2026, 3);

    it("true para data dentro do mês/ano, incluindo bordas", () => {
      expect(competencia.contem("2026-03-01" as DataEfeito)).toBe(true);
      expect(competencia.contem("2026-03-15" as DataEfeito)).toBe(true);
      expect(competencia.contem("2026-03-31" as DataEfeito)).toBe(true);
    });

    it("false para mês diferente", () => {
      expect(competencia.contem("2026-04-01" as DataEfeito)).toBe(false);
    });

    it("false para ano diferente", () => {
      expect(competencia.contem("2025-03-01" as DataEfeito)).toBe(false);
    });
  });

  describe("toString()", () => {
    it("formata como YYYY-MM com mês com 2 dígitos", () => {
      expect(Competencia.de(2026, 3).toString()).toBe("2026-03");
      expect(Competencia.de(2026, 12).toString()).toBe("2026-12");
    });
  });

  describe("igual()", () => {
    it("true para mesma competência", () => {
      expect(Competencia.de(2026, 3).igual(Competencia.de(2026, 3))).toBe(true);
    });

    it("false para mês diferente", () => {
      expect(Competencia.de(2026, 3).igual(Competencia.de(2026, 4))).toBe(false);
    });

    it("false para ano diferente", () => {
      expect(Competencia.de(2026, 3).igual(Competencia.de(2025, 3))).toBe(false);
    });
  });
});
