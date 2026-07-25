import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Regras globais do playbook, adaptadas: `persistencia` é o ÚNICO pacote autorizado a
// importar `pg` (é literalmente o propósito do módulo) — a lista de termos proibidos do
// `motor` NÃO se aplica aqui igual; mantém-se apenas o que continua valendo: number
// nunca é dinheiro (NUMERIC ⇄ Dinheiro sempre via string), nenhum relógio embutido
// (persistencia não é o pacote `api`), nenhuma dependência de NestJS. Termos montados
// por concatenação para não autorreprovar o próprio grep de verificação.
const NOME_DESTE_ARQUIVO = "arquitetura.test.ts";
const DIRETORIO_TESTES_SUPORTE = "testes";
const TERMOS_PROIBIDOS = [
  "parse" + "Float",
  "to" + "Number",
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

describe("regra de arquitetura: src/ nao usa number-para-dinheiro, relogio embutido ou NestJS", () => {
  const arquivos = arquivosTs(SRC_DIR);

  it("encontra arquivos .ts para verificar (a suite nao esta vazia)", () => {
    expect(arquivos.length).toBeGreaterThan(0);
  });

  it.each(arquivos)("%s nao contem nenhum dos termos proibidos (ver TERMOS_PROIBIDOS)", (arquivo) => {
    const conteudo = readFileSync(arquivo, "utf-8");
    for (const termo of TERMOS_PROIBIDOS) {
      expect(conteudo, `'${termo}' encontrado em ${arquivo}`).not.toContain(termo);
    }
  });

  it("versaoVigente e sempre IMPORTADO de @minimusrh/dominio, nunca redefinido localmente", () => {
    for (const arquivo of arquivos) {
      const conteudo = readFileSync(arquivo, "utf-8");
      expect(conteudo, `'function versaoVigente' redefinida em ${arquivo}`).not.toContain("function versaoVigente");
      expect(conteudo, `'const versaoVigente =' redefinida em ${arquivo}`).not.toContain("const versaoVigente =");
    }
  });

  it("nenhum arquivo fora de src/testes/ importa @testcontainers/postgresql (isolado ao suporte de teste)", () => {
    for (const arquivo of arquivos) {
      if (arquivo.includes(`/${DIRETORIO_TESTES_SUPORTE}/`)) continue;
      const conteudo = readFileSync(arquivo, "utf-8");
      expect(conteudo, `testcontainers importado fora de src/testes/ em ${arquivo}`).not.toContain("testcontainers");
    }
  });
});
