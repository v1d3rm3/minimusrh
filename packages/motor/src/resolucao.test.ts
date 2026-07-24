import { Competencia, Dinheiro } from "@minimusrh/dominio";
import type {
  Catalogo,
  Contexto,
  DataEfeito,
  DataRegistro,
  RegraChave,
  Rubrica,
  RubricaChave,
  TipoFolhaChave,
  VersaoRegra,
  VersaoRubrica,
} from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { ErroRubricaNaoResolvida, resolverParaExecucao } from "./resolucao.js";

const MENSAL = "mensal" as TipoFolhaChave;
const COMPETENCIA = Competencia.de(2026, 3); // dataReferencia() === '2026-03-31'

function versaoRegra(
  overrides: Partial<Omit<VersaoRegra, "produz">> & { readonly produz: string },
): VersaoRegra {
  return {
    regra: "regra_teste" as RegraChave,
    versao: 1,
    dataEfeito: "2026-01-01" as DataEfeito,
    dataRegistro: "2026-01-01T00:00:00Z" as DataRegistro,
    aplicaSeAFolhas: [MENSAL],
    escopo: { tipo: "global" },
    consome: { derivacoes: [], rubricas: [], classificacoes: [], tiposFato: [], janelas: [] },
    quando: () => true,
    calcular: (_ctx: Contexto) => Dinheiro.zero(),
    ...overrides,
    produz: overrides.produz as RubricaChave,
  };
}

function versaoRubrica(overrides: Partial<VersaoRubrica> = {}): VersaoRubrica {
  return {
    versao: 1,
    dataEfeito: "2026-01-01" as DataEfeito,
    dataRegistro: "2026-01-01T00:00:00Z" as DataRegistro,
    nome: "rubrica de teste",
    natureza: "vantagem",
    classificacoes: new Set(),
    arredondamento: "meio_para_cima",
    proporcionalizavel: false,
    ...overrides,
  };
}

function catalogoRubricas(rubricas: readonly Rubrica[]): Catalogo<RubricaChave, Rubrica> {
  return {
    porChave: (chave) => rubricas.find((r) => r.chave === chave),
    todos: () => rubricas,
  };
}

const CORTE_TARDE = "2027-01-01T00:00:00Z" as DataRegistro;

describe("resolverParaExecucao", () => {
  it("resolve a versão vigente de uma regra aplicável ao tipo de folha", () => {
    const v = versaoRegra({ produz: "salario_base" });
    const regras = new Map<RegraChave, readonly VersaoRegra[]>([["salario_base_regra" as RegraChave, [v]]]);
    const rubricas = catalogoRubricas([{ chave: "salario_base" as RubricaChave, versoes: [versaoRubrica()] }]);

    const resolucao = resolverParaExecucao(regras, rubricas, COMPETENCIA, MENSAL, CORTE_TARDE);

    expect(resolucao.regrasResolvidas).toEqual([v]);
    expect(resolucao.rubricasResolvidas.get("salario_base" as RubricaChave)).toBeDefined();
  });

  it("filtra por aplicaSeAFolhas antes de resolver vigência", () => {
    const v = versaoRegra({ produz: "decimo", aplicaSeAFolhas: ["decimo_terceiro" as TipoFolhaChave] });
    const regras = new Map<RegraChave, readonly VersaoRegra[]>([["r" as RegraChave, [v]]]);
    const rubricas = catalogoRubricas([{ chave: "decimo" as RubricaChave, versoes: [versaoRubrica()] }]);

    const resolucao = resolverParaExecucao(regras, rubricas, COMPETENCIA, MENSAL, CORTE_TARDE);

    expect(resolucao.regrasResolvidas).toEqual([]);
  });

  it("escolhe a versão vigente correta entre duas versões da mesma regra (retroativo)", () => {
    const v1 = versaoRegra({
      produz: "auxilio_saude",
      versao: 1,
      dataEfeito: "2026-01-01" as DataEfeito,
      dataRegistro: "2026-01-01T00:00:00Z" as DataRegistro,
    });
    const v2 = versaoRegra({
      produz: "auxilio_saude",
      versao: 2,
      dataEfeito: "2026-01-01" as DataEfeito,
      dataRegistro: "2026-08-01T00:00:00Z" as DataRegistro,
    });
    const regras = new Map<RegraChave, readonly VersaoRegra[]>([["auxilio" as RegraChave, [v1, v2]]]);
    const rubricas = catalogoRubricas([{ chave: "auxilio_saude" as RubricaChave, versoes: [versaoRubrica()] }]);

    const comoFoiPago = resolverParaExecucao(
      regras,
      rubricas,
      COMPETENCIA,
      MENSAL,
      "2026-02-01T00:00:00Z" as DataRegistro,
    );
    expect(comoFoiPago.regrasResolvidas).toEqual([v1]);

    const comoDeveriaSer = resolverParaExecucao(regras, rubricas, COMPETENCIA, MENSAL, CORTE_TARDE);
    expect(comoDeveriaSer.regrasResolvidas).toEqual([v2]);
  });

  it("regra sem versão vigente para o tipo de folha/corte simplesmente não aparece (não é erro)", () => {
    const v = versaoRegra({ produz: "x", dataEfeito: "2030-01-01" as DataEfeito });
    const regras = new Map<RegraChave, readonly VersaoRegra[]>([["r" as RegraChave, [v]]]);
    const rubricas = catalogoRubricas([{ chave: "x" as RubricaChave, versoes: [versaoRubrica()] }]);

    const resolucao = resolverParaExecucao(regras, rubricas, COMPETENCIA, MENSAL, CORTE_TARDE);

    expect(resolucao.regrasResolvidas).toEqual([]);
    expect(resolucao.rubricasResolvidas.size).toBe(0);
  });

  it("lança ErroRubricaNaoResolvida quando a rubrica produzida não está no catálogo", () => {
    const v = versaoRegra({ produz: "inexistente" });
    const regras = new Map<RegraChave, readonly VersaoRegra[]>([["r" as RegraChave, [v]]]);
    const rubricas = catalogoRubricas([]);

    expect(() => resolverParaExecucao(regras, rubricas, COMPETENCIA, MENSAL, CORTE_TARDE)).toThrow(
      ErroRubricaNaoResolvida,
    );
  });

  it("lança ErroRubricaNaoResolvida quando a rubrica está catalogada mas sem versão vigente na data", () => {
    const v = versaoRegra({ produz: "x" });
    const regras = new Map<RegraChave, readonly VersaoRegra[]>([["r" as RegraChave, [v]]]);
    const rubricas = catalogoRubricas([
      { chave: "x" as RubricaChave, versoes: [versaoRubrica({ dataEfeito: "2030-01-01" as DataEfeito })] },
    ]);

    expect(() => resolverParaExecucao(regras, rubricas, COMPETENCIA, MENSAL, CORTE_TARDE)).toThrow(
      ErroRubricaNaoResolvida,
    );
  });

  it("não resolve a mesma rubrica duas vezes quando duas regras resolvidas produzem a mesma chave", () => {
    const v1 = versaoRegra({ regra: "r1" as RegraChave, produz: "compartilhada" });
    const v2 = versaoRegra({ regra: "r2" as RegraChave, produz: "compartilhada" });
    const regras = new Map<RegraChave, readonly VersaoRegra[]>([
      ["r1" as RegraChave, [v1]],
      ["r2" as RegraChave, [v2]],
    ]);
    const rubricas = catalogoRubricas([{ chave: "compartilhada" as RubricaChave, versoes: [versaoRubrica()] }]);

    const resolucao = resolverParaExecucao(regras, rubricas, COMPETENCIA, MENSAL, CORTE_TARDE);

    expect(resolucao.regrasResolvidas).toHaveLength(2);
    expect(resolucao.rubricasResolvidas.size).toBe(1);
  });
});
