// index.ts — exports públicos do pacote `app-folha` (Playbook Módulo 5)

export {
  agruparRegras,
  cadastroEmMemoria,
  configuracaoAlrn,
  type AlvoHistoria,
  type CadastroDeHistorias,
  type ConfiguracaoInstituicao,
} from "./configuracao.js";

export {
  canonizarInstante,
  criarServicoFolha,
  ErroFechamentoComErros,
  ErroServicoFolha,
  type DependenciasServicoFolha,
  type ResultadoFechamento,
  type ResultadoSimulacao,
  type ServicoFolha,
} from "./servico-folha.js";

export {
  carregarLeitorDeJanelasPg,
  competenciasDaJanela,
  type LeitorDeJanelasCarregado,
  type ParametrosLeitorJanelas,
} from "./leitor-janelas-pg.js";

export { fatosCitados, renderizarContracheque, renderizarExtrato, type OpcoesExtrato } from "./extrato.js";

export { serializarRegistros } from "./serializacao.js";
