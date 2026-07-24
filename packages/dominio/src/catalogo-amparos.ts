import { DataEfeito, DataRegistro } from "./competencia.js";
import { Brand } from "./tipos.js"; 
import { ComVigencia } from "./vigencia.js";

export type TipoAmparoChave = Brand<string, 'TipoAmparoChave'>; 

export type TipoGrupo = 'numero' | 'ano' | 'texto';
// ^ vocabulário FECHADO de canonicalizações — cresce por versão do SISTEMA, nunca por
//   instituição (mesmo estatuto do catálogo de funções da DSL, §7.8 do conceitual).
//   numero => sem zeros à esquerda; ano => exige 4 dígitos; texto => trim + caixa alta.

export interface GrupoMascara {
  readonly nome: string;        // 'numero', 'ano'
  readonly tipo: TipoGrupo;
}

export interface VersaoTipoAmparo extends ComVigencia {
  readonly versao: number;
  readonly dataEfeito: DataEfeito;
  readonly dataRegistro: DataRegistro;   // publicação (§1.4)
  readonly mascara: string;                  // FONTE da regex (string — RegExp não serializa)
  readonly grupos: readonly GrupoMascara[];  // na ordem dos grupos de captura da máscara
  readonly formatoCanonico: string;          // template sobre os grupos: '{numero}/{ano}'
  readonly exemplo: string;                  // '123/2026' — mensagens de erro e placeholder de tela
}

export interface TipoAmparo {
  readonly chave: TipoAmparoChave;
  readonly versoes: readonly VersaoTipoAmparo[];
}