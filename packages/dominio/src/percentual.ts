import { Decimal } from "decimal.js";

export class Percentual {
  private constructor(private readonly d: Decimal) { }
  /** Percentual.de('15') === 15% */
  static de(valor: string): Percentual { return new Percentual(new Decimal(valor)); }
  comoFator(): Decimal { return this.d.div(100); }
}