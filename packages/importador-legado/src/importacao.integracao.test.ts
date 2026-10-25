import { dataRegistro } from "@minimusrh/dominio";
import type { FatoId } from "@minimusrh/dominio";
import { criarPool, fatoRepositorioPg, linhaDoTempoPg } from "@minimusrh/persistencia";
import { TIPO_FATO_PROMOCAO } from "@minimusrh/regras-alrn";
import { dataEfeito } from "@minimusrh/dominio";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SAIDA, executarCli } from "./cli.js";
import { configuracaoAlrn } from "./configuracao.js";
import { destinoPg } from "./destino-pg.js";
import { fonteCsv } from "./fonte-csv.js";
import { historiaIdDoVinculo, pessoaIdDoServidor } from "./identidade.js";
import { importar } from "./importar.js";
import type { RegistroLegado } from "./registros.js";
import { subirAmbiente, type AmbienteIntegracao } from "./testes/ambiente-integracao.js";
import { LOTE_COM_REJEICOES, LOTE_REFERENCIA } from "./testes/caminhos.js";
import { ehRejeicao, traduzir, type UnidadeImportacao } from "./tradutores.js";
import { listarVinculosImportados } from "./vinculos-importados.js";

// importacao.integracao.test.ts — o importador contra o Postgres real, com o papel
// `minimus_app`: idempotência (2x ⇒ mesmos fatos), rejeição parcial, conflito sem gravação
// parcial, convenção de data visível no fato GRAVADO, e a história importada legível pela
// `linhaDoTempoPg` (o que o harness do Módulo 8 vai calcular).

const configuracao = configuracaoAlrn();

async function contar(ambiente: AmbienteIntegracao, tabela: string): Promise<number> {
  const r = await ambiente.poolApp.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${tabela}`);
  return Number.parseInt(r.rows[0]!.n, 10);
}

async function idsDeFato(ambiente: AmbienteIntegracao): Promise<string[]> {
  return (await ambiente.poolApp.query<{ id: string }>("SELECT id FROM fato ORDER BY id")).rows.map((r) => r.id);
}

function importarDir(ambiente: AmbienteIntegracao, dir: string, lote: string) {
  return importar({ fonte: fonteCsv(dir), destino: destinoPg(ambiente.poolApp, configuracao.tiposDeFato, lote), configuracao, lote });
}

function unidade(registro: RegistroLegado, lote: string): UnidadeImportacao {
  const u = traduzir({ configuracao, lote }, registro);
  if (ehRejeicao(u)) throw new Error(u.motivo);
  return u;
}

describe("importador-legado contra Postgres (integração)", () => {
  let ambiente: AmbienteIntegracao;

  beforeAll(async () => {
    ambiente = await subirAmbiente();
  });

  afterAll(async () => {
    await ambiente.encerrar();
  });

  it("lote de referência: grava fatos, identidades e gabarito", async () => {
    const r = await importarDir(ambiente, LOTE_REFERENCIA, "ref-1");
    expect(r.rejeicoes).toEqual([]);
    expect(await contar(ambiente, "fato")).toBe(8);
    expect(await contar(ambiente, "fato_importado")).toBe(8);
    expect(await contar(ambiente, "servidor_legado")).toBe(3);
    expect(await contar(ambiente, "vinculo_legado")).toBe(3);
    expect(await contar(ambiente, "gabarito_legado")).toBe(4);

    const gabarito = await ambiente.poolApp.query(
      "SELECT competencia, tipo_folha_legado, rubrica_legado, descricao, valor::text AS valor, lote FROM gabarito_legado WHERE rubrica_legado = '0450'",
    );
    expect(gabarito.rows).toEqual([{ competencia: "2026-03", tipo_folha_legado: "MENSAL", rubrica_legado: "0450", descricao: "AUXILIO SAUDE", valor: "350.00", lote: "ref-1" }]);
  });

  it("a convenção de data e o autor do lote ficam visíveis no fato gravado", async () => {
    const linhas = await ambiente.poolApp.query<{ fato_id: string; chave_natural: string }>("SELECT fato_id, chave_natural FROM fato_importado");
    const porChave = new Map(linhas.rows.map((l) => [l.chave_natural, l.fato_id as FatoId]));
    const repositorio = fatoRepositorioPg(ambiente.poolApp, configuracao.tiposDeFato);

    const posse = await repositorio.buscarPorId(porChave.get("vinculo:V1001:abertura")!);
    expect(posse).toMatchObject({
      tipo: "posse",
      dataEfeito: "2020-03-01",
      dataRegistro: "2020-03-01T00:00:00.000Z",
      autor: { tipo: "importacao", lote: "ref-1" },
      conteudo: { cargo: "B6" },
      alvo: { escopo: "historia", historiaId: historiaIdDoVinculo("V1001") },
    });

    const promocao = await repositorio.buscarPorId(porChave.get("evento:E1")!);
    expect(promocao).toMatchObject({ dataRegistro: "2026-07-10T17:30:00.000Z", amparo: { tipo: "processo", comoInformado: "Proc. 123/2026", identificacaoCanonica: "Proc. 123/2026" } });
    expect(promocao!.amparo!.validadoContraVersao).toBeUndefined();
  });

  it("idempotência: importar o mesmo lote 2x ⇒ exatamente os mesmos fatos", async () => {
    const antes = await idsDeFato(ambiente);
    const segunda = await importarDir(ambiente, LOTE_REFERENCIA, "ref-1");
    expect(await idsDeFato(ambiente)).toEqual(antes);
    expect(segunda.unidadesGravadas).toBe(0);
    expect(segunda.unidadesSemMudanca).toBe(12);
    expect(segunda.fatosJaImportados).toBe(8);
    expect(segunda.gabaritoJaImportadas).toBe(4);
    expect(await contar(ambiente, "gabarito_legado")).toBe(4);
  });

  it("a história importada é legível pela linha do tempo: abertura, e a promoção só depois do registro", async () => {
    const vinculos = await listarVinculosImportados(ambiente.poolApp);
    expect(vinculos.map((v) => v.idVinculoLegado)).toEqual(["V1001", "V1002", "V1003"]);
    const victor = vinculos[0]!;
    expect(victor).toEqual({ pessoaId: pessoaIdDoServidor("1001"), historiaId: historiaIdDoVinculo("V1001"), idVinculoLegado: "V1001", idServidorLegado: "1001" });

    const antesDoRegistro = await linhaDoTempoPg(ambiente.poolApp, configuracao.tiposDeFato, victor, dataRegistro("2026-06-30T00:00:00Z"));
    expect(antesDoRegistro.aberturaDaHistoria().conteudo).toEqual({ cargo: "B6" });
    expect(antesDoRegistro.vigenteEm(TIPO_FATO_PROMOCAO, dataEfeito("2026-03-31"))).toBeUndefined();

    const depois = await linhaDoTempoPg(ambiente.poolApp, configuracao.tiposDeFato, victor, dataRegistro("2026-07-31T00:00:00Z"));
    expect(depois.vigenteEm(TIPO_FATO_PROMOCAO, dataEfeito("2026-03-31"))?.conteudo).toEqual({ cargo: "B8" });

    const encerrado = await linhaDoTempoPg(ambiente.poolApp, configuracao.tiposDeFato, vinculos[1]!, dataRegistro("2026-07-31T00:00:00Z"));
    expect(encerrado.encerramentoDaHistoria()?.dataEfeito).toBe("2026-02-20");
  });

  it("rejeição parcial não derruba o lote: os válidos entram, os rejeitados não deixam rastro", async () => {
    const fatosAntes = await contar(ambiente, "fato");
    const r = await importarDir(ambiente, LOTE_COM_REJEICOES, "rej-1");
    expect(r.rejeicoes).toHaveLength(16);
    expect(await contar(ambiente, "fato")).toBe(fatosAntes + 3);
    const vinculos = (await listarVinculosImportados(ambiente.poolApp)).map((v) => v.idVinculoLegado);
    expect(vinculos).toContain("V2001");
    expect(vinculos).not.toContain("V2005");
  });

  it("conflito: chave já importada com conteúdo diferente é rejeitada, e a unidade não grava nada", async () => {
    const fatosAntes = await idsDeFato(ambiente);
    const r = await importar({
      fonte: {
        descricao: "correcoes",
        async *registros() {
          yield { tipo: "vinculo", origem: { arquivo: "vinculos.csv", linha: 2 }, idVinculo: "V1001", idServidor: "1001", dataInicio: "2020-03-01", dataFim: "2026-09-30", campos: { cargo: "B7" } };
          yield { tipo: "vinculo", origem: { arquivo: "vinculos.csv", linha: 3 }, idVinculo: "V1003", idServidor: "1001", dataInicio: "2026-03-15", campos: { cargo: "B2" } };
          yield { tipo: "contracheque", origem: { arquivo: "contracheques.csv", linha: 2 }, idVinculo: "V1001", competencia: "2026-03", tipoFolha: "MENSAL", rubrica: "0001", descricao: "VENCIMENTO", valor: "5000.01" };
          yield { tipo: "contracheque", origem: { arquivo: "contracheques.csv", linha: 3 }, idVinculo: "V1001", competencia: "2026-03", tipoFolha: "MENSAL", rubrica: "0450", valor: "350.00" };
        },
      },
      destino: destinoPg(ambiente.poolApp, configuracao.tiposDeFato, "ref-2"),
      configuracao,
      lote: "ref-2",
    });
    expect(r.rejeicoes.map((x) => x.motivo)).toEqual([
      "'contracheque:V1001:2026-03:MENSAL:0001' já importado como 5000.00 'VENCIMENTO', não 5000.01 'VENCIMENTO'",
      "'contracheque:V1001:2026-03:MENSAL:0450' já importado como 350.00 'AUXILIO SAUDE', não 350.00 ''",
      "'vinculo:V1001:abertura' já importado com conteúdo diferente (correção do legado exige fato de substituição)",
      "vínculo 'V1003' já importado para o servidor '1003', não '1001'",
    ]);
    expect(await idsDeFato(ambiente)).toEqual(fatosAntes);
  });

  it("tudo ou nada dentro da unidade: um fato novo antes de um conflitante é desfeito", async () => {
    const fatosAntes = await idsDeFato(ambiente);
    const novo = unidade({ tipo: "evento", origem: { arquivo: "e", linha: 2 }, idEvento: "E-novo", idVinculo: "V1001", tipoFato: "promocao", dataEfeito: "2026-08-01", amparo: { tipo: "processo", comoInformado: "9/2026" }, campos: { cargo: "B9" } }, "atom");
    const conflitante = unidade({ tipo: "evento", origem: { arquivo: "e", linha: 3 }, idEvento: "E1", idVinculo: "V1001", tipoFato: "promocao", dataEfeito: "2026-02-15", amparo: { tipo: "processo", comoInformado: "123/2026" }, campos: { cargo: "B8" } }, "atom");
    if (novo.tipo !== "evento" || conflitante.tipo !== "evento") throw new Error();

    const resultado = await destinoPg(ambiente.poolApp, configuracao.tiposDeFato, "atom").gravar({ ...novo, fatos: [...novo.fatos, ...conflitante.fatos] });
    expect(resultado).toEqual({ ok: false, conflito: expect.stringContaining("'evento:E1' já importado com conteúdo diferente") });
    expect(await idsDeFato(ambiente)).toEqual(fatosAntes);
  });

  it("erro que não é conflito sobe, e a transação da unidade é desfeita", async () => {
    const u = unidade({ tipo: "servidor", origem: { arquivo: "s", linha: 2 }, idServidor: "8888", dataNascimento: "1980-01-01" }, "x");
    if (u.tipo !== "servidor") throw new Error();
    const corrompida = { ...u, fatos: u.fatos.map((f) => ({ ...f, fato: { ...f.fato, conteudo: { inventado: "x" } } })) };
    await expect(destinoPg(ambiente.poolApp, configuracao.tiposDeFato, "x").gravar(corrompida)).rejects.toThrow(/campo desconhecido/);
    expect(await ambiente.poolApp.query("SELECT 1 FROM servidor_legado WHERE id_servidor_legado = '8888'")).toMatchObject({ rowCount: 0 });
  });

  it("identidade de servidor já gravada com outra pessoa é conflito", async () => {
    await ambiente.poolApp.query("INSERT INTO servidor_legado (id_servidor_legado, pessoa_id, lote) VALUES ('7777', $1, 'manual')", [randomUUID()]);
    const resultado = await destinoPg(ambiente.poolApp, configuracao.tiposDeFato, "x").gravar(unidade({ tipo: "servidor", origem: { arquivo: "s", linha: 2 }, idServidor: "7777" }, "x"));
    expect(resultado).toEqual({ ok: false, conflito: expect.stringContaining("servidor '7777' já importado com outra pessoa") });
  });

  it("gabarito com a mesma chave e outra descrição é conflito, inclusive quando a gravada não tinha descrição", async () => {
    const destino = destinoPg(ambiente.poolApp, configuracao.tiposDeFato, "x");
    const linha = { tipo: "contracheque", origem: { arquivo: "c", linha: 2 }, idVinculo: "V1001", competencia: "2026-04", tipoFolha: "MENSAL", rubrica: "0999", valor: "1.00" } as const;
    expect(await destino.gravar(unidade(linha, "x"))).toMatchObject({ ok: true, semMudanca: false });
    expect(await destino.gravar(unidade({ ...linha, descricao: "OUTRA" }, "x"))).toEqual({
      ok: false,
      conflito: "'contracheque:V1001:2026-04:MENSAL:0999' já importado como 1.00 '', não 1.00 'OUTRA'",
    });
  });

  it("CLI ponta a ponta: lote limpo sai 0, lote com rejeições sai 2", async () => {
    const saida: string[] = [];
    const deps = { criarPool: () => criarPool(ambiente.conexaoApp()), escrever: (t: string) => saida.push(t), escreverErro: (t: string) => saida.push(t) };
    expect(await executarCli(["--fonte", "csv", "--dir", LOTE_REFERENCIA, "--lote", "ref-1"], deps)).toBe(SAIDA.ok);
    expect(saida.join("")).toContain("Unidades: 0 gravada(s) · 12 já importada(s), sem mudança · 0 rejeitada(s)");
    expect(await executarCli(["--fonte", "csv", "--dir", LOTE_COM_REJEICOES, "--lote", "rej-1"], deps)).toBe(SAIDA.comRejeicoes);
  });
});
