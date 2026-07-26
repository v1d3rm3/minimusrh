import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// arquitetura.test.ts — Regras Globais do playbook + regra específica do Módulo 4:
// "depende SÓ de dominio — o Rush deve recusar qualquer outro import". O Rush já barra a
// dependência no nível de package.json; este teste reforça em texto (mesmo padrão de
// dominio/motor/persistencia) e cobre o caso mais sutil: um import relativo que escape do
// pacote não seria pego pelo Rush. Termos montados por concatenação para este arquivo não
// se autorreprovar no próprio grep.
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
  "@minimusrh/" + "motor",
  "@minimusrh/" + "persistencia",
];

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

function arquivosTs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) return arquivosTs(caminho);
    return entrada.name.endsWith(".ts") && entrada.name !== NOME_DESTE_ARQUIVO ? [caminho] : [];
  });
}

describe("regra de arquitetura: src/ depende só de dominio, sem relógio nem number-para-dinheiro", () => {
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
      expect(conteudo, `'function versaoVigente' redefinida em ${arquivo}`).not.toContain("function versaoVigente");
      expect(conteudo, `'const versaoVigente =' redefinida em ${arquivo}`).not.toContain("const versaoVigente =");
    }
  });
});
