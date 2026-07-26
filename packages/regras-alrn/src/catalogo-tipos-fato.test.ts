import { describe, expect, it } from "vitest";
import {
  CATALOGO_TIPOS_DE_FATO,
  TIPO_FATO_COMPROVACAO_PLANO_SAUDE,
  TIPO_FATO_EXONERACAO,
  TIPO_FATO_NASCIMENTO,
  TIPO_FATO_POSSE,
  TIPO_FATO_PROMOCAO,
  criarCatalogoTiposDeFato,
} from "./catalogo-tipos-fato.js";

describe("catálogo de tipos de fato", () => {
  it("tem exatamente os 5 tipos do escopo do Módulo 4", () => {
    expect(CATALOGO_TIPOS_DE_FATO.map((t) => t.chave)).toEqual([
      TIPO_FATO_POSSE,
      TIPO_FATO_EXONERACAO,
      TIPO_FATO_NASCIMENTO,
      TIPO_FATO_PROMOCAO,
      TIPO_FATO_COMPROVACAO_PLANO_SAUDE,
    ]);
  });

  it("posse abre história e promoção carregam o campo 'cargo' (lido pela derivação cargo)", () => {
    const catalogo = criarCatalogoTiposDeFato();
    const posse = catalogo.porChave(TIPO_FATO_POSSE);
    const promocao = catalogo.porChave(TIPO_FATO_PROMOCAO);

    expect(posse?.abreHistoria).toBe(true);
    expect(posse?.versoes[0]?.schema).toContainEqual({ nome: "cargo", tipo: "texto", obrigatorio: true });
    expect(promocao?.versoes[0]?.schema).toContainEqual({ nome: "cargo", tipo: "texto", obrigatorio: true });
  });

  it("exoneracao encerra história; nascimento é sobre pessoa", () => {
    const catalogo = criarCatalogoTiposDeFato();
    expect(catalogo.porChave(TIPO_FATO_EXONERACAO)?.encerraHistoria).toBe(true);
    expect(catalogo.porChave(TIPO_FATO_NASCIMENTO)?.alvo).toBe("pessoa");
  });

  it("promocao exige amparo; os demais não", () => {
    const catalogo = criarCatalogoTiposDeFato();
    expect(catalogo.porChave(TIPO_FATO_PROMOCAO)?.versoes[0]?.exigeAmparo).toBe(true);
    expect(catalogo.porChave(TIPO_FATO_POSSE)?.versoes[0]?.exigeAmparo).toBe(false);
  });

  it("comprovacao_plano_saude tem o schema {operadora, mensalidade, periodo_fim}", () => {
    const catalogo = criarCatalogoTiposDeFato();
    const schema = catalogo.porChave(TIPO_FATO_COMPROVACAO_PLANO_SAUDE)?.versoes[0]?.schema;
    expect(schema).toEqual([
      { nome: "operadora", tipo: "texto", obrigatorio: true },
      { nome: "mensalidade", tipo: "dinheiro", obrigatorio: true },
      { nome: "periodo_fim", tipo: "data", obrigatorio: true },
    ]);
  });

  it("porChave devolve undefined para chave desconhecida", () => {
    expect(criarCatalogoTiposDeFato().porChave("inexistente" as never)).toBeUndefined();
  });
});
