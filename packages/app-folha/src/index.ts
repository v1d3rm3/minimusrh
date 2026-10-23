// index.ts — exports públicos do pacote `app-folha` (Playbook Módulos 5 e 6)

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

export { fatosCitados, renderizarContracheque, renderizarExplicacao, renderizarExtrato, type OpcoesExtrato } from "./extrato.js";

export { serializarRegistros } from "./serializacao.js";

export {
  criarApuradorDeDiferencas,
  diferencasEntre,
  ErroApuracaoComErros,
  ErroReprodutibilidadeViolada,
  type ApuracaoCompetencia,
  type ApuradorDeDiferencas,
  type DiferencaApurada,
} from "./apurar-diferencas.js";

export { folhasAlcancadas, listarFolhasFechadas, type FolhaFechada, type Novidade } from "./alcance-retroativo.js";
