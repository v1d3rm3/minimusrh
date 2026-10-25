import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { SAIDA, USO, executarCli, lerArgumentos } from "./cli.js";

describe("CLI: argumentos", () => {
  it("lê --fonte, --dir e --lote em qualquer ordem", () => {
    expect(lerArgumentos(["--lote", "l1", "--fonte", "csv", "--dir", "/d"])).toEqual({ fonte: "csv", dir: "/d", lote: "l1" });
  });

  it.each([
    [["--fonte", "csv", "--dir", "/d"], "falta a opção '--lote'"],
    [["--fonte", "csv", "--dir"], "falta o valor de '--dir'"],
    [["--fonte", "--dir", "/d"], "falta o valor de '--fonte'"],
    [["--fonte", "csv", "--fonte", "csv"], "opção repetida: '--fonte'"],
    [["--formato", "csv"], "opção desconhecida: '--formato'"],
    [["--fonte", "xml", "--dir", "/d", "--lote", "l"], "fonte desconhecida: 'xml' (disponíveis: csv)"],
  ])("%o ⇒ %s", (argv, erro) => {
    expect(lerArgumentos(argv)).toEqual({ erro });
  });
});

describe("CLI: execução sem banco", () => {
  function capturar() {
    const saida: string[] = [];
    const erros: string[] = [];
    let encerrado = false;
    const pool = { end: async () => { encerrado = true; } } as unknown as Pool;
    return {
      saida,
      erros,
      encerrado: () => encerrado,
      deps: { criarPool: () => pool, escrever: (t: string) => saida.push(t), escreverErro: (t: string) => erros.push(t) },
    };
  }

  it("argumentos inválidos: mostra o uso, sai com erro e nem abre conexão", async () => {
    const c = capturar();
    expect(await executarCli([], c.deps)).toBe(SAIDA.erro);
    expect(c.erros.join("")).toContain(USO);
    expect(c.encerrado()).toBe(false);
  });

  it("erro fatal da fonte: aborta com erro e fecha a conexão", async () => {
    const c = capturar();
    expect(await executarCli(["--fonte", "csv", "--dir", "/nao/existe", "--lote", "l1"], c.deps)).toBe(SAIDA.erro);
    expect(c.erros.join("")).toMatch(/importação abortada.*servidores.csv: não foi possível ler/);
    expect(c.encerrado()).toBe(true);
  });
});
