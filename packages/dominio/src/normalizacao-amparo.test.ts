import { describe, expect, it } from "vitest";
import { normalizarAmparo, type ErroValidacao } from "./normalizacao-amparo.js";
import type { VersaoTipoAmparo } from "./catalogo-amparos.js";
import type { DataEfeito, DataRegistro } from "./competencia.js";

function versao(overrides: Partial<VersaoTipoAmparo>): VersaoTipoAmparo {
  return {
    versao: 1,
    dataEfeito: "2026-01-01" as DataEfeito,
    dataRegistro: "2026-01-01T00:00:00Z" as DataRegistro,
    mascara: String.raw`(\d+)/(\d{4})`,
    grupos: [
      { nome: "numero", tipo: "numero" },
      { nome: "ano", tipo: "ano" },
    ],
    formatoCanonico: "{numero}/{ano}",
    exemplo: "123/2026",
    ...overrides,
  };
}

function ehErro(r: { readonly canonica: string } | ErroValidacao): r is ErroValidacao {
  return "erro" in r;
}

describe("normalizarAmparo", () => {
  it("canonicaliza removendo zeros à esquerda do grupo numero", () => {
    const r = normalizarAmparo(versao({}), "0045/2026");
    expect(ehErro(r)).toBe(false);
    expect((r as { canonica: string }).canonica).toBe("45/2026");
  });

  it("colapsa um grupo numero totalmente zerado em um único zero", () => {
    const r = normalizarAmparo(versao({}), "000/2026");
    expect((r as { canonica: string }).canonica).toBe("0/2026");
  });

  it("faz trim da entrada antes de validar", () => {
    const r = normalizarAmparo(versao({}), "  45/2026  ");
    expect((r as { canonica: string }).canonica).toBe("45/2026");
  });

  it("mantém numero já sem zeros à esquerda inalterado", () => {
    const r = normalizarAmparo(versao({}), "45/2026");
    expect((r as { canonica: string }).canonica).toBe("45/2026");
  });

  it("retorna ErroValidacao citando o exemplo quando a entrada não casa com a máscara", () => {
    const r = normalizarAmparo(versao({}), "abc");
    expect(ehErro(r)).toBe(true);
    expect((r as ErroValidacao).erro).toContain("123/2026");
  });

  it("retorna ErroValidacao quando a entrada casa apenas parcialmente", () => {
    const r = normalizarAmparo(versao({}), "45/2026 lixo");
    expect(ehErro(r)).toBe(true);
  });

  it("retorna ErroValidacao quando o grupo 'ano' não tem 4 dígitos, mesmo com máscara frouxa", () => {
    const r = normalizarAmparo(
      versao({ mascara: String.raw`(\d+)/(\d+)` }),
      "45/26",
    );
    expect(ehErro(r)).toBe(true);
  });

  it("canonicaliza grupo texto com trim e caixa alta", () => {
    const r = normalizarAmparo(
      versao({
        mascara: String.raw`([a-zA-Z ]+)`,
        grupos: [{ nome: "texto", tipo: "texto" }],
        formatoCanonico: "{texto}",
        exemplo: "outro",
      }),
      "  processo abc  ",
    );
    expect((r as { canonica: string }).canonica).toBe("PROCESSO ABC");
  });

  it("injeta os grupos no formatoCanonico pelo nome, independente da ordem de captura", () => {
    const r = normalizarAmparo(
      versao({ formatoCanonico: "{ano}/{numero}" }),
      "0045/2026",
    );
    expect((r as { canonica: string }).canonica).toBe("2026/45");
  });

  it("trata grupo de captura opcional não casado como string vazia", () => {
    const r = normalizarAmparo(
      versao({
        mascara: String.raw`(\d+)(?:/(\d{4}))?`,
        grupos: [
          { nome: "numero", tipo: "numero" },
          { nome: "ano", tipo: "ano" },
        ],
      }),
      "45",
    );
    // grupo 'ano' não participou do casamento => vira '', que não tem 4 dígitos => erro
    expect(ehErro(r)).toBe(true);
  });

  it("injeta string vazia quando formatoCanonico referencia um nome de grupo inexistente", () => {
    const r = normalizarAmparo(
      versao({ formatoCanonico: "{numero}/{grupoInexistente}" }),
      "0045/2026",
    );
    expect((r as { canonica: string }).canonica).toBe("45/");
  });
});
