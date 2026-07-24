import { Amparo } from "./amparo.js";
import { DataEfeito, DataRegistro } from "./competencia.js";
import { PessoaId, HistoriaId, FatoId, TipoFatoChave } from "./tipos.js";

// fato.ts
export type AlvoFato =
  | { readonly escopo: 'pessoa';   readonly pessoaId: PessoaId }
  | { readonly escopo: 'historia'; readonly historiaId: HistoriaId };

export type Autor =
  | { readonly tipo: 'humano';     readonly usuarioId: string }
  | { readonly tipo: 'sistema';    readonly regraConsistencia: string;
      readonly versao: number;     readonly gatilhos: readonly FatoId[] }   // §8.2
  | { readonly tipo: 'importacao'; readonly lote: string };                 // Marco 3 do Roteiro

export interface Fato<C = unknown> {
  readonly id: FatoId;
  readonly alvo: AlvoFato;
  readonly tipo: TipoFatoChave;
  readonly versaoDoTipo: number;        // sob qual versão do catálogo nasceu (§3.4)
  readonly conteudo: C;                 // validado contra o schema da versão do tipo
  readonly dataEfeito: DataEfeito;
  readonly dataRegistro: DataRegistro;
  readonly autor: Autor;
  readonly amparo?: Amparo;
  readonly substituiFatoId?: FatoId;    // correção referencia o corrigido; nada se edita
}