import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Regras globais do playbook, adaptadas ao importador: number nunca é dinheiro, nenhum relógio
// embutido (a convenção de registro vem da data de efeito, nunca de "agora"), nada de NestJS,
// nenhum UPDATE/DELETE (Regra Global #4: a idempotência é "já existe igual", nunca "atualiza"),
// e amparo SÓ pela porta do legado (Playbook Módulo 7, item 2). Termos montados por
// concatenação para não autorreprovar o próprio grep de verificação.
const NOME_DESTE_ARQUIVO = "arquitetura.test.ts";
const TERMOS_PROIBIDOS = [
  "parse" + "Float",
  "to" + "Number",
  "Number" + "(",
  "new " + "Date" + "()",
  "Date" + ".now",
  "@nest" + "js",
  "UPDATE" + " ",
  "DELETE" + " ",
  "Amparo" + ".criar",
];

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

function arquivosTs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) return arquivosTs(caminho);
    return entrada.name.endsWith(".ts") && !entrada.name.endsWith(".test.ts") ? [caminho] : [];
  });
}

describe("regra de arquitetura: src/ do importador", () => {
  const arquivos = arquivosTs(SRC_DIR).filter((a) => !a.endsWith(NOME_DESTE_ARQUIVO));

  it("encontra arquivos .ts para verificar (a suíte não está vazia)", () => {
    expect(arquivos.length).toBeGreaterThan(0);
  });

  it.each(arquivos)("%s não contém nenhum dos termos proibidos (ver TERMOS_PROIBIDOS)", (arquivo) => {
    const conteudo = readFileSync(arquivo, "utf-8");
    for (const termo of TERMOS_PROIBIDOS) {
      expect(conteudo, `'${termo}' encontrado em ${arquivo}`).not.toContain(termo);
    }
  });

  it("testcontainers só no suporte de teste", () => {
    for (const arquivo of arquivos) {
      if (arquivo.includes("/testes/")) continue;
      expect(readFileSync(arquivo, "utf-8"), `testcontainers importado em ${arquivo}`).not.toContain("testcontainers");
    }
  });

  it("fato só é gravado pela porta única de persistencia (nenhum INSERT INTO fato direto)", () => {
    for (const arquivo of arquivos) {
      expect(readFileSync(arquivo, "utf-8"), `INSERT direto em fato em ${arquivo}`).not.toMatch(/INSERT INTO fato\s*\(/);
    }
  });
});
