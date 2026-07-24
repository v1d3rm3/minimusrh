import { DataEfeito, DataRegistro } from "./competencia.js";
import { TipoFatoChave } from "./tipos.js";
import { ComVigencia } from "./vigencia.js";

// catalogo-fatos.ts
export type TipoCampo = 'texto' | 'dinheiro' | 'percentual' | 'numero' | 'data' | 'logico';

export interface CampoSchema {
  readonly nome: string;
  readonly tipo: TipoCampo;
  readonly obrigatorio: boolean;
  readonly depreciado?: boolean;        // §9.2: campos nunca somem, depreciam
}

export interface VersaoTipoFato extends ComVigencia {
  readonly versao: number;
  readonly dataEfeito: DataEfeito;
  readonly dataRegistro: DataRegistro;   // publicação — o corte filtra por isto (§1.4)
  readonly schema: readonly CampoSchema[];
  readonly exigeAmparo: boolean;
}

export interface TipoFato {
  readonly chave: TipoFatoChave;
  readonly alvo: 'pessoa' | 'historia';
  readonly abreHistoria?: boolean;      // posse/admissão (§3.2)
  readonly encerraHistoria?: boolean;   // exoneração/aposentadoria
  readonly versoes: readonly VersaoTipoFato[];
}