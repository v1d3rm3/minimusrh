import { describe, expect, it } from "vitest";
import { Dinheiro } from "@minimusrh/dominio";
import type {
  Classificacao,
  Contexto,
  DataEfeito,
  DataRegistro,
  RubricaChave,
  TipoFolhaChave,
  VersaoRegra,
  VersaoRubrica,
} from "@minimusrh/dominio";
import { ErroRubricaProduzidaPorMaisDeUmaRegra, montarGrafo } from "./grafo.js";

function rubricaChave(nome: string): RubricaChave {
  return nome as RubricaChave;
}

function classificacao(nome: string): Classificacao {
  return nome as Classificacao;
}

function regra(
  produz: string,
  overrides: { readonly consome?: Partial<VersaoRegra["consome"]> } = {},
): VersaoRegra {
  return {
    regra: `regra_${produz}` as VersaoRegra["regra"],
    versao: 1,
    dataEfeito: "2026-01-01" as DataEfeito,
    dataRegistro: "2026-01-01T00:00:00Z" as DataRegistro,
    aplicaSeAFolhas: ["mensal" as TipoFolhaChave],
    escopo: { tipo: "global" },
    produz: rubricaChave(produz),
    consome: {
      derivacoes: [],
      rubricas: [],
      classificacoes: [],
      tiposFato: [],
      janelas: [],
      ...overrides.consome,
    },
    quando: () => true,
    calcular: (_ctx: Contexto) => Dinheiro.zero(),
  };
}

function versaoRubrica(classificacoes: readonly Classificacao[] = []): VersaoRubrica {
  return {
    versao: 1,
    dataEfeito: "2026-01-01" as DataEfeito,
    dataRegistro: "2026-01-01T00:00:00Z" as DataRegistro,
    nome: "rubrica de teste",
    natureza: "vantagem",
    classificacoes: new Set(classificacoes),
    arredondamento: "meio_para_cima",
    proporcionalizavel: false,
  };
}

function mapaRubricas(
  entradas: readonly (readonly [string, readonly Classificacao[]])[],
): ReadonlyMap<RubricaChave, VersaoRubrica> {
  return new Map(entradas.map(([nome, cs]) => [rubricaChave(nome), versaoRubrica(cs)]));
}

describe("montarGrafo", () => {
  it("grafo linear: b depende de a", () => {
    const a = regra("a");
    const b = regra("b", { consome: { rubricas: [rubricaChave("a")] } });
    const resultado = montarGrafo([a, b], mapaRubricas([["a", []], ["b", []]]));

    expect("erro" in resultado).toBe(false);
    const grafo = resultado as Exclude<typeof resultado, { erro: "ciclo" }>;
    expect(grafo.ordem.indexOf(rubricaChave("a"))).toBeLessThan(grafo.ordem.indexOf(rubricaChave("b")));
  });

  it("diamante: a e b não dependem de nada; c depende de a e b; d depende de c", () => {
    const a = regra("a");
    const b = regra("b");
    const c = regra("c", { consome: { rubricas: [rubricaChave("a"), rubricaChave("b")] } });
    const d = regra("d", { consome: { rubricas: [rubricaChave("c")] } });
    const resultado = montarGrafo([a, b, c, d], mapaRubricas([["a", []], ["b", []], ["c", []], ["d", []]]));

    expect("erro" in resultado).toBe(false);
    const grafo = resultado as Exclude<typeof resultado, { erro: "ciclo" }>;
    const posicao = (r: string) => grafo.ordem.indexOf(rubricaChave(r));
    expect(posicao("a")).toBeLessThan(posicao("c"));
    expect(posicao("b")).toBeLessThan(posicao("c"));
    expect(posicao("c")).toBeLessThan(posicao("d"));
  });

  it("ciclo direto: a depende de b, b depende de a", () => {
    const a = regra("a", { consome: { rubricas: [rubricaChave("b")] } });
    const b = regra("b", { consome: { rubricas: [rubricaChave("a")] } });
    const resultado = montarGrafo([a, b], mapaRubricas([["a", []], ["b", []]]));

    expect("erro" in resultado).toBe(true);
    const erro = resultado as { erro: "ciclo"; caminho: readonly RubricaChave[]; mensagem: string };
    expect(erro.erro).toBe("ciclo");
    expect(erro.caminho).toContain(rubricaChave("a"));
    expect(erro.caminho).toContain(rubricaChave("b"));
  });

  it("ciclo via classificação: A produz rubrica com classificação C; B consome C; A consome a rubrica de B", () => {
    const incidePrevidencia = classificacao("incide_previdencia");
    const a = regra("a", { consome: { rubricas: [rubricaChave("b")] } });
    const b = regra("b", { consome: { classificacoes: [incidePrevidencia] } });
    const resultado = montarGrafo(
      [a, b],
      mapaRubricas([
        ["a", [incidePrevidencia]],
        ["b", []],
      ]),
    );

    expect("erro" in resultado).toBe(true);
    const erro = resultado as { erro: "ciclo"; caminho: readonly RubricaChave[] };
    expect(erro.caminho).toContain(rubricaChave("a"));
    expect(erro.caminho).toContain(rubricaChave("b"));
  });

  it("mensagem de erro de ciclo cita o caminho completo com setas", () => {
    const a = regra("a", { consome: { rubricas: [rubricaChave("b")] } });
    const b = regra("b", { consome: { rubricas: [rubricaChave("c")] } });
    const c = regra("c", { consome: { rubricas: [rubricaChave("a")] } });
    const resultado = montarGrafo([a, b, c], mapaRubricas([["a", []], ["b", []], ["c", []]]));

    expect("erro" in resultado).toBe(true);
    const erro = resultado as { erro: "ciclo"; mensagem: string; caminho: readonly RubricaChave[] };
    expect(erro.mensagem).toContain("→");
    expect(erro.caminho.length).toBeGreaterThanOrEqual(4); // a, b, c, a (fecha o ciclo)
    expect(erro.caminho[0]).toBe(erro.caminho[erro.caminho.length - 1]);
  });

  it("consumo por classificação depende de TODAS as rubricas que carregam a classificação", () => {
    const incidePrevidencia = classificacao("incide_previdencia");
    const salario = regra("salario", { consome: {} });
    const gratificacao = regra("gratificacao", { consome: {} });
    const previdencia = regra("previdencia", { consome: { classificacoes: [incidePrevidencia] } });

    const resultado = montarGrafo(
      [salario, gratificacao, previdencia],
      mapaRubricas([
        ["salario", [incidePrevidencia]],
        ["gratificacao", [incidePrevidencia]],
        ["previdencia", []],
      ]),
    );

    expect("erro" in resultado).toBe(false);
    const grafo = resultado as Exclude<typeof resultado, { erro: "ciclo" }>;
    const posicao = (r: string) => grafo.ordem.indexOf(rubricaChave(r));
    expect(posicao("salario")).toBeLessThan(posicao("previdencia"));
    expect(posicao("gratificacao")).toBeLessThan(posicao("previdencia"));
  });

  it("grafo cujas dependências aparecem depois no array de entrada ainda ordena corretamente (nó já visitado por recursão é pulado no loop externo)", () => {
    const b = regra("b", { consome: { rubricas: [rubricaChave("a")] } });
    const a = regra("a");
    // ordem de entrada [b, a]: "a" só ganha uma chave própria em `dependencias` depois de
    // "b", mas a recursão de "b" já visita e fecha "a" antes do loop externo chegar nele —
    // exercita o "pular nó já visitado" do loop externo de ordenarTopologicamente.
    const resultado = montarGrafo([b, a], mapaRubricas([["a", []], ["b", []]]));

    expect("erro" in resultado).toBe(false);
    const grafo = resultado as Exclude<typeof resultado, { erro: "ciclo" }>;
    expect(grafo.ordem.indexOf(rubricaChave("a"))).toBeLessThan(grafo.ordem.indexOf(rubricaChave("b")));
  });

  it("ignora rubrica produzida sem metadata correspondente ao resolver dependência por classificação", () => {
    const semMetadata = regra("sem_metadata"); // produzida, mas ausente do mapa de rubricas
    const consumidora = regra("consumidora", { consome: { classificacoes: [classificacao("z")] } });

    const resultado = montarGrafo(
      [semMetadata, consumidora],
      mapaRubricas([["consumidora", []]]), // "sem_metadata" propositalmente fora do mapa
    );

    expect("erro" in resultado).toBe(false);
    const grafo = resultado as Exclude<typeof resultado, { erro: "ciclo" }>;
    // sem metadata, não há como saber se "sem_metadata" carrega a classificação "z" —
    // nenhuma dependência é inferida a partir dela.
    expect(grafo.dependencias.get(rubricaChave("consumidora"))).toEqual(new Set());
  });

  it("lança ErroRubricaProduzidaPorMaisDeUmaRegra quando duas regras produzem a mesma rubrica", () => {
    const a1 = regra("a");
    const a2 = { ...regra("a"), regra: "outra_regra" as VersaoRegra["regra"] };
    expect(() => montarGrafo([a1, a2], mapaRubricas([["a", []]]))).toThrow(
      ErroRubricaProduzidaPorMaisDeUmaRegra,
    );
  });
});
