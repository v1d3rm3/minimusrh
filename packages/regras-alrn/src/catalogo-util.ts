import type { Catalogo } from "@minimusrh/dominio";

// catalogo-util.ts — os catálogos da ALRN (tipos de fato, rubricas, amparos, tipos de
// folha) são todos arrays literais tipados (Design Domínio §3.4: "no MVP o catálogo vive
// em configuração"); este helper único monta a implementação de `Catalogo<Chave,T>` do
// domínio (porChave/todos) em cima de qualquer array, evitando repetir o Map em cada
// catálogo.
export function criarCatalogo<Chave extends string, T>(
  chaveDe: (item: T) => Chave,
  itens: readonly T[],
): Catalogo<Chave, T> {
  const porChaveMapa = new Map<Chave, T>(itens.map((item) => [chaveDe(item), item]));
  return {
    porChave: (chave) => porChaveMapa.get(chave),
    todos: () => itens,
  };
}
