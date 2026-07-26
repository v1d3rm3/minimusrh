import { Amparo, dataEfeito } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { CATALOGO_AMPAROS, TIPO_AMPARO_PROCESSO, criarCatalogoAmparos } from "./catalogo-amparos.js";

describe("catálogo de tipos de amparo", () => {
  it("tem o tipo 'processo' com a máscara 999/9999", () => {
    expect(CATALOGO_AMPAROS.map((a) => a.chave)).toEqual([TIPO_AMPARO_PROCESSO]);
    expect(CATALOGO_AMPAROS[0]?.versoes[0]?.exemplo).toBe("123/2026");
  });

  it("normaliza '0045/2026' para a forma canônica '45/2026' via Amparo.criar", () => {
    const catalogo = criarCatalogoAmparos();
    const resultado = Amparo.criar(TIPO_AMPARO_PROCESSO, "0045/2026", catalogo, dataEfeito("2026-07-10"));

    expect(resultado).toBeInstanceOf(Amparo);
    expect((resultado as Amparo).identificacaoCanonica).toBe("45/2026");
  });

  it("rejeita entrada fora do formato numero/ano", () => {
    const catalogo = criarCatalogoAmparos();
    const resultado = Amparo.criar(TIPO_AMPARO_PROCESSO, "abc", catalogo, dataEfeito("2026-07-10"));

    expect(resultado).not.toBeInstanceOf(Amparo);
    expect(resultado).toHaveProperty("erro");
  });

  it("porChave devolve undefined para chave desconhecida", () => {
    expect(criarCatalogoAmparos().porChave("inexistente" as never)).toBeUndefined();
  });
});
