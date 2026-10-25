import { describe, expect, it } from "vitest";
import { configuracaoAlrn } from "./configuracao.js";
import { fonteCsv } from "./fonte-csv.js";
import { historiaIdDoVinculo, pessoaIdDoServidor } from "./identidade.js";
import { importar } from "./importar.js";
import { TAMANHO_AMOSTRA, novoAcumulador, renderizarRelatorio } from "./relatorio.js";
import { LOTE_COM_REJEICOES, LOTE_REFERENCIA } from "./testes/caminhos.js";
import { destinoEmMemoria } from "./testes/destino-em-memoria.js";
import { ehRejeicao, traduzir } from "./tradutores.js";

describe("relatório de importação", () => {
  it("texto legível: totais, convenção, rejeições e amostra por tipo", async () => {
    const r = await importar({ fonte: fonteCsv(LOTE_REFERENCIA), destino: destinoEmMemoria(), configuracao: configuracaoAlrn(), lote: "ref-1" });
    const texto = renderizarRelatorio(r);
    expect(texto).toContain(`Importação do lote 'ref-1' — fonte csv:${LOTE_REFERENCIA}`);
    expect(texto).toContain("Registros lidos: servidores 3 · vínculos 3 · eventos 2 · contracheques 4 · ilegíveis 0");
    expect(texto).toContain("Unidades: 12 gravada(s) · 0 já importada(s), sem mudança · 0 rejeitada(s)");
    expect(texto).toContain("Fatos gerados: 8 (nascimento 2, posse 3, exoneracao 1, promocao 1, comprovacao_plano_saude 1) · já importados antes: 0");
    expect(texto).toContain("CONVENCAO_REGISTRO_DESCONHECIDO [data_registro := data_efeito (00:00:00Z do dia do efeito)]: 7 fato(s)");
    expect(texto).toContain("Gabarito (contracheques do legado): 4 linha(s) gravada(s) · 0 já importada(s)");
    expect(texto).toContain("Rejeições (0):\n  nenhuma");
    expect(texto).toContain(`    pessoa ${pessoaIdDoServidor("1001")} · efeito 1990-05-20 · registro 1990-05-20T00:00:00.000Z (convenção) · v1 · {}`);
    expect(texto).toContain(
      `    história ${historiaIdDoVinculo("V1001")} · efeito 2026-02-15 · registro 2026-07-10T17:30:00.000Z · v1 · {"cargo":"B8"} · amparo processo 'Proc. 123/2026'`,
    );
  });

  it("lista as rejeições e diz quando não há fato novo", async () => {
    const destino = destinoEmMemoria();
    await importar({ fonte: fonteCsv(LOTE_COM_REJEICOES), destino, configuracao: configuracaoAlrn(), lote: "rej" });
    const segunda = renderizarRelatorio(await importar({ fonte: fonteCsv(LOTE_COM_REJEICOES), destino, configuracao: configuracaoAlrn(), lote: "rej" }));
    expect(segunda).toContain("  vinculos.csv:7 — esperadas 5 colunas, encontradas 3");
    expect(segunda).toContain("Fatos gerados: 0 · já importados antes: 3");
    expect(segunda).toContain("  nenhum fato novo");
  });

  it(`a amostra guarda no máximo ${TAMANHO_AMOSTRA} fatos por tipo`, () => {
    const acumulador = novoAcumulador("l", "f");
    const configuracao = configuracaoAlrn();
    for (const id of ["1", "2", "3", "4"]) {
      const u = traduzir({ configuracao, lote: "l" }, { tipo: "servidor", origem: { arquivo: "s", linha: 1 }, idServidor: id, dataNascimento: "1990-01-01" });
      if (ehRejeicao(u)) throw new Error();
      acumulador.gravado(u, { ok: true, fatosNovos: u.tipo === "servidor" ? u.fatos : [], fatosJaImportados: 0, semMudanca: false });
    }
    const r = acumulador.relatorio();
    expect(r.fatosGerados.get("nascimento")).toBe(4);
    expect(r.amostra.get("nascimento")).toHaveLength(TAMANHO_AMOSTRA);
  });
});
