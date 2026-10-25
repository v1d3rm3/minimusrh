import { describe, expect, it } from "vitest";
import { configuracaoAlrn } from "./configuracao.js";
import { fonteCsv } from "./fonte-csv.js";
import { ErroImportacao, importar } from "./importar.js";
import type { FonteLegado, RegistroLegado } from "./registros.js";
import { LOTE_COM_REJEICOES, LOTE_REFERENCIA } from "./testes/caminhos.js";
import { destinoEmMemoria } from "./testes/destino-em-memoria.js";

const configuracao = configuracaoAlrn();

function fonteDe(registros: readonly RegistroLegado[]): FonteLegado {
  return {
    descricao: "memoria",
    async *registros() {
      yield* registros;
    },
  };
}

const origem = (arquivo: string, linha: number) => ({ arquivo, linha });

describe("importar — pipeline do lote", () => {
  it("lote de referência: fatos por tipo, identidades, gabarito e a convenção contada", async () => {
    const destino = destinoEmMemoria();
    const r = await importar({ fonte: fonteCsv(LOTE_REFERENCIA), destino, configuracao, lote: "ref-1" });

    expect(r.rejeicoes).toEqual([]);
    expect(r.lidos).toEqual({ servidor: 3, vinculo: 3, evento: 2, contracheque: 4, ilegivel: 0 });
    expect(Object.fromEntries(r.fatosGerados)).toEqual({ nascimento: 2, posse: 3, exoneracao: 1, promocao: 1, comprovacao_plano_saude: 1 });
    expect(r.fatosPorConvencao).toBe(7);
    expect(r.unidadesGravadas).toBe(12);
    expect(r.gabaritoGravadas).toBe(4);
    expect(destino.servidores.size).toBe(3);
    expect(destino.vinculos.size).toBe(3);
    expect(destino.fatos.size).toBe(8);
    expect([...destino.fatos.values()].every((f) => f.fato.autor.tipo === "importacao" && f.fato.autor.lote === "ref-1")).toBe(true);
  });

  it("idempotência: importar o mesmo lote 2x ⇒ mesmos fatos, nada novo na segunda", async () => {
    const destino = destinoEmMemoria();
    await importar({ fonte: fonteCsv(LOTE_REFERENCIA), destino, configuracao, lote: "ref-1" });
    const fatosAntes = [...destino.fatos.entries()];

    const segunda = await importar({ fonte: fonteCsv(LOTE_REFERENCIA), destino, configuracao, lote: "ref-1" });
    expect([...destino.fatos.entries()]).toEqual(fatosAntes);
    expect(segunda.rejeicoes).toEqual([]);
    expect(segunda.unidadesGravadas).toBe(0);
    expect(segunda.unidadesSemMudanca).toBe(12);
    expect(segunda.fatosGerados.size).toBe(0);
    expect(segunda.fatosJaImportados).toBe(8);
    expect(segunda.gabaritoJaImportadas).toBe(4);
  });

  it("a chave natural não depende do lote: reimportar com outro nome de lote também não duplica", async () => {
    const destino = destinoEmMemoria();
    await importar({ fonte: fonteCsv(LOTE_REFERENCIA), destino, configuracao, lote: "ref-1" });
    const outra = await importar({ fonte: fonteCsv(LOTE_REFERENCIA), destino, configuracao, lote: "ref-2" });
    expect(destino.fatos.size).toBe(8);
    expect(outra.fatosGerados.size).toBe(0);
  });

  it("rejeição parcial não derruba o lote: os válidos entram, cada rejeitado tem arquivo:linha e motivo", async () => {
    const destino = destinoEmMemoria();
    const r = await importar({ fonte: fonteCsv(LOTE_COM_REJEICOES), destino, configuracao, lote: "rej-1" });

    expect(Object.fromEntries(r.fatosGerados)).toEqual({ nascimento: 1, posse: 1, promocao: 1 });
    expect(r.gabaritoGravadas).toBe(1);
    expect(r.rejeicoes.map((x) => [`${x.origem.arquivo}:${x.origem.linha}`, x.motivo])).toEqual([
      ["contracheques.csv:3", "'valor' inválido: '1.234,56' (esperado decimal com ponto e até 2 casas, ex.: 1234.56)"],
      ["contracheques.csv:4", "'competencia' inválida: '2026-13' (esperado 'AAAA-MM')"],
      ["contracheques.csv:5", "vínculo 'V9999' não está neste lote nem em lote anterior"],
      ["eventos.csv:3", "fato 'promocao': tipo 'promocao' (versao 1) exige amparo"],
      ["eventos.csv:4", "tipo de fato desconhecido no catálogo: 'licenca_premio'"],
      ["eventos.csv:5", "tipo de amparo desconhecido no catálogo: 'oficio'"],
      ["eventos.csv:6", "tipo de fato 'posse' abre ou encerra história: vem de vinculos.csv (data_inicio/data_fim), não de eventos"],
      ["eventos.csv:7", "vínculo 'V2002' não está neste lote nem em lote anterior"],
      ["eventos.csv:8", "'evento:E10' repetido no lote (primeira ocorrência em eventos.csv:2)"],
      ["eventos.csv:9", "'amparo_tipo' e 'amparo' devem vir juntos (ou ambos vazios)"],
      ["servidores.csv:3", "'data_nascimento' inválida: '1988-02-30' (esperado 'AAAA-MM-DD')"],
      ["vinculos.csv:3", "servidor '2002' não está neste lote nem em lote anterior"],
      ["vinculos.csv:4", "servidor '9999' não está neste lote nem em lote anterior"],
      ["vinculos.csv:5", "'data_fim' (2020-12-31) anterior a 'data_inicio' (2021-01-01)"],
      ["vinculos.csv:6", "fato 'posse': campo obrigatorio ausente: 'cargo'"],
      ["vinculos.csv:7", "esperadas 5 colunas, encontradas 3"],
    ]);
    expect(r.lidos.ilegivel).toBe(2);
    expect(destino.fatos.size).toBe(3);
  });

  it("referência a servidor/vínculo de lote anterior é aceita", async () => {
    const destino = destinoEmMemoria();
    await importar({ fonte: fonteCsv(LOTE_REFERENCIA), destino, configuracao, lote: "ref-1" });
    const r = await importar({
      fonte: fonteDe([
        { tipo: "vinculo", origem: origem("vinculos.csv", 2), idVinculo: "V1004", idServidor: "1001", dataInicio: "2026-05-01", campos: { cargo: "C1" } },
        { tipo: "contracheque", origem: origem("contracheques.csv", 2), idVinculo: "V1001", competencia: "2026-04", tipoFolha: "MENSAL", rubrica: "0001", valor: "5000.00" },
      ]),
      destino,
      configuracao,
      lote: "ref-2",
    });
    expect(r.rejeicoes).toEqual([]);
    expect(r.unidadesGravadas).toBe(2);
  });

  it("chave já importada com conteúdo diferente é conflito: rejeitada, e nada da unidade é gravado", async () => {
    const destino = destinoEmMemoria();
    await importar({ fonte: fonteCsv(LOTE_REFERENCIA), destino, configuracao, lote: "ref-1" });
    const r = await importar({
      fonte: fonteDe([
        // legado "corrigiu" o cargo da posse e acrescentou o fim do vínculo
        { tipo: "vinculo", origem: origem("vinculos.csv", 2), idVinculo: "V1001", idServidor: "1001", dataInicio: "2020-03-01", dataFim: "2026-09-30", campos: { cargo: "B7" } },
        { tipo: "vinculo", origem: origem("vinculos.csv", 3), idVinculo: "V1003", idServidor: "1001", dataInicio: "2026-03-15", campos: { cargo: "B2" } },
        { tipo: "contracheque", origem: origem("contracheques.csv", 2), idVinculo: "V1001", competencia: "2026-03", tipoFolha: "MENSAL", rubrica: "0001", descricao: "VENCIMENTO", valor: "5000.01" },
      ]),
      destino,
      configuracao,
      lote: "ref-2",
    });
    expect(r.rejeicoes.map((x) => x.motivo)).toEqual([
      "'contracheque:V1001:2026-03:MENSAL:0001' já importado com valor 5000.00",
      "'vinculo:V1001:abertura' já importado com conteúdo diferente",
      "vínculo 'V1003' já importado para outro servidor",
    ]);
    expect(destino.fatos.has("vinculo:V1001:encerramento")).toBe(false);
  });

  it("estado novo do legado num vínculo já importado entra como fato novo (o fim do vínculo)", async () => {
    const destino = destinoEmMemoria();
    await importar({ fonte: fonteCsv(LOTE_REFERENCIA), destino, configuracao, lote: "ref-1" });
    const r = await importar({
      fonte: fonteDe([
        { tipo: "vinculo", origem: origem("vinculos.csv", 2), idVinculo: "V1001", idServidor: "1001", dataInicio: "2020-03-01", dataFim: "2026-09-30", campos: { cargo: "B6" } },
      ]),
      destino,
      configuracao,
      lote: "ref-2",
    });
    expect(r.unidadesGravadas).toBe(1);
    expect(r.fatosJaImportados).toBe(1);
    expect(Object.fromEntries(r.fatosGerados)).toEqual({ exoneracao: 1 });
  });

  it("ordena por dependência: vínculo antes do servidor na fonte ainda é aceito", async () => {
    const destino = destinoEmMemoria();
    const r = await importar({
      fonte: fonteDe([
        { tipo: "vinculo", origem: origem("vinculos.csv", 2), idVinculo: "V1", idServidor: "1", dataInicio: "2020-01-01", campos: { cargo: "A" } },
        { tipo: "servidor", origem: origem("servidores.csv", 2), idServidor: "1" },
      ]),
      destino,
      configuracao,
      lote: "ord",
    });
    expect(r.rejeicoes).toEqual([]);
  });

  it("lote com identificador inválido é recusado antes de ler a fonte", async () => {
    const fonte: FonteLegado = {
      descricao: "nunca lida",
      registros: () => {
        throw new Error("não devia ler");
      },
    };
    await expect(importar({ fonte, destino: destinoEmMemoria(), configuracao, lote: "lote com espaço" })).rejects.toThrow(ErroImportacao);
  });

  it("erro estrutural da fonte aborta ANTES de gravar qualquer coisa", async () => {
    const destino = destinoEmMemoria();
    const fonte: FonteLegado = {
      descricao: "quebra no fim",
      async *registros() {
        yield { tipo: "servidor", origem: origem("servidores.csv", 2), idServidor: "1" } satisfies RegistroLegado;
        throw new Error("contracheques.csv: cabeçalho errado");
      },
    };
    await expect(importar({ fonte, destino, configuracao, lote: "x" })).rejects.toThrow("cabeçalho errado");
    expect(destino.servidores.size).toBe(0);
  });
});
