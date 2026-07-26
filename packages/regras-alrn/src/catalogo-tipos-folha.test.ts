import { describe, expect, it } from "vitest";
import { CATALOGO_TIPOS_DE_FOLHA, TIPO_FOLHA_MENSAL, criarCatalogoTiposDeFolha } from "./catalogo-tipos-folha.js";

describe("catálogo de tipos de folha", () => {
  it("tem o tipo 'mensal' do escopo do Módulo 4", () => {
    expect(CATALOGO_TIPOS_DE_FOLHA.map((t) => t.chave)).toEqual([TIPO_FOLHA_MENSAL]);
  });

  it("porChave resolve o tipo mensal", () => {
    expect(criarCatalogoTiposDeFolha().porChave(TIPO_FOLHA_MENSAL)?.nome).toBe("Mensal");
  });

  it("porChave devolve undefined para chave desconhecida", () => {
    expect(criarCatalogoTiposDeFolha().porChave("inexistente" as never)).toBeUndefined();
  });

  it("todos devolve o catálogo completo", () => {
    expect(criarCatalogoTiposDeFolha().todos()).toEqual(CATALOGO_TIPOS_DE_FOLHA);
  });
});
