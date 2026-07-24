// index.ts — exports públicos do pacote `motor` (Playbook Módulo 2)

export { montarGrafo, ErroRubricaProduzidaPorMaisDeUmaRegra, type Grafo, type ErroCiclo } from "./grafo.js";

export { resolverParaExecucao, ErroRubricaNaoResolvida, type ResolucaoTemporal } from "./resolucao.js";

export { criarContexto, type LeitorDeJanelas, type ParametrosContexto } from "./contexto-impl.js";

export {
  instrumentar,
  type Violacao,
  type Leitura,
  type LeituraDerivacao,
  type LeituraRubrica,
  type ContextoInstrumentado,
} from "./contexto-instrumentado.js";

export {
  calcularFolha,
  type NaoAplicavel,
  type ErroCalculoFolha,
  type ResultadoCalculo,
  type EntradaCalculoFolha,
} from "./calcular-folha.js";

export { transitar, type ErroTransicao } from "./ciclo-folha.js";
