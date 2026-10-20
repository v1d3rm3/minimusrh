import { Amparo, Dinheiro, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { Fato, FatoId, FolhaId, HistoriaId, RegistroCalculo, RegraChave, RubricaChave } from "@minimusrh/dominio";
import { RUBRICA_CONTRIBUICAO_PREVIDENCIA, RUBRICA_SALARIO_BASE, criarCatalogoRubricas } from "@minimusrh/regras-alrn";
import type { CatalogoRubricas } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { fatosCitados, renderizarContracheque, renderizarExtrato } from "./extrato.js";

const H = "h1" as HistoriaId;

function registro(rubrica: RubricaChave, valor: string, explicacao: RegistroCalculo["explicacao"], historiaId = H): RegistroCalculo {
  return {
    folhaId: "f1" as FolhaId,
    historiaId,
    rubrica,
    versaoRubrica: 1,
    regra: rubrica as string as RegraChave,
    versaoRegra: 2,
    valor: Dinheiro.de(valor),
    explicacao,
  };
}

const POSSE: Fato = {
  id: "fato-posse" as FatoId,
  alvo: { escopo: "historia", historiaId: H },
  tipo: "posse" as Fato["tipo"],
  versaoDoTipo: 1,
  conteudo: { cargo: "B6" },
  dataEfeito: dataEfeito("2020-03-01"),
  dataRegistro: dataRegistro("2020-03-01T00:00:00.000Z"),
  autor: { tipo: "humano", usuarioId: "u" },
};

const PROMOCAO: Fato = {
  ...POSSE,
  id: "fato-promocao" as FatoId,
  tipo: "promocao" as Fato["tipo"],
  conteudo: { cargo: "B8" },
  amparo: Amparo.legado("processo" as Parameters<typeof Amparo.legado>[0], "123/2026"),
};

const SALARIO = registro(RUBRICA_SALARIO_BASE, "6200.00", {
  descricao: "regra 'salario_base' v2 calcula 'salario_base'",
  valor: "6200.00",
  fontes: [
    {
      tipo: "no",
      no: {
        descricao: "derivação 'cargo' v1",
        fontes: [
          { tipo: "derivacao", chave: "cargo" as never, valor: "B8" },
          { tipo: "fato", fatoId: POSSE.id },
          { tipo: "fato", fatoId: PROMOCAO.id },
        ],
      },
    },
    { tipo: "tabela", chave: "salario_por_cargo", versao: 1 },
    { tipo: "fato", fatoId: "fato-desconhecido" as FatoId },
  ],
});

describe("renderizarExtrato", () => {
  it("cabeçalho com rubrica, versão e valor; árvore indentada com todas as formas de fonte", () => {
    const texto = renderizarExtrato(SALARIO, { fatos: new Map([[POSSE.id, POSSE], [PROMOCAO.id, PROMOCAO]]) });
    expect(texto).toBe(
      [
        "salario_base (rubrica v1) = 6200.00",
        "  regra 'salario_base' v2 calcula 'salario_base' = 6200.00",
        "    derivação 'cargo' v1",
        "      derivação cargo = B8",
        `      fato 'posse' {"cargo":"B6"} (efeito 2020-03-01, registrado 2020-03-01T00:00:00.000Z) [fato-posse]`,
        `      fato 'promocao' {"cargo":"B8"} (efeito 2020-03-01, registrado 2020-03-01T00:00:00.000Z, amparo processo ${PROMOCAO.amparo?.identificacaoCanonica}) [fato-promocao]`,
        "    tabela salario_por_cargo v1",
        "    fato fato-desconhecido",
      ].join("\n"),
    );
  });

  it("sem mapa de fatos, cita só o id; rubrica como fonte aparece com o valor", () => {
    const texto = renderizarExtrato(
      registro(RUBRICA_CONTRIBUICAO_PREVIDENCIA, "665.50", {
        descricao: "x",
        fontes: [{ tipo: "rubrica", chave: RUBRICA_SALARIO_BASE, valor: "6200.00" }, { tipo: "fato", fatoId: POSSE.id }],
      }),
    );
    expect(texto.split("\n")).toEqual(["contribuicao_previdencia (rubrica v1) = 665.50", "  x", "    rubrica salario_base = 6200.00", "    fato fato-posse"]);
  });
});

describe("fatosCitados", () => {
  it("coleta ids em qualquer profundidade, sem repetição, na ordem da árvore", () => {
    const outro = registro(RUBRICA_CONTRIBUICAO_PREVIDENCIA, "1", { descricao: "y", fontes: [{ tipo: "fato", fatoId: POSSE.id }] });
    expect(fatosCitados([SALARIO, outro])).toEqual([POSSE.id, PROMOCAO.id, "fato-desconhecido"]);
  });
});

describe("renderizarContracheque", () => {
  it("vantagens, descontos e líquido pela natureza da versão da rubrica; só a história pedida", () => {
    const desconto = registro(RUBRICA_CONTRIBUICAO_PREVIDENCIA, "665.50", { descricao: "d", fontes: [] });
    const deOutraHistoria = registro(RUBRICA_SALARIO_BASE, "1.00", { descricao: "o", fontes: [] }, "h2" as HistoriaId);
    const texto = renderizarContracheque(H, [SALARIO, desconto, deOutraHistoria], criarCatalogoRubricas());

    expect(texto).toContain("+ Salário base");
    expect(texto).toContain("- Contribuição previdenciária");
    expect(texto).toMatch(/Total de vantagens\s+6200\.00/);
    expect(texto).toMatch(/Total de descontos\s+665\.50/);
    expect(texto).toMatch(/Líquido\s+5534\.50/);
    expect(texto).not.toContain("= 1.00");
  });

  it("rubrica 'informativa' aparece sem sinal e não entra em total nenhum", () => {
    const base = criarCatalogoRubricas();
    const salario = base.porChave(RUBRICA_SALARIO_BASE)!;
    const rubricas: CatalogoRubricas = {
      porChave: (chave) => (chave === RUBRICA_SALARIO_BASE ? { ...salario, versoes: [{ ...salario.versoes[0]!, natureza: "informativa" }] } : base.porChave(chave)),
      todos: () => base.todos(),
    };
    const texto = renderizarContracheque(H, [SALARIO], rubricas);
    expect(texto).toMatch(/^ {4}Salário base/m);
    expect(texto).toMatch(/Total de vantagens\s+0\.00/);
    expect(texto).toMatch(/Líquido\s+0\.00/);
  });

  it("rubrica/versão ausente do catálogo é erro explícito", () => {
    const fantasma = { ...SALARIO, rubrica: "fantasma" as RubricaChave };
    expect(() => renderizarContracheque(H, [fantasma], criarCatalogoRubricas())).toThrow(/'fantasma' v1 ausente/);
  });
});
