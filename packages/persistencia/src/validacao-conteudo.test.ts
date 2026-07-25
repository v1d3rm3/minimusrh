import { Amparo, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type {
  AlvoFato,
  CampoSchema,
  CatalogoTiposDeFato,
  HistoriaId,
  PessoaId,
  TipoAmparoChave,
  TipoFato,
  TipoFatoChave,
} from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { validarConteudo } from "./validacao-conteudo.js";

const ALVO_HISTORIA: AlvoFato = { escopo: "historia", historiaId: "h1" as HistoriaId };

function schemaPromocao(): readonly CampoSchema[] {
  return [
    { nome: "cargo", tipo: "texto", obrigatorio: true },
    { nome: "salario", tipo: "dinheiro", obrigatorio: true },
    { nome: "fracao", tipo: "percentual", obrigatorio: false },
    { nome: "efetivo", tipo: "logico", obrigatorio: false },
    { nome: "quantidade", tipo: "numero", obrigatorio: false },
    { nome: "validade", tipo: "data", obrigatorio: false },
    { nome: "observacao_antiga", tipo: "texto", obrigatorio: true, depreciado: true },
  ];
}

function catalogoDeTeste(opts?: { exigeAmparo?: boolean }): CatalogoTiposDeFato {
  const tipoFato: TipoFato = {
    chave: "promocao" as TipoFatoChave,
    alvo: "historia",
    versoes: [
      {
        versao: 1,
        dataEfeito: dataEfeito("2020-01-01"),
        dataRegistro: dataRegistro("2020-01-01T00:00:00Z"),
        schema: schemaPromocao(),
        exigeAmparo: opts?.exigeAmparo ?? false,
      },
    ],
  };
  const mapa = new Map([[tipoFato.chave, tipoFato]]);
  return { porChave: (chave) => mapa.get(chave), todos: () => [tipoFato] };
}

const FATO_BASE = {
  tipo: "promocao" as TipoFatoChave,
  versaoDoTipo: 1,
  alvo: ALVO_HISTORIA,
} as const;

describe("validarConteudo", () => {
  it("aceita conteudo valido com todos os campos preenchidos corretamente", () => {
    const resultado = validarConteudo(catalogoDeTeste(), {
      ...FATO_BASE,
      conteudo: { cargo: "B8", salario: "1234.56", fracao: "15", efetivo: true, quantidade: 3, validade: "2026-12-31" },
    });
    expect(resultado).toBe(true);
  });

  it("aceita conteudo valido sem os campos opcionais e sem o campo depreciado", () => {
    const resultado = validarConteudo(catalogoDeTeste(), {
      ...FATO_BASE,
      conteudo: { cargo: "B8", salario: "1234.56" },
    });
    expect(resultado).toBe(true);
  });

  it("rejeita tipo de fato desconhecido", () => {
    const resultado = validarConteudo(catalogoDeTeste(), {
      ...FATO_BASE,
      tipo: "inexistente" as TipoFatoChave,
      conteudo: {},
    });
    expect(resultado).toEqual({ erro: expect.stringContaining("tipo de fato desconhecido") });
  });

  it("rejeita alvo incompativel com o TipoFato.alvo", () => {
    const resultado = validarConteudo(catalogoDeTeste(), {
      ...FATO_BASE,
      alvo: { escopo: "pessoa", pessoaId: "p1" as PessoaId },
      conteudo: { cargo: "B8", salario: "1234.56" },
    });
    expect(resultado).toEqual({ erro: expect.stringContaining("espera alvo 'historia'") });
  });

  it("rejeita versaoDoTipo inexistente", () => {
    const resultado = validarConteudo(catalogoDeTeste(), {
      ...FATO_BASE,
      versaoDoTipo: 99,
      conteudo: { cargo: "B8", salario: "1234.56" },
    });
    expect(resultado).toEqual({ erro: expect.stringContaining("versao 99 nao encontrada") });
  });

  it("exige amparo quando a versao do tipo exigeAmparo e nenhum foi informado", () => {
    const resultado = validarConteudo(catalogoDeTeste({ exigeAmparo: true }), {
      ...FATO_BASE,
      conteudo: { cargo: "B8", salario: "1234.56" },
    });
    expect(resultado).toEqual({ erro: expect.stringContaining("exige amparo") });
  });

  it("aceita quando exigeAmparo e o amparo foi informado", () => {
    const resultado = validarConteudo(catalogoDeTeste({ exigeAmparo: true }), {
      ...FATO_BASE,
      conteudo: { cargo: "B8", salario: "1234.56" },
      amparo: Amparo.legado("processo" as TipoAmparoChave, "123/2026"),
    });
    expect(resultado).toBe(true);
  });

  it("rejeita conteudo que nao e um objeto", () => {
    const resultado = validarConteudo(catalogoDeTeste(), { ...FATO_BASE, conteudo: "nao-e-objeto" });
    expect(resultado).toEqual({ erro: expect.stringContaining("deve ser um objeto") });
  });

  it("rejeita campo obrigatorio ausente", () => {
    const resultado = validarConteudo(catalogoDeTeste(), { ...FATO_BASE, conteudo: { salario: "1234.56" } });
    expect(resultado).toEqual({ erro: expect.stringContaining("campo obrigatorio ausente: 'cargo'") });
  });

  it("nao exige campo obrigatorio quando depreciado, mesmo ausente", () => {
    const resultado = validarConteudo(catalogoDeTeste(), {
      ...FATO_BASE,
      conteudo: { cargo: "B8", salario: "1234.56" },
    });
    expect(resultado).toBe(true);
  });

  it("rejeita campo desconhecido no conteudo", () => {
    const resultado = validarConteudo(catalogoDeTeste(), {
      ...FATO_BASE,
      conteudo: { cargo: "B8", salario: "1234.56", campoFantasma: 1 },
    });
    expect(resultado).toEqual({ erro: expect.stringContaining("campo desconhecido no conteudo: 'campoFantasma'") });
  });

  it.each([
    ["texto", { cargo: 123, salario: "1234.56" }, "cargo"],
    ["dinheiro", { cargo: "B8", salario: 1234.56 }, "salario"],
    ["logico", { cargo: "B8", salario: "1234.56", efetivo: "sim" }, "efetivo"],
    ["numero", { cargo: "B8", salario: "1234.56", quantidade: "3" }, "quantidade"],
    ["data", { cargo: "B8", salario: "1234.56", validade: 20261231 }, "validade"],
    ["percentual", { cargo: "B8", salario: "1234.56", fracao: 15 }, "fracao"],
  ] as const)("rejeita tipo errado (%s) por shape incompativel", (_tipo, conteudo, campoEsperado) => {
    const resultado = validarConteudo(catalogoDeTeste(), { ...FATO_BASE, conteudo });
    expect(resultado).toEqual({ erro: expect.stringContaining(`'${campoEsperado}'`) });
  });

  it("rejeita data invalida (calendario) mesmo sendo string", () => {
    const resultado = validarConteudo(catalogoDeTeste(), {
      ...FATO_BASE,
      conteudo: { cargo: "B8", salario: "1234.56", validade: "2026-13-01" },
    });
    expect(resultado).toEqual({ erro: expect.stringContaining("validade") });
  });

  it("rejeita valor monetario invalido mesmo sendo string", () => {
    const resultado = validarConteudo(catalogoDeTeste(), {
      ...FATO_BASE,
      conteudo: { cargo: "B8", salario: "abc" },
    });
    expect(resultado).toEqual({ erro: expect.stringContaining("valor monetario invalido") });
  });

  it("rejeita percentual invalido mesmo sendo string", () => {
    const resultado = validarConteudo(catalogoDeTeste(), {
      ...FATO_BASE,
      conteudo: { cargo: "B8", salario: "1234.56", fracao: "abc" },
    });
    expect(resultado).toEqual({ erro: expect.stringContaining("percentual invalido") });
  });
});
