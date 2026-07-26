import type { DerivacaoChave } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { DERIVACAO_CARGO } from "./derivacao-cargo.js";
import { DERIVACAO_DIAS_TRABALHADOS } from "./derivacao-dias-trabalhados.js";
import { DERIVACAO_IDADE } from "./derivacao-idade.js";
import { DERIVACAO_SITUACAO_FUNCIONAL } from "./derivacao-situacao-funcional.js";
import { CATALOGO_CHAVES_DERIVACAO, criarRegistroDeDerivacoes } from "./registro-derivacoes.js";

const CHAVES_ESPERADAS: readonly DerivacaoChave[] = [
  DERIVACAO_IDADE,
  DERIVACAO_CARGO,
  DERIVACAO_SITUACAO_FUNCIONAL,
  DERIVACAO_DIAS_TRABALHADOS,
];

describe("registro de derivações: integridade catálogo ⇄ implementação", () => {
  it("o catálogo de chaves tem exatamente as 4 derivações do Módulo 4, sem duplicatas", () => {
    expect(new Set(CATALOGO_CHAVES_DERIVACAO)).toEqual(new Set(CHAVES_ESPERADAS));
    expect(CATALOGO_CHAVES_DERIVACAO.length).toBe(CHAVES_ESPERADAS.length);
  });

  it("toda chave do catálogo tem implementação registrada, com `chave` batendo com a chave de registro", () => {
    const registro = criarRegistroDeDerivacoes();
    for (const chave of CATALOGO_CHAVES_DERIVACAO) {
      const implementacao = registro.porChave(chave);
      expect(implementacao, `sem implementação registrada para '${chave}'`).toBeDefined();
      expect(implementacao?.chave).toBe(chave);
      expect(implementacao?.versoes.length).toBeGreaterThan(0);
    }
  });

  it("porChave devolve undefined para uma chave fora do catálogo", () => {
    const registro = criarRegistroDeDerivacoes();
    expect(registro.porChave("inexistente" as DerivacaoChave)).toBeUndefined();
  });
});
