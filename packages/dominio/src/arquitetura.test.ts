import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Regra inegociável #1 (PROMPT_Claude_Code_Dominio.md): number jamais representa dinheiro,
// e o domínio não conhece relógio nem framework. Este teste substitui a regra de ESLint
// equivalente por um teste de arquitetura, verificado a cada execução da suíte.
const NOME_DESTE_ARQUIVO = "arquitetura.test.ts";
// Termos montados por concatenação: escrevê-los literais faria este arquivo reprovar
// o próprio grep de verificação (critério de aceite do PROMPT_Claude_Code_Dominio.md).
const TERMOS_PROIBIDOS = [
  "parse" + "Float",
  "Number" + "(",
  "new " + "Date" + "()",
  "Date" + ".now",
  "@nest" + "js",
];

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

function arquivosTs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) return arquivosTs(caminho);
    return entrada.name.endsWith(".ts") && entrada.name !== NOME_DESTE_ARQUIVO ? [caminho] : [];
  });
}

describe("regra de arquitetura: src/ não usa number-para-dinheiro, relógio ou framework", () => {
  const arquivos = arquivosTs(SRC_DIR);

  it("encontra arquivos .ts para verificar (a suíte não está vazia)", () => {
    expect(arquivos.length).toBeGreaterThan(0);
  });

  it.each(arquivos)("%s não contém nenhum dos termos proibidos (ver TERMOS_PROIBIDOS)", (arquivo) => {
    const conteudo = readFileSync(arquivo, "utf-8");
    for (const termo of TERMOS_PROIBIDOS) {
      expect(conteudo, `'${termo}' encontrado em ${arquivo}`).not.toContain(termo);
    }
  });
});
