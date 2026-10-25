// index.ts — exports públicos do pacote `persistencia`

export type { ConexaoBanco, ExecutorSql } from "./pool.js";
export { criarPool, withTransacao } from "./pool.js";

export { DIRETORIO_MIGRACOES, rodarMigracaoBootstrap, rodarMigracaoSchema } from "./migrar.js";

export type { DadosParaValidar } from "./validacao-conteudo.js";
export { validarConteudo } from "./validacao-conteudo.js";

export type { FatoRepositorio, NovoFato } from "./fato-repositorio.js";
export { ErroRegistroFato, fatoRepositorioPg } from "./fato-repositorio.js";

export { linhaDoTempoPg } from "./linha-do-tempo-pg.js";

export type { FolhaRepositorio, NovaFolha } from "./folha-repositorio.js";
export { ErroTransicaoConcorrente, folhaRepositorioPg } from "./folha-repositorio.js";

export type { LinhaRegistroCalculo } from "./mapeamento-registro-calculo.js";
export { linhaParaRegistroCalculo, SELECT_REGISTRO_CALCULO } from "./mapeamento-registro-calculo.js";
