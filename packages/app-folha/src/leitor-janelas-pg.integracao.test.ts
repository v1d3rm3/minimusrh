import { Competencia, Dinheiro, dataRegistro } from "@minimusrh/dominio";
import type { ConsultaJanela, DataRegistro, FolhaId, HistoriaId, RegraChave, RubricaChave, TipoFolhaChave } from "@minimusrh/dominio";
import { folhaRepositorioPg } from "@minimusrh/persistencia";
import {
  CLASSIFICACAO_INCIDE_PREVIDENCIA,
  RUBRICA_AUXILIO_SAUDE,
  RUBRICA_SALARIO_BASE,
  criarCatalogoRubricas,
} from "@minimusrh/regras-alrn";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { carregarLeitorDeJanelasPg, competenciasDaJanela, type ParametrosLeitorJanelas } from "./leitor-janelas-pg.js";
import { subirAmbiente, type AmbienteIntegracao } from "./testes/ambiente-integracao.js";

// leitor-janelas-pg.integracao.test.ts — a query real sobre `registro_calculo` de folhas
// FECHADAS (Fundação §7.3), com os quatro eixos de §5.4 e o corte de reprodutibilidade.

const MENSAL = "mensal" as TipoFolhaChave;
const SUPLEMENTAR = "suplementar" as TipoFolhaChave;
const A = "00000000-0000-4000-8000-0000000000a1" as HistoriaId;
const B = "00000000-0000-4000-8000-0000000000b1" as HistoriaId;
const JULHO = Competencia.de(2026, 7);
const CORTE = dataRegistro("2026-08-01T00:00:00.000Z");

const SOMA_SALARIO_3M: ConsultaJanela = { agregacao: "soma", sobre: { rubrica: RUBRICA_SALARIO_BASE }, competencias: { ultimas: 3 }, tiposDeFolha: "todas" };
const MEDIA_INCIDE_3M_MENSAL: ConsultaJanela = {
  agregacao: "media",
  sobre: { classificacao: CLASSIFICACAO_INCIDE_PREVIDENCIA },
  competencias: { ultimas: 3 },
  tiposDeFolha: [MENSAL],
};
const CONTAGEM_AUXILIO_ANO: ConsultaJanela = { agregacao: "contagem", sobre: { rubrica: RUBRICA_AUXILIO_SAUDE }, competencias: "ano_civil", tiposDeFolha: "todas" };
const SOMA_SALARIO_ANTERIOR: ConsultaJanela = { agregacao: "soma", sobre: { rubrica: RUBRICA_SALARIO_BASE }, competencias: "anterior", tiposDeFolha: "todas" };
const SOMA_SALARIO_CORRENTE: ConsultaJanela = { agregacao: "soma", sobre: { rubrica: RUBRICA_SALARIO_BASE }, competencias: "corrente", tiposDeFolha: "todas" };
const SOMA_INCIDE_4M: ConsultaJanela = { agregacao: "soma", sobre: { classificacao: CLASSIFICACAO_INCIDE_PREVIDENCIA }, competencias: { ultimas: 4 }, tiposDeFolha: "todas" };

const TODAS_DECLARADAS = [SOMA_SALARIO_3M, MEDIA_INCIDE_3M_MENSAL, CONTAGEM_AUXILIO_ANO, SOMA_SALARIO_ANTERIOR, SOMA_SALARIO_CORRENTE];

describe("competenciasDaJanela", () => {
  it("corrente, anterior, últimas N (inclui a corrente) e ano civil (janeiro até a corrente)", () => {
    const nomes = (janela: ConsultaJanela["competencias"]) => competenciasDaJanela(JULHO, janela).map((c) => c.toString());
    expect(nomes("corrente")).toEqual(["2026-07"]);
    expect(nomes("anterior")).toEqual(["2026-06"]);
    expect(nomes({ ultimas: 3 })).toEqual(["2026-05", "2026-06", "2026-07"]);
    expect(nomes("ano_civil")).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]);
  });
});

describe("leitor-janelas-pg (integração)", () => {
  let ambiente: AmbienteIntegracao;
  const folhas: Record<string, FolhaId> = {};

  async function folhaFechada(
    competencia: Competencia,
    tipo: TipoFolhaChave,
    fechadaEm: DataRegistro,
    registros: readonly [HistoriaId, RubricaChave, string][],
  ): Promise<FolhaId> {
    const repositorio = folhaRepositorioPg(ambiente.poolApp);
    const id = await repositorio.criar({ competencia, tipo, estado: "em_conferencia", corte: fechadaEm });
    await repositorio.persistirTransicao(
      {
        folha: { id, competencia, tipo, estado: "fechada", corte: fechadaEm },
        transicao: { folhaId: id, de: "em_conferencia", para: "fechada", instante: fechadaEm, autor: { tipo: "humano", usuarioId: "t" } },
      },
      registros.map(([historiaId, rubrica, valor]) => ({
        folhaId: id,
        historiaId,
        rubrica,
        versaoRubrica: 1,
        regra: rubrica as string as RegraChave,
        versaoRegra: 1,
        valor: Dinheiro.de(valor),
        explicacao: { descricao: "semeado", fontes: [] },
      })),
    );
    return id;
  }

  function parametros(sobrescritas: Partial<ParametrosLeitorJanelas> = {}): ParametrosLeitorJanelas {
    return {
      folha: { id: "00000000-0000-4000-8000-0000000000f0" as FolhaId, competencia: JULHO },
      corte: CORTE,
      rubricas: criarCatalogoRubricas(),
      consultasDeclaradas: TODAS_DECLARADAS,
      ...sobrescritas,
    };
  }

  beforeAll(async () => {
    ambiente = await subirAmbiente();
    folhas["abril"] = await folhaFechada(Competencia.de(2026, 4), MENSAL, dataRegistro("2026-05-01T00:00:00Z"), [[A, "fantasma" as RubricaChave, "1.00"]]);
    folhas["maio"] = await folhaFechada(Competencia.de(2026, 5), MENSAL, dataRegistro("2026-06-01T00:00:00Z"), [
      [A, RUBRICA_SALARIO_BASE, "1000.00"],
      [A, RUBRICA_AUXILIO_SAUDE, "300.00"],
      [B, RUBRICA_SALARIO_BASE, "999.00"],
    ]);
    folhas["junho"] = await folhaFechada(Competencia.de(2026, 6), MENSAL, dataRegistro("2026-07-01T00:00:00Z"), [[A, RUBRICA_SALARIO_BASE, "2000.00"]]);
    folhas["julhoSuplementar"] = await folhaFechada(JULHO, SUPLEMENTAR, dataRegistro("2026-07-15T00:00:00Z"), [[A, RUBRICA_SALARIO_BASE, "50.00"]]);
    // Fechada DEPOIS do corte: não existia para quem calcula com corte em 01/08.
    folhas["julhoTardia"] = await folhaFechada(JULHO, MENSAL, dataRegistro("2026-09-01T00:00:00Z"), [[A, RUBRICA_SALARIO_BASE, "7777.00"]]);
  });

  afterAll(async () => {
    await ambiente?.encerrar();
  });

  it("soma por rubrica sobre as últimas N, todas as folhas — só folhas fechadas até o corte", async () => {
    const leitor = await carregarLeitorDeJanelasPg(ambiente.poolApp, parametros());
    expect(leitor.agregado(A, SOMA_SALARIO_3M).paraString()).toBe("3050.00");
  });

  it("filtra pela história pedida", async () => {
    const leitor = await carregarLeitorDeJanelasPg(ambiente.poolApp, parametros());
    expect(leitor.agregado(B, SOMA_SALARIO_3M).paraString()).toBe("999.00");
  });

  it("média por classificação (da versão selada da rubrica), só folhas mensais: soma ÷ competências da janela", async () => {
    const leitor = await carregarLeitorDeJanelasPg(ambiente.poolApp, parametros());
    // salario_base incide previdência, auxilio_saude não: (1000 + 2000) / 3
    expect(leitor.agregado(A, MEDIA_INCIDE_3M_MENSAL).paraString()).toBe("1000.00");
  });

  it("anterior e corrente", async () => {
    const leitor = await carregarLeitorDeJanelasPg(ambiente.poolApp, parametros());
    expect(leitor.agregado(A, SOMA_SALARIO_ANTERIOR).paraString()).toBe("2000.00");
    expect(leitor.agregado(A, SOMA_SALARIO_CORRENTE).paraString()).toBe("50.00");
  });

  it("contagem conta registros; agregado() recusa a agregação 'contagem'", async () => {
    const leitor = await carregarLeitorDeJanelasPg(ambiente.poolApp, parametros());
    expect(leitor.contagem(A, CONTAGEM_AUXILIO_ANO)).toBe(1);
    expect(() => leitor.agregado(A, CONTAGEM_AUXILIO_ANO)).toThrow(/contagem\(\)/);
  });

  it("folhasConsumidas: o selo são as folhas que de fato alimentaram respostas, ordenadas", async () => {
    const leitor = await carregarLeitorDeJanelasPg(ambiente.poolApp, parametros());
    expect(leitor.folhasConsumidas()).toEqual([]);
    leitor.agregado(A, SOMA_SALARIO_ANTERIOR);
    leitor.agregado(A, SOMA_SALARIO_CORRENTE);
    expect(leitor.folhasConsumidas()).toEqual([folhas["junho"], folhas["julhoSuplementar"]].sort());
  });

  it("restringirA (selo de folha já fechada) limita as folhas legíveis", async () => {
    const leitor = await carregarLeitorDeJanelasPg(ambiente.poolApp, parametros({ restringirA: [folhas["junho"]!] }));
    expect(leitor.agregado(A, SOMA_SALARIO_3M).paraString()).toBe("2000.00");
  });

  it("a própria folha calculada nunca entra na janela", async () => {
    const leitor = await carregarLeitorDeJanelasPg(
      ambiente.poolApp,
      parametros({ folha: { id: folhas["julhoSuplementar"]!, competencia: JULHO } }),
    );
    expect(leitor.agregado(A, SOMA_SALARIO_CORRENTE).paraString()).toBe("0.00");
  });

  it("consulta não declarada é recusada; sem consultas declaradas não há pré-carga nem resposta", async () => {
    const leitor = await carregarLeitorDeJanelasPg(ambiente.poolApp, parametros());
    expect(() => leitor.agregado(A, SOMA_INCIDE_4M)).toThrow(/não declarada/);

    const vazio = await carregarLeitorDeJanelasPg(ambiente.poolApp, parametros({ consultasDeclaradas: [] }));
    expect(() => vazio.contagem(A, SOMA_SALARIO_3M)).toThrow(/não declarada/);
  });

  it("registro com rubrica ausente do catálogo, lido por classificação, é erro explícito", async () => {
    const leitor = await carregarLeitorDeJanelasPg(ambiente.poolApp, parametros({ consultasDeclaradas: [SOMA_INCIDE_4M] }));
    expect(() => leitor.agregado(A, SOMA_INCIDE_4M)).toThrow(/'fantasma' v1 .* ausente do catálogo/);
  });
});
