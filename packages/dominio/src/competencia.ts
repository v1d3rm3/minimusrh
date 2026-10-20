import { Brand } from "./tipos.js";

// tempo.ts
export type DataEfeito = Brand<string, 'DataEfeito'>;    // 'YYYY-MM-DD' — quando passa a valer
export type DataRegistro = Brand<string, 'DataRegistro'>;  // ISO timestamp — quando se soube

const MESES_31_DIAS = new Set([1, 3, 5, 7, 8, 10, 12]);

function ehBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

function diasNoMes(ano: number, mes: number): number {
  if (mes === 2) return ehBissexto(ano) ? 29 : 28;
  return MESES_31_DIAS.has(mes) ? 31 : 30;
}

const FORMATO_DATA_EFEITO = /^(\d{4})-(\d{2})-(\d{2})$/;
const FORMATO_DATA_REGISTRO = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-](\d{2}):(\d{2}))$/;

/** Porta única de construção de DataEfeito: 'YYYY-MM-DD', validada contra o calendário real. */
export function dataEfeito(iso: string): DataEfeito {
  const m = FORMATO_DATA_EFEITO.exec(iso);
  if (!m) throw new Error(`dataEfeito inválida (esperado 'YYYY-MM-DD'): '${iso}'`);
  // os 3 grupos são obrigatórios (sem '?') e sempre capturam quando m existe — não-nulo por construção.
  const ano = parseInt(m[1]!, 10);
  const mes = parseInt(m[2]!, 10);
  const dia = parseInt(m[3]!, 10);
  if (mes < 1 || mes > 12) throw new Error(`dataEfeito inválida (mês fora do intervalo 1–12): '${iso}'`);
  if (dia < 1 || dia > diasNoMes(ano, mes)) throw new Error(`dataEfeito inválida (dia fora do intervalo do mês): '${iso}'`);
  return iso as DataEfeito;
}

/**
 * Porta única de construção de DataRegistro: aceita timestamp ISO 8601
 * ('YYYY-MM-DDTHH:mm:ss[.sss](Z|±HH:mm)') e devolve SEMPRE a forma canônica
 * 'YYYY-MM-DDTHH:mm:ss.sssZ' (UTC, milissegundos), a mesma que o Postgres devolve.
 * DataRegistro é comparada como TEXTO (versaoVigente, corte), então o mesmo instante tem
 * de ter uma única grafia: "…00Z" > "…00.000Z" lexicograficamente (DECISOES #11).
 */
export function dataRegistro(iso: string): DataRegistro {
  const m = FORMATO_DATA_REGISTRO.exec(iso);
  if (!m) throw new Error(`dataRegistro inválida (esperado timestamp ISO 8601): '${iso}'`);
  // o parser do JS "rola" campos fora do intervalo (30/02 vira 02/03, 24:00 vira o dia
  // seguinte) — calendário e relógio são validados aqui, antes de qualquer conversão.
  try {
    dataEfeito(m[1]!);
  } catch {
    throw new Error(`dataRegistro inválida (data fora do calendário): '${iso}'`);
  }
  const [hora, minuto, segundo] = [m[2]!, m[3]!, m[4]!].map((g) => parseInt(g, 10)) as [number, number, number];
  if (hora > 23 || minuto > 59 || segundo > 59) {
    throw new Error(`dataRegistro inválida (horário fora do intervalo): '${iso}'`);
  }
  if (m[7] !== undefined && (parseInt(m[7], 10) > 23 || parseInt(m[8]!, 10) > 59)) {
    throw new Error(`dataRegistro inválida (fuso fora do intervalo): '${iso}'`);
  }
  // abaixo do milissegundo o instante não é representável (nem pelo Date do JS, nem pelo
  // mapeamento da persistência): truncar mudaria o instante calado, então recusa.
  if (m[5] !== undefined && m[5].length > 3) {
    throw new Error(`dataRegistro inválida (precisão abaixo de milissegundo): '${iso}'`);
  }
  return new Date(iso).toISOString() as DataRegistro;
}

export class Competencia {
  private constructor(readonly ano: number, readonly mes: number) { }

  static de(ano: number, mes: number): Competencia {
    if (!Number.isInteger(ano) || ano <= 0) throw new Error(`ano inválido: ${ano}`);
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw new Error(`mes inválido: ${mes}`);
    return new Competencia(ano, mes);
  }

  anterior(): Competencia {
    return this.mes === 1
      ? Competencia.de(this.ano - 1, 12)
      : Competencia.de(this.ano, this.mes - 1);
  }

  /** janela p/ agregações, §5.4: as n competências mais recentes, da mais antiga pra mais nova, incluindo this. */
  ultimas(n: number): Competencia[] {
    if (!Number.isInteger(n) || n <= 0) throw new Error(`n inválido: ${n}`);
    const resultado: Competencia[] = [];
    let atual: Competencia = this;
    for (let i = 0; i < n; i++) {
      resultado.push(atual);
      atual = atual.anterior();
    }
    return resultado.reverse();
  }

  /** Data de referência do cálculo: último dia do mês (convenção; configurável no futuro). */
  dataReferencia(): DataEfeito {
    const dia = diasNoMes(this.ano, this.mes);
    const ano = String(this.ano).padStart(4, '0');
    const mes = String(this.mes).padStart(2, '0');
    return `${ano}-${mes}-${String(dia).padStart(2, '0')}` as DataEfeito;
  }

  contem(d: DataEfeito): boolean {
    return d.startsWith(`${this.toString()}-`);
  }

  toString(): string {
    return `${String(this.ano).padStart(4, '0')}-${String(this.mes).padStart(2, '0')}`;
  }

  igual(o: Competencia): boolean {
    return this.ano === o.ano && this.mes === o.mes;
  }
}
