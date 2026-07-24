import { Competencia, Dinheiro } from "@minimusrh/dominio";
import type {
  Catalogo,
  Classificacao,
  Contexto,
  DataEfeito,
  DataRegistro,
  Derivacao,
  DerivacaoChave,
  Fato,
  FatoId,
  FolhaId,
  HistoriaId,
  LinhaDoTempo,
  RegistroDeDerivacoes,
  RegraChave,
  Rubrica,
  RubricaChave,
  TipoFatoChave,
  TipoFolhaChave,
  VersaoDerivacao,
  VersaoRegra,
  VersaoRubrica,
} from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { calcularFolha, type EntradaCalculoFolha } from "./calcular-folha.js";
import type { LeitorDeJanelas } from "./contexto-impl.js";

const FOLHA_ID = "folha-1" as FolhaId;
const MENSAL = "mensal" as TipoFolhaChave;
const COMPETENCIA = Competencia.de(2026, 3); // dataReferencia() === '2026-03-31'
const CORTE = "2026-04-15T00:00:00Z" as DataRegistro;

function fato(dataEfeito: string): Fato {
  return {
    id: "f" as FatoId,
    alvo: { escopo: "historia", historiaId: "h" as HistoriaId },
    tipo: "posse" as TipoFatoChave,
    versaoDoTipo: 1,
    conteudo: undefined,
    dataEfeito: dataEfeito as DataEfeito,
    dataRegistro: "2020-01-01T00:00:00Z" as DataRegistro,
    autor: { tipo: "humano", usuarioId: "u1" },
  };
}

function linha(
  historiaId: string,
  overrides: Partial<LinhaDoTempo> = {},
): LinhaDoTempo {
  return {
    historiaId: historiaId as HistoriaId,
    corte: CORTE,
    vigenteEm: () => undefined,
    todosDoTipo: () => [],
    aberturaDaHistoria: () => fato("2020-01-01"),
    encerramentoDaHistoria: () => undefined,
    ...overrides,
  };
}

function versaoRegra(
  overrides: Partial<Omit<VersaoRegra, "produz">> & { readonly produz: string },
): VersaoRegra {
  return {
    regra: `regra_${overrides.produz}` as RegraChave,
    versao: 1,
    dataEfeito: "2026-01-01" as DataEfeito,
    dataRegistro: "2026-01-01T00:00:00Z" as DataRegistro,
    aplicaSeAFolhas: [MENSAL],
    escopo: { tipo: "global" },
    consome: { derivacoes: [], rubricas: [], classificacoes: [], tiposFato: [], janelas: [] },
    quando: () => true,
    calcular: () => Dinheiro.zero(),
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

function catalogoRubricas(entradas: Readonly<Record<string, VersaoRubrica>>): Catalogo<RubricaChave, Rubrica> {
  const rubricas: Rubrica[] = Object.entries(entradas).map(([chave, versao]) => ({
    chave: chave as RubricaChave,
    versoes: [versao],
  }));
  return { porChave: (chave) => rubricas.find((r) => r.chave === chave), todos: () => rubricas };
}

function regrasMapa(regras: readonly VersaoRegra[]): ReadonlyMap<RegraChave, readonly VersaoRegra[]> {
  const mapa = new Map<RegraChave, VersaoRegra[]>();
  for (const r of regras) {
    const grupo = mapa.get(r.regra) ?? [];
    grupo.push(r);
    mapa.set(r.regra, grupo);
  }
  return mapa;
}

const DERIVACOES_VAZIAS: RegistroDeDerivacoes = { porChave: () => undefined };

function registroDerivacoes(mapa: Readonly<Record<string, () => unknown>>): RegistroDeDerivacoes {
  const derivacoes = new Map<DerivacaoChave, Derivacao<unknown>>(
    Object.entries(mapa).map(([chave, derivar]) => {
      const versao: VersaoDerivacao<unknown> = {
        versao: 1,
        dataEfeito: "2026-01-01" as DataEfeito,
        dataRegistro: "2026-01-01T00:00:00Z" as DataRegistro,
        dependeDe: [],
        derivar,
      };
      return [chave as DerivacaoChave, { chave: chave as DerivacaoChave, versoes: [versao] }];
    }),
  );
  return { porChave: (chave) => derivacoes.get(chave) };
}
const LEITOR_JANELAS_VAZIO: LeitorDeJanelas = { agregado: () => Dinheiro.zero(), contagem: () => 0 };

function entradaBase(overrides: Partial<EntradaCalculoFolha>): EntradaCalculoFolha {
  return {
    folhaId: FOLHA_ID,
    competencia: COMPETENCIA,
    tipoFolha: MENSAL,
    corte: CORTE,
    historias: [],
    regras: new Map(),
    rubricas: catalogoRubricas({}),
    derivacoes: DERIVACOES_VAZIAS,
    leitorJanelas: LEITOR_JANELAS_VAZIO,
    ...overrides,
  };
}

describe("calcularFolha", () => {
  it("quando() falso não produz registro — vai para naoAplicaveis", () => {
    const regra = versaoRegra({ produz: "auxilio_saude", quando: () => false });
    const resultado = calcularFolha(
      entradaBase({
        historias: [linha("h1")],
        regras: regrasMapa([regra]),
        rubricas: catalogoRubricas({ auxilio_saude: versaoRubrica() }),
      }),
    );

    expect(resultado.registros).toEqual([]);
    expect(resultado.naoAplicaveis).toEqual([{ historiaId: "h1", regra: regra.regra, versao: 1 }]);
    expect(resultado.erros).toEqual([]);
  });

  it("aplica o arredondamento da RUBRICA (não da regra) ao resultado", () => {
    const regra = versaoRegra({ produz: "x", calcular: () => Dinheiro.de("10.567") });
    const resultado = calcularFolha(
      entradaBase({
        historias: [linha("h1")],
        regras: regrasMapa([regra]),
        rubricas: catalogoRubricas({ x: versaoRubrica({ arredondamento: "truncar" }) }),
      }),
    );

    expect(resultado.registros).toHaveLength(1);
    expect(resultado.registros[0]?.valor.paraString()).toBe("10.56");
  });

  it("regra que consome por classificação executa depois de TODAS as produtoras (ordem observável)", () => {
    const incidePrevidencia = "incide_previdencia" as Classificacao;
    const ordemExecucao: string[] = [];

    const salario = versaoRegra({
      produz: "salario_base",
      calcular: () => {
        ordemExecucao.push("salario_base");
        return Dinheiro.de("1000");
      },
    });
    const gratificacao = versaoRegra({
      produz: "gratificacao",
      calcular: () => {
        ordemExecucao.push("gratificacao");
        return Dinheiro.de("200");
      },
    });
    const previdencia = versaoRegra({
      produz: "previdencia",
      consome: { derivacoes: [], rubricas: [], classificacoes: [incidePrevidencia], tiposFato: [], janelas: [] },
      calcular: (ctx: Contexto) => {
        ordemExecucao.push("previdencia");
        return ctx.somaDasRubricasCom(incidePrevidencia).dividirPor(10);
      },
    });

    const resultado = calcularFolha(
      entradaBase({
        historias: [linha("h1")],
        regras: regrasMapa([salario, gratificacao, previdencia]),
        rubricas: catalogoRubricas({
          salario_base: versaoRubrica({ classificacoes: new Set([incidePrevidencia]) }),
          gratificacao: versaoRubrica({ classificacoes: new Set([incidePrevidencia]) }),
          previdencia: versaoRubrica({ classificacoes: new Set() }),
        }),
      }),
    );

    expect(ordemExecucao.indexOf("previdencia")).toBeGreaterThan(ordemExecucao.indexOf("salario_base"));
    expect(ordemExecucao.indexOf("previdencia")).toBeGreaterThan(ordemExecucao.indexOf("gratificacao"));
    const previdenciaRegistro = resultado.registros.find((r) => r.rubrica === "previdencia");
    expect(previdenciaRegistro?.valor.paraString()).toBe("120.00"); // (1000+200)/10
  });

  it("determinismo: duas execuções com a mesma entrada produzem resultados idênticos", () => {
    function construirEntrada(): EntradaCalculoFolha {
      const salario = versaoRegra({ produz: "salario_base", calcular: () => Dinheiro.de("1234.56") });
      return entradaBase({
        historias: [linha("h1"), linha("h2")],
        regras: regrasMapa([salario]),
        rubricas: catalogoRubricas({ salario_base: versaoRubrica() }),
      });
    }

    function serializar(resultado: ReturnType<typeof calcularFolha>): unknown {
      return {
        registros: resultado.registros.map((r) => ({ ...r, valor: r.valor.paraString() })),
        naoAplicaveis: resultado.naoAplicaveis,
        erros: resultado.erros,
      };
    }

    const primeira = serializar(calcularFolha(construirEntrada()));
    const segunda = serializar(calcularFolha(construirEntrada()));

    expect(JSON.stringify(primeira)).toBe(JSON.stringify(segunda));
  });

  it("história que ainda não abriu na data de referência não participa", () => {
    const futura = linha("futuro", { aberturaDaHistoria: () => fato("2030-01-01") });
    const regra = versaoRegra({ produz: "x" });
    const resultado = calcularFolha(
      entradaBase({
        historias: [futura],
        regras: regrasMapa([regra]),
        rubricas: catalogoRubricas({ x: versaoRubrica() }),
      }),
    );

    expect(resultado.registros).toEqual([]);
    expect(resultado.naoAplicaveis).toEqual([]);
  });

  it("história já encerrada antes da data de referência não participa", () => {
    const encerrada = linha("encerrada", { encerramentoDaHistoria: () => fato("2026-01-01") });
    const regra = versaoRegra({ produz: "x" });
    const resultado = calcularFolha(
      entradaBase({
        historias: [encerrada],
        regras: regrasMapa([regra]),
        rubricas: catalogoRubricas({ x: versaoRubrica() }),
      }),
    );

    expect(resultado.registros).toEqual([]);
  });

  it("guarda de escopo: regra individual só se aplica à história declarada", () => {
    const regraIndividual = versaoRegra({
      produz: "bonus_individual",
      escopo: { tipo: "individual", historiaId: "h1" as HistoriaId },
      calcular: () => Dinheiro.de("500"),
    });
    const resultado = calcularFolha(
      entradaBase({
        historias: [linha("h1"), linha("h2")],
        regras: regrasMapa([regraIndividual]),
        rubricas: catalogoRubricas({ bonus_individual: versaoRubrica() }),
      }),
    );

    expect(resultado.registros).toHaveLength(1);
    expect(resultado.registros[0]?.historiaId).toBe("h1");
  });

  it("ciclo no grafo é reportado em erros, sem nenhum registro", () => {
    const a = versaoRegra({ produz: "a", consome: { derivacoes: [], rubricas: ["b" as RubricaChave], classificacoes: [], tiposFato: [], janelas: [] } });
    const b = versaoRegra({ produz: "b", consome: { derivacoes: [], rubricas: ["a" as RubricaChave], classificacoes: [], tiposFato: [], janelas: [] } });
    const resultado = calcularFolha(
      entradaBase({
        historias: [linha("h1")],
        regras: regrasMapa([a, b]),
        rubricas: catalogoRubricas({ a: versaoRubrica(), b: versaoRubrica() }),
      }),
    );

    expect(resultado.registros).toEqual([]);
    expect(resultado.erros).toEqual([{ tipo: "ciclo", erro: expect.objectContaining({ erro: "ciclo" }) }]);
  });

  it("exceção lançada por calcular() é capturada e reportada em erros, sem derrubar as demais regras", () => {
    const quebra = versaoRegra({
      produz: "quebra",
      calcular: () => {
        throw new Error("boom");
      },
    });
    const outra = versaoRegra({ produz: "outra", calcular: () => Dinheiro.de("1") });

    const resultado = calcularFolha(
      entradaBase({
        historias: [linha("h1")],
        regras: regrasMapa([quebra, outra]),
        rubricas: catalogoRubricas({ quebra: versaoRubrica(), outra: versaoRubrica() }),
      }),
    );

    expect(resultado.erros).toEqual([
      { tipo: "excecao", historiaId: "h1", regra: quebra.regra, mensagem: "boom" },
    ]);
    expect(resultado.registros).toHaveLength(1);
    expect(resultado.registros[0]?.rubrica).toBe("outra");
  });

  it("monta a árvore de explicação a partir das leituras de derivação e rubrica de calcular() — só leituras com valor definido viram fonte", () => {
    const base = versaoRegra({ produz: "base", calcular: () => Dinheiro.de("100") });
    const final = versaoRegra({
      produz: "final",
      consome: { derivacoes: ["idade" as DerivacaoChave], rubricas: ["base" as RubricaChave], classificacoes: [], tiposFato: [], janelas: [] },
      calcular: (ctx: Contexto) => {
        ctx.derivacao("idade" as DerivacaoChave); // definida (42)
        ctx.derivacao("inexistente" as DerivacaoChave); // indefinida — não vira fonte
        ctx.rubrica("base" as RubricaChave); // definida (já calculada)
        ctx.rubrica("fantasma" as RubricaChave); // indefinida — não vira fonte
        return Dinheiro.de("1");
      },
    });

    const resultado = calcularFolha(
      entradaBase({
        historias: [linha("h1")],
        regras: regrasMapa([base, final]),
        rubricas: catalogoRubricas({ base: versaoRubrica(), final: versaoRubrica() }),
        derivacoes: registroDerivacoes({ idade: () => 42 }),
      }),
    );

    const registroFinal = resultado.registros.find((r) => r.rubrica === "final");
    expect(registroFinal?.explicacao.fontes).toEqual([
      { tipo: "derivacao", chave: "idade", valor: "42" },
      { tipo: "rubrica", chave: "base", valor: "100.00" },
    ]);
    expect(registroFinal?.explicacao.descricao).toContain("final");
    expect(registroFinal?.explicacao.valor).toBe("1.00");
  });

  it("exceção que não é instância de Error também é capturada, convertida para string", () => {
    const quebra = versaoRegra({
      produz: "quebra",
      calcular: () => {
        throw "algo não-Error";
      },
    });

    const resultado = calcularFolha(
      entradaBase({
        historias: [linha("h1")],
        regras: regrasMapa([quebra]),
        rubricas: catalogoRubricas({ quebra: versaoRubrica() }),
      }),
    );

    expect(resultado.erros).toEqual([
      { tipo: "excecao", historiaId: "h1", regra: quebra.regra, mensagem: "algo não-Error" },
    ]);
  });

  it("carimba folhaId, historiaId, versaoRubrica e versaoRegra corretamente no registro", () => {
    const regra = versaoRegra({ produz: "x", versao: 3, calcular: () => Dinheiro.de("1") });
    const resultado = calcularFolha(
      entradaBase({
        historias: [linha("h1")],
        regras: regrasMapa([regra]),
        rubricas: catalogoRubricas({ x: versaoRubrica({ versao: 7 }) }),
      }),
    );

    expect(resultado.registros[0]).toMatchObject({
      folhaId: FOLHA_ID,
      historiaId: "h1",
      rubrica: "x",
      versaoRubrica: 7,
      regra: regra.regra,
      versaoRegra: 3,
    });
  });
});
