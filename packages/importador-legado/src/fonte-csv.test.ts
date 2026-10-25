import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ErroFonte, fonteCsv, registrosDoArquivo } from "./fonte-csv.js";
import type { RegistroLegado } from "./registros.js";
import { LOTE_REFERENCIA } from "./testes/caminhos.js";

async function todos(dir: string): Promise<RegistroLegado[]> {
  const registros: RegistroLegado[] = [];
  for await (const r of fonteCsv(dir).registros()) registros.push(r);
  return registros;
}

describe("FonteCsv — layout de referência (docs/layout-importacao.md)", () => {
  it("lê os quatro arquivos do lote de referência, em ordem, com a origem de cada registro", async () => {
    const registros = await todos(LOTE_REFERENCIA);
    expect(registros.map((r) => r.tipo)).toEqual([
      "servidor", "servidor", "servidor",
      "vinculo", "vinculo", "vinculo",
      "evento", "evento",
      "contracheque", "contracheque", "contracheque", "contracheque",
    ]);
    expect(registros[0]).toEqual({ tipo: "servidor", origem: { arquivo: "servidores.csv", linha: 2 }, idServidor: "1001", dataNascimento: "1990-05-20" });
    expect(registros[2]).toEqual({ tipo: "servidor", origem: { arquivo: "servidores.csv", linha: 4 }, idServidor: "1003" });
    expect(registros[4]).toEqual({
      tipo: "vinculo",
      origem: { arquivo: "vinculos.csv", linha: 3 },
      idVinculo: "V1002",
      idServidor: "1002",
      dataInicio: "2010-07-10",
      dataFim: "2026-02-20",
      campos: { cargo: "B4" },
    });
    expect(registros[6]).toEqual({
      tipo: "evento",
      origem: { arquivo: "eventos.csv", linha: 2 },
      idEvento: "E1",
      idVinculo: "V1001",
      tipoFato: "promocao",
      dataEfeito: "2026-02-15",
      dataRegistro: "2026-07-10T14:30:00-03:00",
      amparo: { tipo: "processo", comoInformado: "Proc. 123/2026" },
      campos: { cargo: "B8" },
    });
    expect(registros[7]).toMatchObject({ campos: { operadora: 'Unimed; plano "A"', mensalidade: "350.00", periodo_fim: "2026-12-31" } });
    expect(registros[8]).toEqual({
      tipo: "contracheque",
      origem: { arquivo: "contracheques.csv", linha: 2 },
      idVinculo: "V1001",
      competencia: "2026-03",
      tipoFolha: "MENSAL",
      rubrica: "0001",
      descricao: "VENCIMENTO",
      valor: "5000.00",
    });
    expect(fonteCsv(LOTE_REFERENCIA).descricao).toBe(`csv:${LOTE_REFERENCIA}`);
  });

  it("apara espaços das células, menos do amparo (grafia preservada para auditoria)", () => {
    const [r] = registrosDoArquivo(
      "evento",
      "eventos.csv",
      "id_evento;id_vinculo;tipo_fato;data_efeito;amparo_tipo;amparo\n E1 ;V1;promocao;2026-01-01; processo ;  Proc. 1/26 \n",
    );
    expect(r).toMatchObject({ idEvento: "E1", amparo: { tipo: "processo", comoInformado: "  Proc. 1/26 " } });
  });

  it("evento sem amparo não tem a propriedade; contracheque sem descrição também não", () => {
    const [evento] = registrosDoArquivo("evento", "eventos.csv", "id_evento;id_vinculo;tipo_fato;data_efeito\nE1;V1;promocao;2026-01-01\n");
    expect(evento).not.toHaveProperty("amparo");
    expect(evento).not.toHaveProperty("dataRegistro");
    const [cc] = registrosDoArquivo("contracheque", "c.csv", "id_vinculo;competencia;tipo_folha;rubrica;valor\nV1;2026-03;M;1;10.00\n");
    expect(cc).not.toHaveProperty("descricao");
  });

  it.each([
    ["número de colunas errado", "id_servidor;data_nascimento\n1;2;3\n", "esperadas 2 colunas, encontradas 3"],
    ["coluna obrigatória vazia", "id_servidor;data_nascimento\n ;1990-01-01\n", "coluna obrigatória vazia: 'id_servidor'"],
  ])("linha com %s vira registro ilegível, sem derrubar o arquivo", (_caso, texto, motivo) => {
    expect(registrosDoArquivo("servidor", "servidores.csv", `${texto}9;\n`)).toEqual([
      { tipo: "ilegivel", origem: { arquivo: "servidores.csv", linha: 2 }, motivo },
      { tipo: "servidor", origem: { arquivo: "servidores.csv", linha: 3 }, idServidor: "9" },
    ]);
  });

  it("amparo pela metade é ilegível", () => {
    const [r] = registrosDoArquivo("evento", "eventos.csv", "id_evento;id_vinculo;tipo_fato;data_efeito;amparo_tipo;amparo\nE1;V1;promocao;2026-01-01;processo;\n");
    expect(r).toEqual({ tipo: "ilegivel", origem: { arquivo: "eventos.csv", linha: 2 }, motivo: "'amparo_tipo' e 'amparo' devem vir juntos (ou ambos vazios)" });
  });

  it.each([
    ["arquivo vazio", "", /arquivo vazio/],
    ["coluna obrigatória ausente", "data_nascimento\n", /coluna obrigatória ausente no cabeçalho: 'id_servidor'/],
    ["coluna desconhecida", "id_servidor;nome\n", /coluna desconhecida no cabeçalho: 'nome'/],
    ["campo.* onde não se aceita", "id_servidor;campo.x\n", /coluna desconhecida/],
    ["coluna repetida", "id_servidor;id_servidor\n", /coluna repetida/],
    ["aspas não fechadas", 'id_servidor\n"1\n', /servidores.csv: aspas não fechadas/],
  ])("erro de estrutura é fatal: %s", (_caso, texto, mensagem) => {
    expect(() => registrosDoArquivo("servidor", "servidores.csv", texto)).toThrow(ErroFonte);
    expect(() => registrosDoArquivo("servidor", "servidores.csv", texto)).toThrow(mensagem);
  });

  it("'campo.' sem nome não é coluna de conteúdo", () => {
    expect(() => registrosDoArquivo("vinculo", "vinculos.csv", "id_vinculo;id_servidor;data_inicio;campo.\n")).toThrow(/coluna desconhecida/);
  });

  it("arquivo ausente no diretório é fatal", async () => {
    const dir = await mkdtemp(join(tmpdir(), "importador-"));
    await writeFile(join(dir, "servidores.csv"), "id_servidor\n1\n");
    await expect(todos(dir)).rejects.toThrow(/vinculos.csv: não foi possível ler/);
  });
});
