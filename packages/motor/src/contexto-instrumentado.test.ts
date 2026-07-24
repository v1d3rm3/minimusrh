import { Competencia, Dinheiro } from "@minimusrh/dominio";
import type {
  Classificacao,
  Contexto,
  ConsultaJanela,
  DataEfeito,
  DeclaracaoConsumo,
  DerivacaoChave,
  RubricaChave,
  TipoFatoChave,
  TipoFolhaChave,
} from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { instrumentar } from "./contexto-instrumentado.js";

const DATA_REFERENCIA = "2026-03-31" as DataEfeito;
const COMPETENCIA = Competencia.de(2026, 3);
const MENSAL = "mensal" as TipoFolhaChave;

function declaracaoVazia(): DeclaracaoConsumo {
  return { derivacoes: [], rubricas: [], classificacoes: [], tiposFato: [], janelas: [] };
}

function contextoFake(overrides: Partial<Contexto> = {}): Contexto {
  return {
    competencia: COMPETENCIA,
    tipoFolha: MENSAL,
    dataReferencia: DATA_REFERENCIA,
    derivacao: () => undefined,
    rubrica: () => undefined,
    somaDasRubricasCom: () => Dinheiro.zero(),
    agregado: () => Dinheiro.zero(),
    contagem: () => 0,
    vigente: () => undefined,
    existe: () => false,
    ...overrides,
  };
}

describe("instrumentar", () => {
  it("delega todos os métodos ao contexto base, devolvendo o mesmo valor", () => {
    const base = contextoFake({
      derivacao: <T,>() => 42 as T,
      rubrica: () => Dinheiro.de("10"),
      somaDasRubricasCom: () => Dinheiro.de("20"),
      agregado: () => Dinheiro.de("30"),
      contagem: () => 5,
      vigente: <C,>() => ({ x: 1 }) as C,
      existe: () => true,
    });
    const { ctx } = instrumentar(base);

    expect(ctx.competencia).toBe(COMPETENCIA);
    expect(ctx.tipoFolha).toBe(MENSAL);
    expect(ctx.dataReferencia).toBe(DATA_REFERENCIA);
    expect(ctx.derivacao("idade" as DerivacaoChave)).toBe(42);
    expect(ctx.rubrica("salario_base" as RubricaChave)?.paraString()).toBe("10.00");
    expect(ctx.somaDasRubricasCom("incide_previdencia" as Classificacao).paraString()).toBe("20.00");
    const consulta: ConsultaJanela = { agregacao: "soma", sobre: { rubrica: "x" as RubricaChave }, competencias: "corrente", tiposDeFolha: "todas" };
    expect(ctx.agregado(consulta).paraString()).toBe("30.00");
    expect(ctx.contagem(consulta)).toBe(5);
    expect(ctx.vigente("t" as TipoFatoChave)).toEqual({ x: 1 });
    expect(ctx.existe("t" as TipoFatoChave)).toBe(true);
  });

  it("derivação lida mas não declarada gera violação; declarada não gera", () => {
    const { ctx, violacoes } = instrumentar(contextoFake());
    ctx.derivacao("idade" as DerivacaoChave);
    ctx.derivacao("cargo" as DerivacaoChave);

    const semDeclaracao = violacoes(declaracaoVazia());
    expect(semDeclaracao).toContainEqual({ eixo: "derivacao", chave: "idade" });
    expect(semDeclaracao).toContainEqual({ eixo: "derivacao", chave: "cargo" });

    const comDeclaracao = violacoes({ ...declaracaoVazia(), derivacoes: ["idade" as DerivacaoChave, "cargo" as DerivacaoChave] });
    expect(comDeclaracao).toEqual([]);
  });

  it("rubrica lida mas não declarada gera violação", () => {
    const { ctx, violacoes } = instrumentar(contextoFake());
    ctx.rubrica("salario_base" as RubricaChave);

    expect(violacoes(declaracaoVazia())).toContainEqual({ eixo: "rubrica", chave: "salario_base" });
    expect(violacoes({ ...declaracaoVazia(), rubricas: ["salario_base" as RubricaChave] })).toEqual([]);
  });

  it("classificação lida via somaDasRubricasCom mas não declarada gera violação", () => {
    const { ctx, violacoes } = instrumentar(contextoFake());
    ctx.somaDasRubricasCom("incide_previdencia" as Classificacao);

    expect(violacoes(declaracaoVazia())).toContainEqual({ eixo: "classificacao", chave: "incide_previdencia" });
    expect(
      violacoes({ ...declaracaoVazia(), classificacoes: ["incide_previdencia" as Classificacao] }),
    ).toEqual([]);
  });

  it("tipo de fato lido via vigente() ou existe() mas não declarado gera violação", () => {
    const { ctx, violacoes } = instrumentar(contextoFake());
    ctx.vigente("comprovacao_plano_saude" as TipoFatoChave);
    ctx.existe("nascimento" as TipoFatoChave);

    const v = violacoes(declaracaoVazia());
    expect(v).toContainEqual({ eixo: "tipoFato", chave: "comprovacao_plano_saude" });
    expect(v).toContainEqual({ eixo: "tipoFato", chave: "nascimento" });

    expect(
      violacoes({
        ...declaracaoVazia(),
        tiposFato: ["comprovacao_plano_saude" as TipoFatoChave, "nascimento" as TipoFatoChave],
      }),
    ).toEqual([]);
  });

  it("janela lida (agregado ou contagem) mas não declarada gera violação; comparação é estrutural", () => {
    const consultaLida: ConsultaJanela = {
      agregacao: "soma",
      sobre: { classificacao: "incide_previdencia" as Classificacao },
      competencias: "corrente",
      tiposDeFolha: "todas",
    };
    const { ctx, violacoes } = instrumentar(contextoFake());
    ctx.agregado(consultaLida);

    expect(violacoes(declaracaoVazia())).toContainEqual({ eixo: "janela", consulta: consultaLida });

    // mesmo conteúdo, objeto diferente (ex.: reconstruído pela regra a cada chamada) — sem violação
    const consultaDeclaradaEquivalente: ConsultaJanela = {
      agregacao: "soma",
      sobre: { classificacao: "incide_previdencia" as Classificacao },
      competencias: "corrente",
      tiposDeFolha: "todas",
    };
    expect(violacoes({ ...declaracaoVazia(), janelas: [consultaDeclaradaEquivalente] })).toEqual([]);
  });

  it("contagem() também registra a janela lida (mesmo eixo que agregado)", () => {
    const consulta: ConsultaJanela = { agregacao: "contagem", sobre: { rubrica: "x" as RubricaChave }, competencias: "anterior", tiposDeFolha: "todas" };
    const { ctx, violacoes } = instrumentar(contextoFake());
    ctx.contagem(consulta);

    expect(violacoes(declaracaoVazia())).toContainEqual({ eixo: "janela", consulta });
  });

  it("leituras repetidas da mesma chave não declarada geram uma única violação (dedup)", () => {
    const { ctx, violacoes } = instrumentar(contextoFake());
    ctx.derivacao("idade" as DerivacaoChave);
    ctx.derivacao("idade" as DerivacaoChave);
    ctx.derivacao("idade" as DerivacaoChave);

    const v = violacoes(declaracaoVazia());
    expect(v.filter((x) => x.eixo === "derivacao")).toHaveLength(1);
  });

  it("sem nenhuma leitura, violacoes() é sempre vazio, mesmo contra declaração vazia", () => {
    const { violacoes } = instrumentar(contextoFake());
    expect(violacoes(declaracaoVazia())).toEqual([]);
  });

  it("leituras expõe o log cru de derivação e rubrica na ordem em que ocorreram", () => {
    const base = contextoFake({ derivacao: <T,>() => 30 as T, rubrica: () => Dinheiro.de("7") });
    const { ctx, leituras } = instrumentar(base);

    ctx.derivacao("idade" as DerivacaoChave);
    ctx.rubrica("salario_base" as RubricaChave);

    expect(leituras).toEqual([
      { eixo: "derivacao", chave: "idade", valor: 30 },
      { eixo: "rubrica", chave: "salario_base", valor: expect.anything() },
    ]);
    expect((leituras[1] as { valor: Dinheiro }).valor.paraString()).toBe("7.00");
  });
});
