import type { HistoriaId, PessoaId, VersaoRegra } from "@minimusrh/dominio";
import { CATALOGO_REGRAS, REGRA_SALARIO_BASE_V1 } from "@minimusrh/regras-alrn";
import { describe, expect, it } from "vitest";
import { agruparRegras, cadastroEmMemoria, configuracaoAlrn } from "./configuracao.js";

describe("configuracao", () => {
  it("agruparRegras junta as versões de uma mesma regra sob a sua chave, na ordem recebida", () => {
    const v2: VersaoRegra = { ...REGRA_SALARIO_BASE_V1, versao: 2 };
    const mapa = agruparRegras([REGRA_SALARIO_BASE_V1, ...CATALOGO_REGRAS.slice(1), v2]);
    expect(mapa.get(REGRA_SALARIO_BASE_V1.regra)?.map((v) => v.versao)).toEqual([1, 2]);
    expect(mapa.size).toBe(CATALOGO_REGRAS.length);
  });

  it("configuracaoAlrn expõe os catálogos da ALRN", () => {
    const configuracao = configuracaoAlrn();
    expect(configuracao.tiposDeFolha.porChave("mensal" as never)).toBeDefined();
    expect(configuracao.tiposDeFato.porChave("posse" as never)?.abreHistoria).toBe(true);
    expect(configuracao.rubricas.todos()).toHaveLength(3);
    expect([...configuracao.regras.keys()]).toEqual(CATALOGO_REGRAS.map((r) => r.regra));
    expect(configuracao.derivacoes.porChave("cargo" as never)).toBeDefined();
  });

  it("cadastroEmMemoria devolve os alvos recebidos", async () => {
    const alvos = [{ pessoaId: "p" as PessoaId, historiaId: "h" as HistoriaId }];
    expect(await cadastroEmMemoria(alvos).listar()).toEqual(alvos);
  });
});
