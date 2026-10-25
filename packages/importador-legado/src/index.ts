// index.ts — exports públicos do pacote `importador-legado` (Playbook Módulo 7)

// Contrato da fonte e fonte CSV de referência
export type {
  CamposCrus,
  FonteLegado,
  OrigemRegistro,
  RegistroContracheque,
  RegistroEvento,
  RegistroIlegivel,
  RegistroLegado,
  RegistroServidor,
  RegistroVinculo,
  TipoRegistro,
} from "./registros.js";
export { ARQUIVOS_CSV, ErroFonte, PREFIXO_CAMPO, fonteCsv, registrosDoArquivo } from "./fonte-csv.js";
export { ErroCsv, SEPARADOR_CSV, lerCsv, type LinhaCsv } from "./csv.js";

// Configuração, convenções e identidade
export {
  ErroConfiguracao,
  configuracaoAlrn,
  validarConfiguracao,
  type ConfiguracaoImportacao,
  type TiposDoEstadoLegado,
} from "./configuracao.js";
export { CONVENCAO_REGISTRO_DESCONHECIDO, FORMATO_LOTE, autorDoLote } from "./convencoes.js";
export { NAMESPACE_LEGADO, historiaIdDoVinculo, pessoaIdDoServidor, uuidV5 } from "./identidade.js";

// Tradução, destino e pipeline
export {
  assinaturaDoFato,
  ehRejeicao,
  escolherVersaoDoTipo,
  traduzir,
  type ContextoTraducao,
  type FatoTraduzido,
  type IdentidadeServidor,
  type IdentidadeVinculo,
  type LinhaGabarito,
  type Rejeicao,
  type UnidadeImportacao,
} from "./tradutores.js";
export type { DestinoImportacao, ResultadoGravacao } from "./destino.js";
export { destinoPg } from "./destino-pg.js";
export { listarVinculosImportados, type VinculoImportado } from "./vinculos-importados.js";
export { ErroImportacao, importar, type OpcoesImportacao } from "./importar.js";
export { TAMANHO_AMOSTRA, renderizarRelatorio, type RelatorioImportacao } from "./relatorio.js";

// CLI
export { FONTES, SAIDA, USO, executarCli, lerArgumentos, type Argumentos, type DependenciasCli } from "./cli.js";
