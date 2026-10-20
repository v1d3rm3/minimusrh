import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Regras globais do playbook, adaptadas a `app-folha`: pode importar `pg` (o leitor de
// janelas mora aqui, Playbook Módulo 5), mas number nunca é dinheiro, nenhum relógio
// embutido (todo instante chega do chamador; o relógio é só da `api`) e nada de NestJS
// (Roteiro §2.5.6: o serviço é classe pura). Termos montados por concatenação para não
// autorreprovar o próprio grep de verificação.
const NOME_DESTE_ARQUIVO = "arquitetura.test.ts";
const DIRETORIOS_SUPORTE = ["testes", "demo"];
const TERMOS_PROIBIDOS = ["parse" + "Float", "to" + "Number", "Number" + "(", "new " + "Date" + "()", "Date" + ".now", "@nest" + "js"];

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

function arquivosTs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) return arquivosTs(caminho);
    return entrada.name.endsWith(".ts") && entrada.name !== NOME_DESTE_ARQUIVO ? [caminho] : [];
  });
}

describe("regra de arquitetura: src/ não usa number-para-dinheiro, relógio embutido ou NestJS", () => {
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

  it("testcontainers só no suporte de teste e no demo, nunca no código do serviço", () => {
    for (const arquivo of arquivos) {
      if (DIRETORIOS_SUPORTE.some((d) => arquivo.includes(`/${d}/`))) continue;
      expect(readFileSync(arquivo, "utf-8"), `testcontainers importado em ${arquivo}`).not.toContain("testcontainers");
    }
  });

  it("o serviço não reimplementa a máquina de estados: transições passam por motor::transitar", () => {
    const servico = readFileSync(join(SRC_DIR, "servico-folha.ts"), "utf-8");
    expect(servico).toContain("transitar(");
    expect(servico).not.toContain("TRANSICOES");
  });
});
