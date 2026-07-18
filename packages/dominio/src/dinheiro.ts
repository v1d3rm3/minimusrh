import { Decimal } from "decimal.js";
import { Percentual } from "./percentual.js";

export type PoliticaArredondamento = 'meio_para_cima' | 'truncar' | 'banqueiro';

export class Dinheiro {

  private constructor(private readonly d: Decimal) { }

  static de(valor: string): Dinheiro { return new Dinheiro(new Decimal(valor)); }
  static deCentavos(c: bigint): Dinheiro { return new Dinheiro(new Decimal(c.toString()).div(100)); }
  static zero(): Dinheiro { return Dinheiro.de('0'); }

  somar(o: Dinheiro): Dinheiro { return new Dinheiro(this.d.plus(o.d)); }
  subtrair(o: Dinheiro): Dinheiro { return new Dinheiro(this.d.minus(o.d)); }
  vezes(p: Percentual): Dinheiro { return new Dinheiro(this.d.mul(p.comoFator())); }
  dividirPor(n: number): Dinheiro { return new Dinheiro(this.d.div(n)); }
  menorEntre(o: Dinheiro): Dinheiro { return this.d.lte(o.d) ? this : o; }
  maiorEntre(o: Dinheiro): Dinheiro { return this.d.gte(o.d) ? this : o; }
  maiorQue(o: Dinheiro): boolean { return this.d.gt(o.d); }
  ehZero(): boolean { return this.d.isZero(); }
  ehNegativo(): boolean { return this.d.isNegative(); }

  /** Arredondamento SEMPRE explícito (§7.7: nada arredonda implicitamente no meio da conta). */
  arredondar(politica: PoliticaArredondamento): Dinheiro {
    const modo = {
      meio_para_cima: Decimal.ROUND_HALF_UP,
      truncar: Decimal.ROUND_DOWN,
      banqueiro: Decimal.ROUND_HALF_EVEN
    }[politica];
    return new Dinheiro(this.d.toDecimalPlaces(2, modo));
  }

  /** Serialização canônica: string com 2+ casas. Para o NUMERIC do Postgres, sem passar por number. */
  paraString(): string { return this.d.toFixed(2); }

}