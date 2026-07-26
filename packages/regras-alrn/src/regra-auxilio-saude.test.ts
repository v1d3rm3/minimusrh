import type { TipoFatoChave } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { TIPO_FATO_COMPROVACAO_PLANO_SAUDE } from "./catalogo-tipos-fato.js";
import { DERIVACAO_IDADE } from "./derivacao-idade.js";
import { REGRA_AUXILIO_SAUDE_V1 } from "./regra-auxilio-saude.js";
import { criarContextoFake } from "./testes/contexto-fake.js";

function ctxComComprovacao(idade?: number) {
  return criarContextoFake({
    fatosVigentes: new Map<TipoFatoChave, unknown>([[TIPO_FATO_COMPROVACAO_PLANO_SAUDE, { operadora: "unimed" }]]),
    ...(idade === undefined ? {} : { derivacoes: new Map([[DERIVACAO_IDADE, idade]]) }),
  });
}

describe("regra auxilio_saude", () => {
  it("quando() é falso sem comprovação vigente (direito cessa, Fundação §10)", () => {
    const ctx = criarContextoFake();
    expect(REGRA_AUXILIO_SAUDE_V1.quando(ctx)).toBe(false);
  });

  it("quando() é verdadeiro com comprovação vigente", () => {
    expect(REGRA_AUXILIO_SAUDE_V1.quando(ctxComComprovacao(30))).toBe(true);
  });

  it.each([
    [0, "250.00"],
    [29, "250.00"],
    [30, "320.00"],
    [39, "320.00"],
    [40, "410.00"],
    [49, "410.00"],
    [50, "520.00"],
    [90, "520.00"],
  ])("idade %i cai na faixa que paga R$ %s (tabela do conceitual §7.8)", (idade, esperado) => {
    expect(REGRA_AUXILIO_SAUDE_V1.calcular(ctxComComprovacao(idade)).paraString()).toBe(esperado);
  });

  it("comprovação existe mas idade não é derivável: lança erro explícito", () => {
    expect(() => REGRA_AUXILIO_SAUDE_V1.calcular(ctxComComprovacao())).toThrow(/idade/);
  });
});
