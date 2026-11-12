// index.ts — exports públicos do pacote `motor` (Playbook Módulo 2)

export { ErroRubricaProduzidaPorMaisDeUmaRegra, montarGrafo, type Grafo } from "./grafo/grafo.js";
export { GrafoErroCiclo } from "./grafo/grafo-erro-ciclo.js";

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

export { calcularFolha } from "./calcular-folha/calcular-folha.js";
export { type EntradaCalculoFolha } from "./calcular-folha/entrada-calculo-folha.js";
export { type ResultadoCalculoFolha } from "./calcular-folha/resultado-calculo-folha.js";
export { type NaoAplicavelResultadoCalculoFolha } from "./calcular-folha/nao-aplicavel-resultado-calculo-folha.js";
export { type ErroCalculoFolha } from "./calcular-folha/erro-calculo-folha.js";

export { transitar } from "./ciclo-folha/ciclo-folha.js";
export { ErroTransicaoFolha } from "./ciclo-folha/erro-transicao-folha.js";
