import { Amparo, Competencia } from "@minimusrh/dominio";
import type { Autor, DataRegistro, EstadoFolha, Folha, FolhaId, TipoAmparoChave, TipoFolhaChave } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { transitar } from "./ciclo-folha.js";

const AUTOR: Autor = { tipo: "humano", usuarioId: "u1" };
const INSTANTE = "2026-04-15T00:00:00Z" as DataRegistro;
const TODOS_OS_ESTADOS: readonly EstadoFolha[] = ["aberta", "em_conferencia", "fechada", "cancelada"];

function folha(overrides: Partial<Folha> = {}): Folha {
  return {
    id: "f1" as FolhaId,
    competencia: Competencia.de(2026, 3),
    tipo: "mensal" as TipoFolhaChave,
    estado: "aberta",
    ...overrides,
  };
}

describe("transitar", () => {
  describe("matriz completa de legalidade (16 combinações, espelhando TRANSICOES)", () => {
    const LEGAIS = new Set(["aberta->em_conferencia", "aberta->cancelada", "em_conferencia->aberta", "em_conferencia->fechada"]);

    for (const de of TODOS_OS_ESTADOS) {
      for (const para of TODOS_OS_ESTADOS) {
        const par = `${de}->${para}`;
        const deveSerLegal = LEGAIS.has(par);

        it(`${par} é ${deveSerLegal ? "legal" : "ilegal"}`, () => {
          const resultado = transitar(folha({ estado: de }), para, AUTOR, INSTANTE);
          if (deveSerLegal) {
            expect("erro" in resultado).toBe(false);
          } else {
            expect(resultado).toEqual({
              erro: "transicao_ilegal",
              de,
              para,
              mensagem: expect.any(String),
            });
          }
        });
      }
    }
  });

  it("de 'fechada', NENHUMA transição é aceita — nem para o próprio estado", () => {
    for (const para of TODOS_OS_ESTADOS) {
      const resultado = transitar(folha({ estado: "fechada" }), para, AUTOR, INSTANTE);
      expect("erro" in resultado).toBe(true);
    }
  });

  it("de 'cancelada', NENHUMA transição é aceita", () => {
    for (const para of TODOS_OS_ESTADOS) {
      const resultado = transitar(folha({ estado: "cancelada" }), para, AUTOR, INSTANTE);
      expect("erro" in resultado).toBe(true);
    }
  });

  it("transição legal devolve a folha nova com o novo estado, sem mutar a original", () => {
    const original = folha({ estado: "aberta" });
    const resultado = transitar(original, "em_conferencia", AUTOR, INSTANTE);

    expect("erro" in resultado).toBe(false);
    const ok = resultado as Exclude<typeof resultado, { erro: string }>;
    expect(ok.folha.estado).toBe("em_conferencia");
    expect(original.estado).toBe("aberta"); // imutabilidade
  });

  it("transição legal devolve o registro de TransicaoFolha com de/para/instante/autor", () => {
    const resultado = transitar(folha({ estado: "aberta" }), "cancelada", AUTOR, INSTANTE);

    expect("erro" in resultado).toBe(false);
    const ok = resultado as Exclude<typeof resultado, { erro: string }>;
    expect(ok.transicao).toEqual({ folhaId: "f1", de: "aberta", para: "cancelada", instante: INSTANTE, autor: AUTOR });
  });

  it("entrar em 'em_conferencia' trava o corte no instante da transição", () => {
    const resultado = transitar(folha({ estado: "aberta", corte: undefined }), "em_conferencia", AUTOR, INSTANTE);

    expect("erro" in resultado).toBe(false);
    const ok = resultado as Exclude<typeof resultado, { erro: string }>;
    expect(ok.folha.corte).toBe(INSTANTE);
  });

  it("devolvida ('em_conferencia' -> 'aberta') destrava o corte", () => {
    const resultado = transitar(folha({ estado: "em_conferencia", corte: INSTANTE }), "aberta", AUTOR, "2026-05-01T00:00:00Z" as DataRegistro);

    expect("erro" in resultado).toBe(false);
    const ok = resultado as Exclude<typeof resultado, { erro: string }>;
    expect(ok.folha.corte).toBeUndefined();
  });

  it("'em_conferencia' -> 'fechada' preserva o corte já travado (não re-trava no instante do fechamento)", () => {
    const resultado = transitar(
      folha({ estado: "em_conferencia", corte: INSTANTE }),
      "fechada",
      AUTOR,
      "2026-05-01T00:00:00Z" as DataRegistro,
    );

    expect("erro" in resultado).toBe(false);
    const ok = resultado as Exclude<typeof resultado, { erro: string }>;
    expect(ok.folha.corte).toBe(INSTANTE);
  });

  it("'aberta' -> 'cancelada' preserva o corte como estava (sempre undefined nesse caminho)", () => {
    const resultado = transitar(folha({ estado: "aberta" }), "cancelada", AUTOR, INSTANTE);

    expect("erro" in resultado).toBe(false);
    const ok = resultado as Exclude<typeof resultado, { erro: string }>;
    expect(ok.folha.corte).toBeUndefined();
  });

  it("aceita amparo opcional e o inclui na transição quando presente", () => {
    const amparo = Amparo.legado("processo" as TipoAmparoChave, "45/2026");
    const resultado = transitar(folha({ estado: "aberta" }), "em_conferencia", AUTOR, INSTANTE, amparo);

    expect("erro" in resultado).toBe(false);
    const ok = resultado as Exclude<typeof resultado, { erro: string }>;
    expect(ok.transicao.amparo).toBe(amparo);
  });

  it("sem amparo, a transição não carrega a chave 'amparo'", () => {
    const resultado = transitar(folha({ estado: "aberta" }), "em_conferencia", AUTOR, INSTANTE);

    expect("erro" in resultado).toBe(false);
    const ok = resultado as Exclude<typeof resultado, { erro: string }>;
    expect("amparo" in ok.transicao).toBe(false);
  });

  it("mensagem de erro cita origem, destino e as transições permitidas", () => {
    const resultado = transitar(folha({ estado: "aberta" }), "fechada", AUTOR, INSTANTE);
    expect("erro" in resultado).toBe(true);
    const erro = resultado as { mensagem: string };
    expect(erro.mensagem).toContain("aberta");
    expect(erro.mensagem).toContain("fechada");
  });

  it("mensagem de erro a partir de estado terminal indica 'nenhuma' transição permitida", () => {
    const resultado = transitar(folha({ estado: "fechada" }), "aberta", AUTOR, INSTANTE);
    expect("erro" in resultado).toBe(true);
    const erro = resultado as { mensagem: string };
    expect(erro.mensagem.toLowerCase()).toContain("nenhuma");
  });
});
