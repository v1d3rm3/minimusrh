import type { VersaoRegra } from "@minimusrh/dominio";

// Catálogos
export {
  CATALOGO_TIPOS_DE_FATO,
  TIPO_FATO_COMPROVACAO_PLANO_SAUDE,
  TIPO_FATO_EXONERACAO,
  TIPO_FATO_NASCIMENTO,
  TIPO_FATO_POSSE,
  TIPO_FATO_PROMOCAO,
  criarCatalogoTiposDeFato,
} from "./catalogo-tipos-fato.js";
export {
  CATALOGO_RUBRICAS,
  CLASSIFICACAO_COMPOE_TETO,
  CLASSIFICACAO_INCIDE_PREVIDENCIA,
  RUBRICA_AUXILIO_SAUDE,
  RUBRICA_CONTRIBUICAO_PREVIDENCIA,
  RUBRICA_SALARIO_BASE,
  criarCatalogoRubricas,
} from "./catalogo-rubricas.js";
export {
  CATALOGO_TIPOS_DE_FOLHA,
  TIPO_FOLHA_MENSAL,
  criarCatalogoTiposDeFolha,
  type CatalogoTiposDeFolha,
  type TipoFolha,
} from "./catalogo-tipos-folha.js";
export { CATALOGO_AMPAROS, TIPO_AMPARO_PROCESSO, criarCatalogoAmparos } from "./catalogo-amparos.js";

// Utilitário de tabela progressiva
export { aplicarTabelaProgressiva, type FaixaProgressiva } from "./tabela-progressiva.js";

// Derivações
export { DERIVACAO_CARGO, DERIVACAO_CARGO_IMPL } from "./derivacao-cargo.js";
export { DERIVACAO_DIAS_TRABALHADOS, DERIVACAO_DIAS_TRABALHADOS_IMPL, type DiasTrabalhados } from "./derivacao-dias-trabalhados.js";
export { DERIVACAO_IDADE, DERIVACAO_IDADE_IMPL } from "./derivacao-idade.js";
export {
  DERIVACAO_PERIODOS_CARGO,
  DERIVACAO_PERIODOS_CARGO_IMPL,
  type PeriodoCargo,
  type PeriodosCargo,
} from "./derivacao-periodos-cargo.js";
export {
  DERIVACAO_SITUACAO_FUNCIONAL,
  DERIVACAO_SITUACAO_FUNCIONAL_IMPL,
  type SituacaoFuncional,
} from "./derivacao-situacao-funcional.js";
export { CATALOGO_CHAVES_DERIVACAO, criarRegistroDeDerivacoes } from "./registro-derivacoes.js";

// Regras
export { REGRA_AUXILIO_SAUDE, REGRA_AUXILIO_SAUDE_V1 } from "./regra-auxilio-saude.js";
export { REGRA_CONTRIBUICAO_PREVIDENCIA, REGRA_CONTRIBUICAO_PREVIDENCIA_V1 } from "./regra-contribuicao-previdencia.js";
export { REGRA_SALARIO_BASE, REGRA_SALARIO_BASE_V1, REGRA_SALARIO_BASE_V2 } from "./regra-salario-base.js";

// Suporte genérico de LinhaDoTempo em memória (reutilizável por qualquer fixture, não só Victor)
export { linhaDoTempoEmMemoria } from "./linha-do-tempo-em-memoria.js";

// Fixture Victor — cenário de referência reutilizável pelos módulos 5-6 (ver DECISOES #11)
export {
  VICTOR_FATO_NASCIMENTO,
  VICTOR_FATO_POSSE,
  VICTOR_FATO_PROMOCAO,
  VICTOR_FATOS,
  VICTOR_HISTORIA_ID,
  VICTOR_PESSOA_ID,
  criarLinhaDoTempoVictor,
} from "./fixture-victor.js";

import { REGRA_AUXILIO_SAUDE_V1 } from "./regra-auxilio-saude.js";
import { REGRA_CONTRIBUICAO_PREVIDENCIA_V1 } from "./regra-contribuicao-previdencia.js";
import { REGRA_SALARIO_BASE_V1, REGRA_SALARIO_BASE_V2 } from "./regra-salario-base.js";

// Array plano pronto para packages/motor::resolverParaExecucao (o dominio não define um
// container "Regra{chave,versoes}" — motor já consome VersaoRegra[] diretamente).
export const CATALOGO_REGRAS: readonly VersaoRegra[] = [REGRA_SALARIO_BASE_V1, REGRA_SALARIO_BASE_V2, REGRA_AUXILIO_SAUDE_V1, REGRA_CONTRIBUICAO_PREVIDENCIA_V1];
