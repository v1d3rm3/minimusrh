import type { Classificacao, RubricaChave, VersaoRegra, VersaoRubrica } from "@minimusrh/dominio";

// grafo.ts (Design §11 decisão? não — playbook Módulo 2): "as dependências são entre
// rubricas, não entre regras" (Fundacao §5.1). Nó = rubrica PRODUZIDA por uma regra
// resolvida; aresta A→B ("A depende de B") quando a DeclaracaoConsumo de A referencia
// a rubrica de B diretamente OU uma classificação que a rubrica de B carrega.
export interface Grafo {
  readonly ordem: readonly RubricaChave[]; // ordem topológica: dependências primeiro
  readonly dependencias: ReadonlyMap<RubricaChave, ReadonlySet<RubricaChave>>;
  readonly regraPorRubrica: ReadonlyMap<RubricaChave, VersaoRegra>;
}

export interface ErroCiclo {
  readonly erro: "ciclo";
  readonly caminho: readonly RubricaChave[]; // ex.: [a, b, c, a] — cita o ciclo completo
  readonly mensagem: string;
}

/**
 * Duas regras diferentes produzindo a mesma rubrica não é ciclo, nem está contemplado
 * pelo union `Grafo | ErroCiclo` do playbook — é erro de CONFIGURAÇÃO (publicação de
 * regra ambígua), não de execução. Decisão registrada em DECISOES-IMPLEMENTACAO.md:
 * lançar exceção em vez de devolver um terceiro caso no union.
 */
export class ErroRubricaProduzidaPorMaisDeUmaRegra extends Error {
  constructor(
    readonly rubrica: RubricaChave,
    readonly regras: readonly VersaoRegra[],
  ) {
    super(
      `rubrica '${rubrica}' é produzida por mais de uma regra resolvida: ${regras
        .map((r) => `${r.regra} v${r.versao}`)
        .join(", ")}`,
    );
  }
}

function construirRegraPorRubrica(
  regras: readonly VersaoRegra[],
): ReadonlyMap<RubricaChave, VersaoRegra> {
  const mapa = new Map<RubricaChave, VersaoRegra>();
  const duplicadas = new Map<RubricaChave, VersaoRegra[]>();

  for (const regra of regras) {
    const existente = mapa.get(regra.produz);
    if (existente === undefined) {
      mapa.set(regra.produz, regra);
      continue;
    }
    const grupo = duplicadas.get(regra.produz) ?? [existente];
    grupo.push(regra);
    duplicadas.set(regra.produz, grupo);
  }

  const primeiraDuplicada = duplicadas.entries().next();
  if (!primeiraDuplicada.done) {
    const [rubrica, grupo] = primeiraDuplicada.value;
    throw new ErroRubricaProduzidaPorMaisDeUmaRegra(rubrica, grupo);
  }

  return mapa;
}

function dependenciasDe(
  regra: VersaoRegra,
  regraPorRubrica: ReadonlyMap<RubricaChave, VersaoRegra>,
  rubricas: ReadonlyMap<RubricaChave, VersaoRubrica>,
): ReadonlySet<RubricaChave> {
  const deps = new Set<RubricaChave>();

  for (const rubricaConsumida of regra.consome.rubricas) {
    if (regraPorRubrica.has(rubricaConsumida)) deps.add(rubricaConsumida);
  }

  if (regra.consome.classificacoes.length > 0) {
    const classificacoesConsumidas = new Set<Classificacao>(regra.consome.classificacoes);
    for (const [rubricaChave, produtora] of regraPorRubrica) {
      if (rubricaChave === regra.produz) continue; // uma regra não depende de si mesma
      const versaoRubrica = rubricas.get(rubricaChave);
      if (versaoRubrica === undefined) continue;
      const temClassificacaoConsumida = [...versaoRubrica.classificacoes].some((c) =>
        classificacoesConsumidas.has(c),
      );
      if (temClassificacaoConsumida) deps.add(produtora.produz);
    }
  }

  return deps;
}

/**
 * Monta o grafo de dependências entre rubricas e devolve a ordem topológica de execução,
 * ou um ErroCiclo com o caminho completo. Playbook dá a assinatura `montarGrafo(regras)`
 * sem `rubricas` — mas resolver arestas por CLASSIFICAÇÃO exige saber quais classificações
 * cada rubrica carrega, então a assinatura foi estendida (DECISOES-IMPLEMENTACAO.md).
 */
export function montarGrafo(
  regras: readonly VersaoRegra[],
  rubricas: ReadonlyMap<RubricaChave, VersaoRubrica>,
): Grafo | ErroCiclo {
  const regraPorRubrica = construirRegraPorRubrica(regras);
  const dependencias = new Map<RubricaChave, ReadonlySet<RubricaChave>>();
  for (const regra of regras) {
    dependencias.set(regra.produz, dependenciasDe(regra, regraPorRubrica, rubricas));
  }

  const ordenado = ordenarTopologicamente(dependencias);
  if ("erro" in ordenado) return ordenado;

  return { ordem: ordenado.ordem, dependencias, regraPorRubrica };
}

type Cor = "branco" | "cinza" | "preto";

/** DFS clássica com detecção de ciclo por cor (branco/cinza/preto) — caminho completo reconstruído da pilha. */
function ordenarTopologicamente(
  dependencias: ReadonlyMap<RubricaChave, ReadonlySet<RubricaChave>>,
): { readonly ordem: readonly RubricaChave[] } | ErroCiclo {
  const cores = new Map<RubricaChave, Cor>();
  const pilha: RubricaChave[] = [];
  const ordem: RubricaChave[] = [];

  function visitar(no: RubricaChave): ErroCiclo | undefined {
    cores.set(no, "cinza");
    pilha.push(no);

    // `no` é sempre uma chave de `dependencias`: ou veio de `dependencias.keys()` (loop
    // externo), ou foi alcançado por recursão a partir de uma dependência (que só entra em
    // `dependenciasDe` quando `regraPorRubrica.has(...)`, ou seja, é produzida por alguma
    // regra e por isso tem entrada própria em `dependencias`). Não-nulo por construção.
    for (const dependencia of dependencias.get(no)!) {
      const cor = cores.get(dependencia) ?? "branco";
      if (cor === "cinza") {
        const inicioCiclo = pilha.indexOf(dependencia);
        const caminho = [...pilha.slice(inicioCiclo), dependencia];
        return {
          erro: "ciclo",
          caminho,
          mensagem: `ciclo de dependências entre rubricas: ${caminho.join(" → ")}`,
        };
      }
      if (cor === "branco") {
        const erro = visitar(dependencia);
        if (erro) return erro;
      }
    }

    pilha.pop();
    cores.set(no, "preto");
    ordem.push(no);
    return undefined;
  }

  for (const no of dependencias.keys()) {
    if ((cores.get(no) ?? "branco") !== "branco") continue;
    const erro = visitar(no);
    if (erro) return erro;
  }

  return { ordem };
}
