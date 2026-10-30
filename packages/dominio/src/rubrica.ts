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
  /**
   * Classificação é um mecanismo de agrupamento desacoplado de rubricas. Se não houvesse a ideia
   * de classificação, seria necessário criar um rubrica que consumisse todas as rubricas que fossem necessárias
   * para o cálculo. Com o conceito de Classificação, basta declarar quais rubricas pertencem a uma classificação,
   * e assim, fica mais fácil de utilizar rubricas com "determinada classificação" em uma regra.
   * 
   * Outra forma de descrever uma Classificação é que ela é um rótulo semântico, permitindo manipular grupo de regras
   * através desse rótulo.
   * 
   * Exemplo: a classificação "incide_previdencia" é utilizada para identificar todas as rubricas que incidem sobre a previdência, 
   * e assim, uma regra que precise calcular o valor da previdência pode simplesmente consumir a classificação 
   * "incide_previdencia" ao invés de consumir cada rubrica individualmente.
   */
  readonly classificacoes: ReadonlySet<Classificacao>;
  readonly arredondamento: PoliticaArredondamento;       // aplicada PELO MOTOR ao resultado (§7.7)
  readonly proporcionalizavel: boolean;                  // sofre fator de dias (§3.6)
}

export interface Rubrica {
  readonly chave: RubricaChave;
  readonly versoes: readonly VersaoRubrica[];
}