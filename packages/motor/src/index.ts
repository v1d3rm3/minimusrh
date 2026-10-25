// index.ts — exports públicos do pacote `motor` (Playbook Módulo 2)

export { ErroRubricaProduzidaPorMaisDeUmaRegra, montarGrafo, type ErroCiclo, type Grafo } from "./grafo.js";

export { ResolucaoTemporal } from './resolucao/resolucao-temporal.js';
export { resolverParaExecucao } from "./resolucao/resolucao.js";
export { RubricaNaoResolvidaErro } from "./resolucao/rubrica-nao-resolvida-erro.js";

export {
  criarContexto,
  type LeitorDeJanelas,
  type ObservadorDeLeituras,
  type ParametrosContexto,
  type ParcelaClassificacao,
  type ProvenienciaDerivacao
} from "./contexto-impl.js";

export {
  instrumentar, type ContextoInstrumentado, type Leitura,
  type LeituraDerivacao,
  type LeituraRubrica, type Violacao
} from "./contexto-instrumentado.js";

export {
  calcularFolha, type EntradaCalculoFolha, type ErroCalculoFolha, type NaoAplicavel, type ResultadoCalculo
} from "./calcular-folha.js";

export { transitar, type ErroTransicao } from "./ciclo-folha.js";
