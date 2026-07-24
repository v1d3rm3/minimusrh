// index.ts — exports públicos do pacote `dominio` (MinimusRH_Design_Dominio.md §1–§9)

// §1.1 — identificadores branded
export type {
  Brand,
  PessoaId,
  HistoriaId,
  FatoId,
  FolhaId,
  TipoFatoChave,
  RubricaChave,
  Classificacao,
  TipoFolhaChave,
  DerivacaoChave,
  RegraChave,
  ErroValidacao,
} from "./tipos.js";

// §1.2 — dinheiro
export { Dinheiro, type PoliticaArredondamento } from "./dinheiro.js";
export { Percentual } from "./percentual.js";

// §1.3 — tempo: efeito, registro, competência
export { Competencia, dataEfeito, dataRegistro, type DataEfeito, type DataRegistro } from "./competencia.js";

// §1.4 — vigência e catálogos (contratos de leitura)
export { versaoVigente, type ComVigencia } from "./vigencia.js";
export {
  type Catalogo,
  type CatalogoTiposDeFato,
  type CatalogoRubricas,
  type CatalogoAmparos,
} from "./catalogo.js";

// §2 — o fato e sua anatomia
export type { AlvoFato, Autor, Fato } from "./fato.js";

// §2.1 — amparo: sexto catálogo, interpretador e classe
export type {
  TipoAmparoChave,
  TipoGrupo,
  GrupoMascara,
  VersaoTipoAmparo,
  TipoAmparo,
} from "./catalogo-amparos.js";
export { normalizarAmparo } from "./normalizacao-amparo.js";
export { Amparo } from "./amparo.js";

// §3 — catálogo de tipos de fato
export type { TipoCampo, CampoSchema, VersaoTipoFato, TipoFato } from "./catalogo-fatos.js";

// §4 — linha do tempo e derivações
export type { LinhaDoTempo } from "./linha-do-tempo.js";
export type { VersaoDerivacao, Derivacao, RegistroDeDerivacoes } from "./derivacao.js";

// §5 — rubrica
export type { NaturezaRubrica, VersaoRubrica, Rubrica } from "./rubrica.js";

// §6 — contexto: as quatro leituras
export type { ConsultaJanela, Contexto } from "./contexto.js";

// §7 — regra
export type { DeclaracaoConsumo, EscopoRegra, VersaoRegra } from "./regra.js";

// §8 — folha e ciclo de vida
export { TRANSICOES, type EstadoFolha, type Folha, type TransicaoFolha } from "./folha.js";

// §9 — registro de cálculo e explicação
export type { FonteExplicacao, NoExplicacao, RegistroCalculo } from "./registro-calculo.js";
