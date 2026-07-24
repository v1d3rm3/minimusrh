import { Dinheiro } from "./dinheiro.js";
import { DerivacaoChave, FatoId, FolhaId, HistoriaId, RegraChave, RubricaChave } from "./tipos.js";

// registro-calculo.ts — explicação e proveniência do cálculo (§3.11)
export type FonteExplicacao =
  | { readonly tipo: 'fato';      readonly fatoId: FatoId }
  | { readonly tipo: 'derivacao'; readonly chave: DerivacaoChave; readonly valor: string }
  | { readonly tipo: 'rubrica';   readonly chave: RubricaChave;   readonly valor: string }
  | { readonly tipo: 'tabela';    readonly chave: string;         readonly versao: number }
  | { readonly tipo: 'no';        readonly no: NoExplicacao };    // recursão: a árvore

export interface NoExplicacao {
  readonly descricao: string;                        // "base = soma das rubricas 'incide_previdencia'"
  readonly valor?: string;                           // Dinheiro.paraString()
  readonly fontes: readonly FonteExplicacao[];
}

export interface RegistroCalculo {
  readonly folhaId: FolhaId;
  readonly historiaId: HistoriaId;
  readonly rubrica: RubricaChave;
  readonly versaoRubrica: number;
  readonly regra: RegraChave;
  readonly versaoRegra: number;
  readonly valor: Dinheiro;                          // já com a política de arredondamento aplicada
  readonly explicacao: NoExplicacao;                 // "provar como chegou nesse número"
}
