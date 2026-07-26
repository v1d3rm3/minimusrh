import { describe, expect, it } from "vitest";
import {
  CATALOGO_RUBRICAS,
  CLASSIFICACAO_INCIDE_PREVIDENCIA,
  RUBRICA_AUXILIO_SAUDE,
  RUBRICA_CONTRIBUICAO_PREVIDENCIA,
  RUBRICA_SALARIO_BASE,
  criarCatalogoRubricas,
} from "./catalogo-rubricas.js";

describe("catálogo de rubricas", () => {
  it("tem as 3 rubricas do escopo do Módulo 4", () => {
    expect(CATALOGO_RUBRICAS.map((r) => r.chave)).toEqual([
      RUBRICA_SALARIO_BASE,
      RUBRICA_AUXILIO_SAUDE,
      RUBRICA_CONTRIBUICAO_PREVIDENCIA,
    ]);
  });

  it("salario_base incide previdência, compõe teto e é proporcionalizável", () => {
    const versao = criarCatalogoRubricas().porChave(RUBRICA_SALARIO_BASE)?.versoes[0];
    expect(versao?.classificacoes.has(CLASSIFICACAO_INCIDE_PREVIDENCIA)).toBe(true);
    expect(versao?.proporcionalizavel).toBe(true);
    expect(versao?.natureza).toBe("vantagem");
  });

  it("auxilio_saude não incide previdência e não é proporcionalizável", () => {
    const versao = criarCatalogoRubricas().porChave(RUBRICA_AUXILIO_SAUDE)?.versoes[0];
    expect(versao?.classificacoes.size).toBe(0);
    expect(versao?.proporcionalizavel).toBe(false);
  });

  it("contribuicao_previdencia é rubrica de desconto", () => {
    const versao = criarCatalogoRubricas().porChave(RUBRICA_CONTRIBUICAO_PREVIDENCIA)?.versoes[0];
    expect(versao?.natureza).toBe("desconto");
  });

  it("porChave devolve undefined para chave desconhecida", () => {
    expect(criarCatalogoRubricas().porChave("inexistente" as never)).toBeUndefined();
  });
});
