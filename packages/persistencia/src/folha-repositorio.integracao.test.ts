import { randomUUID } from "node:crypto";
import { Competencia, Dinheiro, dataRegistro } from "@minimusrh/dominio";
import type {
  DerivacaoChave,
  Folha,
  FolhaId,
  HistoriaId,
  NoExplicacao,
  RegistroCalculo,
  RegraChave,
  RubricaChave,
  TipoFolhaChave,
} from "@minimusrh/dominio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErroTransicaoConcorrente, folhaRepositorioPg } from "./folha-repositorio.js";
import { subirAmbiente, type AmbienteIntegracao } from "./testes/ambiente-integracao.js";

const TIPO_MENSAL = "mensal" as TipoFolhaChave;
const AUTOR_TESTE = { tipo: "humano", usuarioId: "u1" } as const;

describe("folha-repositorio-pg (integracao)", () => {
  let ambiente: AmbienteIntegracao;

  beforeAll(async () => {
    ambiente = await subirAmbiente();
  });

  afterAll(async () => {
    await ambiente.encerrar();
  });

  it("criar + buscarPorId round-trip", async () => {
    const repositorio = folhaRepositorioPg(ambiente.poolApp);
    const id = await repositorio.criar({ competencia: Competencia.de(2026, 7), tipo: TIPO_MENSAL, estado: "aberta" });

    const lida = await repositorio.buscarPorId(id);
    expect(lida?.estado).toBe("aberta");
    expect(lida?.competencia.igual(Competencia.de(2026, 7))).toBe(true);
  });

  it("persistirTransicao aplica UPDATE em folha + INSERT em transicao_folha numa unica chamada", async () => {
    const repositorio = folhaRepositorioPg(ambiente.poolApp);
    const id = await repositorio.criar({ competencia: Competencia.de(2026, 7), tipo: TIPO_MENSAL, estado: "aberta" });
    const folhaAtual = (await repositorio.buscarPorId(id)) as Folha;

    const instante = dataRegistro("2026-07-10T00:00:00Z");
    await repositorio.persistirTransicao({
      folha: { ...folhaAtual, estado: "em_conferencia", corte: instante },
      transicao: { folhaId: id, de: "aberta", para: "em_conferencia", instante, autor: AUTOR_TESTE },
    });

    const depois = await repositorio.buscarPorId(id);
    expect(depois?.estado).toBe("em_conferencia");
    // to_char(...'.MS') sempre volta com milissegundos (DECISOES de mapeamento-folha) —
    // compara o instante, não a string byte-a-byte (mesmo padrão de fato-repositorio).
    expect(new Date(depois?.corte ?? "").getTime()).toBe(new Date(instante).getTime());

    const transicoes = await repositorio.listarTransicoes(id);
    expect(transicoes).toHaveLength(1);
    expect(transicoes[0]).toMatchObject({ de: "aberta", para: "em_conferencia" });
  });

  it("fechamento transacional: falha no meio do lote desfaz a transicao inteira", async () => {
    const repositorio = folhaRepositorioPg(ambiente.poolApp);
    const id = await repositorio.criar({
      competencia: Competencia.de(2026, 7),
      tipo: TIPO_MENSAL,
      estado: "em_conferencia",
      corte: dataRegistro("2026-07-10T00:00:00Z"),
    });
    const folhaAtual = (await repositorio.buscarPorId(id)) as Folha;
    const instante = dataRegistro("2026-07-11T00:00:00Z");

    const registroValido: RegistroCalculo = {
      folhaId: id,
      historiaId: randomUUID() as HistoriaId,
      rubrica: "salario_base" as RubricaChave,
      versaoRubrica: 1,
      regra: "salario_base" as RegraChave,
      versaoRegra: 1,
      valor: Dinheiro.de("100.00"),
      explicacao: { descricao: "x", fontes: [] },
    };
    // folha_id inexistente: viola a FK no meio do lote.
    const registroInvalido: RegistroCalculo = { ...registroValido, folhaId: randomUUID() as FolhaId };

    await expect(
      repositorio.persistirTransicao(
        {
          folha: { ...folhaAtual, estado: "fechada" },
          transicao: { folhaId: id, de: "em_conferencia", para: "fechada", instante, autor: AUTOR_TESTE },
        },
        [registroValido, registroInvalido],
      ),
    ).rejects.toThrow();

    const depois = await repositorio.buscarPorId(id);
    expect(depois?.estado).toBe("em_conferencia");

    const transicoes = await repositorio.listarTransicoes(id);
    expect(transicoes).toHaveLength(0);

    const registros = await ambiente.poolApp.query("SELECT 1 FROM registro_calculo WHERE folha_id = $1", [id]);
    expect(registros.rowCount).toBe(0);
  });

  it("transicao concorrente: segunda chamada com transicao.de desatualizado lanca ErroTransicaoConcorrente", async () => {
    const repositorio = folhaRepositorioPg(ambiente.poolApp);
    const id = await repositorio.criar({ competencia: Competencia.de(2026, 7), tipo: TIPO_MENSAL, estado: "aberta" });
    const folhaAtual = (await repositorio.buscarPorId(id)) as Folha;
    const instante = dataRegistro("2026-07-10T00:00:00Z");

    await repositorio.persistirTransicao({
      folha: { ...folhaAtual, estado: "em_conferencia", corte: instante },
      transicao: { folhaId: id, de: "aberta", para: "em_conferencia", instante, autor: AUTOR_TESTE },
    });

    await expect(
      repositorio.persistirTransicao({
        folha: { ...folhaAtual, estado: "em_conferencia", corte: instante },
        transicao: { folhaId: id, de: "aberta", para: "em_conferencia", instante, autor: AUTOR_TESTE },
      }),
    ).rejects.toBeInstanceOf(ErroTransicaoConcorrente);
  });

  it("round-trip de RegistroCalculo com arvore de explicacao aninhada", async () => {
    const repositorio = folhaRepositorioPg(ambiente.poolApp);
    const id = await repositorio.criar({
      competencia: Competencia.de(2026, 7),
      tipo: TIPO_MENSAL,
      estado: "em_conferencia",
      corte: dataRegistro("2026-07-10T00:00:00Z"),
    });
    const folhaAtual = (await repositorio.buscarPorId(id)) as Folha;
    const instante = dataRegistro("2026-07-11T00:00:00Z");

    const explicacao: NoExplicacao = {
      descricao: "base = soma das rubricas 'incide_previdencia'",
      valor: "1234.56",
      fontes: [
        { tipo: "rubrica", chave: "salario_base" as RubricaChave, valor: "1000.00" },
        {
          tipo: "no",
          no: {
            descricao: "gratificacao",
            valor: "234.56",
            fontes: [{ tipo: "derivacao", chave: "dias_trabalhados" as DerivacaoChave, valor: "30" }],
          },
        },
      ],
    };

    const registro: RegistroCalculo = {
      folhaId: id,
      historiaId: randomUUID() as HistoriaId,
      rubrica: "salario_base" as RubricaChave,
      versaoRubrica: 1,
      regra: "salario_base" as RegraChave,
      versaoRegra: 1,
      valor: Dinheiro.de("1234.56"),
      explicacao,
    };

    await repositorio.persistirTransicao(
      {
        folha: { ...folhaAtual, estado: "fechada" },
        transicao: { folhaId: id, de: "em_conferencia", para: "fechada", instante, autor: AUTOR_TESTE },
      },
      [registro],
    );

    const resultado = await ambiente.poolApp.query<{ explicacao: NoExplicacao; valor: string }>(
      "SELECT explicacao, valor FROM registro_calculo WHERE folha_id = $1",
      [id],
    );
    expect(resultado.rows[0]?.explicacao).toEqual(explicacao);
    expect(resultado.rows[0]?.valor).toBe("1234.56");
  });

  it("NUMERIC <-> Dinheiro exato: 0.10 tres vezes bate centavo a centavo (banco vs memoria)", async () => {
    const repositorio = folhaRepositorioPg(ambiente.poolApp);
    const id = await repositorio.criar({
      competencia: Competencia.de(2026, 7),
      tipo: TIPO_MENSAL,
      estado: "em_conferencia",
      corte: dataRegistro("2026-07-10T00:00:00Z"),
    });
    const folhaAtual = (await repositorio.buscarPorId(id)) as Folha;
    const instante = dataRegistro("2026-07-11T00:00:00Z");
    const historiaId = randomUUID() as HistoriaId;

    const tresRegistros: RegistroCalculo[] = ["a", "b", "c"].map((sufixo, indice) => ({
      folhaId: id,
      historiaId,
      rubrica: `rubrica-${sufixo}` as RubricaChave,
      versaoRubrica: 1,
      regra: `regra-${sufixo}` as RegraChave,
      versaoRegra: 1,
      valor: Dinheiro.de("0.10"),
      explicacao: { descricao: `parcela ${indice}`, fontes: [] },
    }));

    await repositorio.persistirTransicao(
      {
        folha: { ...folhaAtual, estado: "fechada" },
        transicao: { folhaId: id, de: "em_conferencia", para: "fechada", instante, autor: AUTOR_TESTE },
      },
      tresRegistros,
    );

    const somaNoBanco = await ambiente.poolApp.query<{ soma: string }>(
      "SELECT SUM(valor) AS soma FROM registro_calculo WHERE folha_id = $1",
      [id],
    );
    const somaEsperada = tresRegistros.reduce((acumulado, registro) => acumulado.somar(registro.valor), Dinheiro.zero());
    expect(somaNoBanco.rows[0]?.soma).toBe(somaEsperada.paraString());
  });
});
