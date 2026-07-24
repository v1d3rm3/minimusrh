import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Regras globais do playbook (repetidas em toda sessão): number nunca é dinheiro; nenhum
// relógio embutido no cálculo (motor não é o pacote `api`); nenhuma dependência de banco
// ou de framework HTTP. Teste de arquitetura no lugar de ESLint, mesma abordagem do
// pacote `dominio`. Termos montados por concatenação: escrevê-los literais faria este
// arquivo reprovar o próprio grep de verificação do critério de aceite.
const NOME_DESTE_ARQUIVO = "arquitetura.test.ts";
const TERMOS_PROIBIDOS = [
  "parse" + "Float",
  "Number" + "(",
  "new " + "Date" + "()",
  "Date" + ".now",
  "@nest" + "js",
  "from " + '"pg"',
  "from " + "'pg'",
  "require(" + '"pg")',
];

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

function arquivosTs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) return arquivosTs(caminho);
    return entrada.name.endsWith(".ts") && entrada.name !== NOME_DESTE_ARQUIVO ? [caminho] : [];
  });
}

describe("regra de arquitetura: src/ não usa number-para-dinheiro, relógio, banco ou framework HTTP", () => {
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

  it("versaoVigente é sempre IMPORTADO de @minimusrh/dominio, nunca redefinido localmente", () => {
    for (const arquivo of arquivos) {
      const conteudo = readFileSync(arquivo, "utf-8");
      expect(conteudo, `'function versaoVigente' redefinida em ${arquivo}`).not.toContain(
        "function versaoVigente",
      );
      expect(conteudo, `'const versaoVigente =' redefinida em ${arquivo}`).not.toContain(
        "const versaoVigente =",
      );
    }
  });
});
