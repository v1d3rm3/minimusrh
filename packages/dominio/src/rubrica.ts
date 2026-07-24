import { DataEfeito, DataRegistro } from "./competencia.js";
import { PoliticaArredondamento } from "./dinheiro.js";
import { Classificacao, RubricaChave } from "./tipos.js";
import { ComVigencia } from "./vigencia.js";

export type NaturezaRubrica = 'vantagem' | 'desconto' | 'informativa';

export interface VersaoRubrica extends ComVigencia {
  readonly versao: number;
  readonly dataEfeito: DataEfeito;
  readonly dataRegistro: DataRegistro;   // publicação (§1.4)
  readonly nome: string;
  readonly natureza: NaturezaRubrica;
  readonly classificacoes: ReadonlySet<Classificacao>;   // 'incide_previdencia', 'compoe_terco'...
  readonly arredondamento: PoliticaArredondamento;       // aplicada PELO MOTOR ao resultado (§7.7)
  readonly proporcionalizavel: boolean;                  // sofre fator de dias (§3.6)
}

export interface Rubrica {
  readonly chave: RubricaChave;
  readonly versoes: readonly VersaoRubrica[];
}