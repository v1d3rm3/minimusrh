import { Competencia, Dinheiro } from "@minimusrh/dominio";
import type {
  Classificacao,
  ConsultaJanela,
  DataEfeito,
  DataRegistro,
  Derivacao,
  DerivacaoChave,
  Fato,
  FatoId,
  HistoriaId,
  LinhaDoTempo,
  RegistroDeDerivacoes,
  RubricaChave,
  TipoFatoChave,
  TipoFolhaChave,
  VersaoDerivacao,
  VersaoRubrica,
} from "@minimusrh/dominio";
import { describe, expect, it, vi } from "vitest";
import { criarContexto, type LeitorDeJanelas, type ObservadorDeLeituras, type ProvenienciaDerivacao } from "./contexto-impl.js";

const DATA_REFERENCIA = "2026-03-31" as DataEfeito;
const CORTE = "2026-04-15T00:00:00Z" as DataRegistro;
const COMPETENCIA = Competencia.de(2026, 3);
const MENSAL = "mensal" as TipoFolhaChave;

function linhaFake(overrides: Partial<LinhaDoTempo> = {}): LinhaDoTempo {
  return {
    historiaId: "h1" as HistoriaId,
    corte: CORTE,
    vigenteEm: () => undefined,
    todosDoTipo: () => [],
    aberturaDaHistoria: () => fatoFake(),
    encerramentoDaHistoria: () => undefined,
    ...overrides,
  };
}

function fatoFake<C>(conteudo?: C): Fato<C> {
  return {
    id: "f1" as FatoId,
    alvo: { escopo: "historia", historiaId: "h1" as HistoriaId },
    tipo: "tipo" as TipoFatoChave,
    versaoDoTipo: 1,
    conteudo: conteudo as C,
    dataEfeito: "2026-01-01" as DataEfeito,
    dataRegistro: "2026-01-01T00:00:00Z" as DataRegistro,
    autor: { tipo: "humano", usuarioId: "u1" },
  };
}

function registroDerivacoesFake(mapa: ReadonlyMap<DerivacaoChave, Derivacao<unknown>>): RegistroDeDerivacoes {
  return { porChave: (chave) => mapa.get(chave) };
}

function versaoDerivacao<T>(overrides: Partial<VersaoDerivacao<T>> & { readonly derivar: VersaoDerivacao<T>["derivar"] }): VersaoDerivacao<T> {
  return {
    versao: 1,
    dataEfeito: "2026-01-01" as DataEfeito,
    dataRegistro: "2026-01-01T00:00:00Z" as DataRegistro,
    dependeDe: [],
    ...overrides,
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

function leitorJanelasFake(overrides: Partial<LeitorDeJanelas> = {}): LeitorDeJanelas {
  return {
    agregado: () => Dinheiro.zero(),
    contagem: () => 0,
    ...overrides,
  };
}

describe("criarContexto", () => {
  it("derivacao() resolve a versão vigente e chama derivar(linha, dataReferencia, competencia)", () => {
    const linha = linhaFake();
    const derivar = vi.fn(() => 42);
    const derivacoes = registroDerivacoesFake(
      new Map([["idade" as DerivacaoChave, { chave: "idade" as DerivacaoChave, versoes: [versaoDerivacao({ derivar })] }]]),
    );
    const ctx = criarContexto({
      linha,
      competencia: COMPETENCIA,
      tipoFolha: MENSAL,
      dataReferencia: DATA_REFERENCIA,
      corte: CORTE,
      registroDeDerivacoes: derivacoes,
      rubricasResolvidas: new Map(),
      rubricasCalculadas: new Map(),
      leitorJanelas: leitorJanelasFake(),
    });

    expect(ctx.derivacao<number>("idade" as DerivacaoChave)).toBe(42);
    expect(derivar).toHaveBeenCalledWith(linha, DATA_REFERENCIA, COMPETENCIA);
  });

  it("derivacao() retorna undefined quando a chave não está registrada", () => {
    const ctx = criarContexto({
      linha: linhaFake(),
      competencia: COMPETENCIA,
      tipoFolha: MENSAL,
      dataReferencia: DATA_REFERENCIA,
      corte: CORTE,
      registroDeDerivacoes: registroDerivacoesFake(new Map()),
      rubricasResolvidas: new Map(),
      rubricasCalculadas: new Map(),
      leitorJanelas: leitorJanelasFake(),
    });

    expect(ctx.derivacao("inexistente" as DerivacaoChave)).toBeUndefined();
  });

  it("derivacao() retorna undefined quando não há versão vigente na data", () => {
    const derivacoes = registroDerivacoesFake(
      new Map([
        [
          "idade" as DerivacaoChave,
          {
            chave: "idade" as DerivacaoChave,
            versoes: [versaoDerivacao({ dataEfeito: "2030-01-01" as DataEfeito, derivar: () => 1 })],
          },
        ],
      ]),
    );
    const ctx = criarContexto({
      linha: linhaFake(),
      competencia: COMPETENCIA,
      tipoFolha: MENSAL,
      dataReferencia: DATA_REFERENCIA,
      corte: CORTE,
      registroDeDerivacoes: derivacoes,
      rubricasResolvidas: new Map(),
      rubricasCalculadas: new Map(),
      leitorJanelas: leitorJanelasFake(),
    });

    expect(ctx.derivacao("idade" as DerivacaoChave)).toBeUndefined();
  });

  it("derivacao() propaga undefined quando a implementação não consegue derivar (ex.: sem fato de nascimento)", () => {
    const derivacoes = registroDerivacoesFake(
      new Map([
        ["idade" as DerivacaoChave, { chave: "idade" as DerivacaoChave, versoes: [versaoDerivacao({ derivar: () => undefined })] }],
      ]),
    );
    const ctx = criarContexto({
      linha: linhaFake(),
      competencia: COMPETENCIA,
      tipoFolha: MENSAL,
      dataReferencia: DATA_REFERENCIA,
      corte: CORTE,
      registroDeDerivacoes: derivacoes,
      rubricasResolvidas: new Map(),
      rubricasCalculadas: new Map(),
      leitorJanelas: leitorJanelasFake(),
    });

    expect(ctx.derivacao("idade" as DerivacaoChave)).toBeUndefined();
  });

  it("rubrica() lê do mapa de rubricas já calculadas nesta execução", () => {
    const calculadas = new Map<RubricaChave, Dinheiro>([["salario_base" as RubricaChave, Dinheiro.de("1000")]]);
    const ctx = criarContexto({
      linha: linhaFake(),
      competencia: COMPETENCIA,
      tipoFolha: MENSAL,
      dataReferencia: DATA_REFERENCIA,
      corte: CORTE,
      registroDeDerivacoes: registroDerivacoesFake(new Map()),
      rubricasResolvidas: new Map(),
      rubricasCalculadas: calculadas,
      leitorJanelas: leitorJanelasFake(),
    });

    expect(ctx.rubrica("salario_base" as RubricaChave)?.paraString()).toBe("1000.00");
    expect(ctx.rubrica("inexistente" as RubricaChave)).toBeUndefined();
  });

  it("somaDasRubricasCom() soma só as rubricas calculadas que carregam a classificação", () => {
    const incidePrevidencia = "incide_previdencia" as Classificacao;
    const calculadas = new Map<RubricaChave, Dinheiro>([
      ["salario_base" as RubricaChave, Dinheiro.de("1000")],
      ["gratificacao" as RubricaChave, Dinheiro.de("200")],
      ["auxilio_saude" as RubricaChave, Dinheiro.de("300")], // não incide
    ]);
    const resolvidas = new Map<RubricaChave, VersaoRubrica>([
      ["salario_base" as RubricaChave, versaoRubrica({ classificacoes: new Set([incidePrevidencia]) })],
      ["gratificacao" as RubricaChave, versaoRubrica({ classificacoes: new Set([incidePrevidencia]) })],
      ["auxilio_saude" as RubricaChave, versaoRubrica({ classificacoes: new Set() })],
    ]);
    const ctx = criarContexto({
      linha: linhaFake(),
      competencia: COMPETENCIA,
      tipoFolha: MENSAL,
      dataReferencia: DATA_REFERENCIA,
      corte: CORTE,
      registroDeDerivacoes: registroDerivacoesFake(new Map()),
      rubricasResolvidas: resolvidas,
      rubricasCalculadas: calculadas,
      leitorJanelas: leitorJanelasFake(),
    });

    expect(ctx.somaDasRubricasCom(incidePrevidencia).paraString()).toBe("1200.00");
  });

  it("somaDasRubricasCom() devolve zero quando nada calculado carrega a classificação", () => {
    const ctx = criarContexto({
      linha: linhaFake(),
      competencia: COMPETENCIA,
      tipoFolha: MENSAL,
      dataReferencia: DATA_REFERENCIA,
      corte: CORTE,
      registroDeDerivacoes: registroDerivacoesFake(new Map()),
      rubricasResolvidas: new Map(),
      rubricasCalculadas: new Map(),
      leitorJanelas: leitorJanelasFake(),
    });

    expect(ctx.somaDasRubricasCom("qualquer" as Classificacao).paraString()).toBe("0.00");
  });

  it("agregado() e contagem() delegam ao LeitorDeJanelas injetado", () => {
    const consulta: ConsultaJanela = {
      agregacao: "soma",
      sobre: { classificacao: "incide_previdencia" as Classificacao },
      competencias: "corrente",
      tiposDeFolha: "todas",
    };
    const leitor = leitorJanelasFake({
      agregado: vi.fn(() => Dinheiro.de("55")),
      contagem: vi.fn(() => 7),
    });
    const ctx = criarContexto({
      linha: linhaFake(),
      competencia: COMPETENCIA,
      tipoFolha: MENSAL,
      dataReferencia: DATA_REFERENCIA,
      corte: CORTE,
      registroDeDerivacoes: registroDerivacoesFake(new Map()),
      rubricasResolvidas: new Map(),
      rubricasCalculadas: new Map(),
      leitorJanelas: leitor,
    });

    expect(ctx.agregado(consulta).paraString()).toBe("55.00");
    expect(ctx.contagem(consulta)).toBe(7);
    // a historiaId vem da linha corrente — ConsultaJanela não carrega história (DECISOES #12)
    expect(leitor.agregado).toHaveBeenCalledWith("h1", consulta);
    expect(leitor.contagem).toHaveBeenCalledWith("h1", consulta);
  });

  it("vigente() devolve o conteúdo do fato vigente na data de referência", () => {
    const fato = fatoFake({ operadora: "unimed" });
    const linha = linhaFake({ vigenteEm: <C,>() => fato as Fato<C> });
    const ctx = criarContexto({
      linha,
      competencia: COMPETENCIA,
      tipoFolha: MENSAL,
      dataReferencia: DATA_REFERENCIA,
      corte: CORTE,
      registroDeDerivacoes: registroDerivacoesFake(new Map()),
      rubricasResolvidas: new Map(),
      rubricasCalculadas: new Map(),
      leitorJanelas: leitorJanelasFake(),
    });

    expect(ctx.vigente<{ operadora: string }>("comprovacao_plano_saude" as TipoFatoChave)).toEqual({
      operadora: "unimed",
    });
  });

  it("vigente() devolve undefined quando não há fato vigente", () => {
    const ctx = criarContexto({
      linha: linhaFake({ vigenteEm: () => undefined }),
      competencia: COMPETENCIA,
      tipoFolha: MENSAL,
      dataReferencia: DATA_REFERENCIA,
      corte: CORTE,
      registroDeDerivacoes: registroDerivacoesFake(new Map()),
      rubricasResolvidas: new Map(),
      rubricasCalculadas: new Map(),
      leitorJanelas: leitorJanelasFake(),
    });

    expect(ctx.vigente("comprovacao_plano_saude" as TipoFatoChave)).toBeUndefined();
  });

  it("existe() reflete a presença de fato vigente na data de referência", () => {
    const comFato = criarContexto({
      linha: linhaFake({ vigenteEm: <C,>() => fatoFake({}) as Fato<C> }),
      competencia: COMPETENCIA,
      tipoFolha: MENSAL,
      dataReferencia: DATA_REFERENCIA,
      corte: CORTE,
      registroDeDerivacoes: registroDerivacoesFake(new Map()),
      rubricasResolvidas: new Map(),
      rubricasCalculadas: new Map(),
      leitorJanelas: leitorJanelasFake(),
    });
    const semFato = criarContexto({
      linha: linhaFake({ vigenteEm: () => undefined }),
      competencia: COMPETENCIA,
      tipoFolha: MENSAL,
      dataReferencia: DATA_REFERENCIA,
      corte: CORTE,
      registroDeDerivacoes: registroDerivacoesFake(new Map()),
      rubricasResolvidas: new Map(),
      rubricasCalculadas: new Map(),
      leitorJanelas: leitorJanelasFake(),
    });

    expect(comFato.existe("comprovacao_plano_saude" as TipoFatoChave)).toBe(true);
    expect(semFato.existe("comprovacao_plano_saude" as TipoFatoChave)).toBe(false);
  });

  it("competencia, tipoFolha e dataReferencia são expostos como recebidos", () => {
    const ctx = criarContexto({
      linha: linhaFake(),
      competencia: COMPETENCIA,
      tipoFolha: MENSAL,
      dataReferencia: DATA_REFERENCIA,
      corte: CORTE,
      registroDeDerivacoes: registroDerivacoesFake(new Map()),
      rubricasResolvidas: new Map(),
      rubricasCalculadas: new Map(),
      leitorJanelas: leitorJanelasFake(),
    });

    expect(ctx.competencia).toBe(COMPETENCIA);
    expect(ctx.tipoFolha).toBe(MENSAL);
    expect(ctx.dataReferencia).toBe(DATA_REFERENCIA);
  });

  describe("observador de leituras (proveniência — DECISOES #13)", () => {
    function observadorQueGrava(): ObservadorDeLeituras & {
      readonly derivacoes: ProvenienciaDerivacao[];
      readonly fatos: [TipoFatoChave, FatoId | undefined][];
      readonly classificacoes: [Classificacao, string, [RubricaChave, string][]][];
    } {
      const derivacoes: ProvenienciaDerivacao[] = [];
      const fatos: [TipoFatoChave, FatoId | undefined][] = [];
      const classificacoes: [Classificacao, string, [RubricaChave, string][]][] = [];
      return {
        derivacoes,
        fatos,
        classificacoes,
        derivacaoLida: (p) => derivacoes.push(p),
        fatoLido: (tipo, fatoId) => fatos.push([tipo, fatoId]),
        classificacaoLida: (c, total, parcelas) =>
          classificacoes.push([c, total.paraString(), parcelas.map((p) => [p.rubrica, p.valor.paraString()])]),
      };
    }

    it("somaDasRubricasCom() notifica o total e as parcelas que o compõem", () => {
      const observador = observadorQueGrava();
      const incide = "incide_previdencia" as Classificacao;
      const ctx = criarContexto({
        linha: linhaFake(),
        competencia: COMPETENCIA,
        tipoFolha: MENSAL,
        dataReferencia: DATA_REFERENCIA,
        corte: CORTE,
        registroDeDerivacoes: registroDerivacoesFake(new Map()),
        rubricasResolvidas: new Map([
          ["salario" as RubricaChave, versaoRubrica({ classificacoes: new Set([incide]) })],
          ["auxilio" as RubricaChave, versaoRubrica()],
        ]),
        rubricasCalculadas: new Map([
          ["salario" as RubricaChave, Dinheiro.de("100")],
          ["auxilio" as RubricaChave, Dinheiro.de("7")],
        ]),
        leitorJanelas: leitorJanelasFake(),
        observador,
      });

      ctx.somaDasRubricasCom(incide);
      expect(observador.classificacoes).toEqual([[incide, "100.00", [["salario", "100.00"]]]]);
    });

    function fatoComId(id: string): Fato {
      return { ...fatoFake(), id: id as FatoId };
    }

    it("cita a versão e os fatos que a derivação consultou, sem repetição, por qualquer das quatro portas da LinhaDoTempo", () => {
      const observador = observadorQueGrava();
      const linha = linhaFake({
        vigenteEm: () => fatoComId("vigente") as never,
        todosDoTipo: () => [fatoComId("todos-1"), fatoComId("todos-2")] as never,
        aberturaDaHistoria: () => fatoComId("abertura"),
        encerramentoDaHistoria: () => fatoComId("encerramento"),
      });
      const derivar = (l: LinhaDoTempo) => {
        l.vigenteEm("t" as TipoFatoChave, DATA_REFERENCIA);
        l.vigenteEm("t" as TipoFatoChave, DATA_REFERENCIA);
        l.todosDoTipo("t" as TipoFatoChave);
        l.aberturaDaHistoria();
        l.encerramentoDaHistoria();
        return "B8";
      };
      const ctx = criarContexto({
        linha,
        competencia: COMPETENCIA,
        tipoFolha: MENSAL,
        dataReferencia: DATA_REFERENCIA,
        corte: CORTE,
        registroDeDerivacoes: registroDerivacoesFake(
          new Map([["cargo" as DerivacaoChave, { chave: "cargo" as DerivacaoChave, versoes: [versaoDerivacao({ versao: 3, derivar })] }]]),
        ),
        rubricasResolvidas: new Map(),
        rubricasCalculadas: new Map(),
        leitorJanelas: leitorJanelasFake(),
        observador,
      });

      expect(ctx.derivacao("cargo" as DerivacaoChave)).toBe("B8");
      expect(observador.derivacoes).toEqual([
        { chave: "cargo", versao: 3, valor: "B8", fatos: ["vigente", "todos-1", "todos-2", "abertura", "encerramento"] },
      ]);
    });

    it("derivação sem implementação ou sem versão vigente também notifica (versão e valor undefined)", () => {
      const observador = observadorQueGrava();
      const ctx = criarContexto({
        linha: linhaFake(),
        competencia: COMPETENCIA,
        tipoFolha: MENSAL,
        dataReferencia: DATA_REFERENCIA,
        corte: CORTE,
        registroDeDerivacoes: registroDerivacoesFake(new Map()),
        rubricasResolvidas: new Map(),
        rubricasCalculadas: new Map(),
        leitorJanelas: leitorJanelasFake(),
        observador,
      });

      expect(ctx.derivacao("inexistente" as DerivacaoChave)).toBeUndefined();
      expect(observador.derivacoes).toEqual([{ chave: "inexistente", versao: undefined, valor: undefined, fatos: [] }]);
    });

    it("encerramento ausente não é citado", () => {
      const observador = observadorQueGrava();
      const derivar = (l: LinhaDoTempo) => l.encerramentoDaHistoria();
      const ctx = criarContexto({
        linha: linhaFake(),
        competencia: COMPETENCIA,
        tipoFolha: MENSAL,
        dataReferencia: DATA_REFERENCIA,
        corte: CORTE,
        registroDeDerivacoes: registroDerivacoesFake(
          new Map([["fim" as DerivacaoChave, { chave: "fim" as DerivacaoChave, versoes: [versaoDerivacao({ derivar })] }]]),
        ),
        rubricasResolvidas: new Map(),
        rubricasCalculadas: new Map(),
        leitorJanelas: leitorJanelasFake(),
        observador,
      });

      ctx.derivacao("fim" as DerivacaoChave);
      expect(observador.derivacoes[0]?.fatos).toEqual([]);
    });

    it("vigente()/existe() notificam o fato lido diretamente pela regra (ou undefined quando não há)", () => {
      const observador = observadorQueGrava();
      const tipo = "comprovacao_plano_saude" as TipoFatoChave;
      const params = {
        competencia: COMPETENCIA,
        tipoFolha: MENSAL,
        dataReferencia: DATA_REFERENCIA,
        corte: CORTE,
        registroDeDerivacoes: registroDerivacoesFake(new Map()),
        rubricasResolvidas: new Map(),
        rubricasCalculadas: new Map(),
        leitorJanelas: leitorJanelasFake(),
        observador,
      };
      const comFato = criarContexto({ ...params, linha: linhaFake({ vigenteEm: () => fatoComId("plano") as never }) });
      const semFato = criarContexto({ ...params, linha: linhaFake() });

      comFato.vigente(tipo);
      comFato.existe(tipo);
      semFato.existe(tipo);

      expect(observador.fatos).toEqual([
        [tipo, "plano"],
        [tipo, "plano"],
        [tipo, undefined],
      ]);
    });
  });
});
