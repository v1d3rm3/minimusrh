import { describe, expect, it } from "vitest";
import { criarCatalogo } from "./catalogo-util.js";

interface Item {
  readonly chave: string;
  readonly valor: number;
}

describe("criarCatalogo", () => {
  const itens: readonly Item[] = [
    { chave: "a", valor: 1 },
    { chave: "b", valor: 2 },
  ];
  const catalogo = criarCatalogo((item: Item) => item.chave, itens);

  it("porChave encontra o item pela chave extraída", () => {
    expect(catalogo.porChave("a")).toEqual({ chave: "a", valor: 1 });
    expect(catalogo.porChave("b")).toEqual({ chave: "b", valor: 2 });
  });

  it("porChave devolve undefined para chave inexistente", () => {
    expect(catalogo.porChave("inexistente")).toBeUndefined();
  });

  it("todos devolve o array completo, na ordem original", () => {
    expect(catalogo.todos()).toEqual(itens);
  });
});
