import type { DataEfeito } from "@minimusrh/dominio";

// data-util.ts — aritmética de calendário sobre DataEfeito ('YYYY-MM-DD'), sem `new
// Date()` (Regra Global #2): as derivações de calendário (idade, dias_trabalhados)
// precisam comparar ano/mês/dia como números, não como objeto de data.
export interface PartesData {
  readonly ano: number;
  readonly mes: number;
  readonly dia: number;
}

const FORMATO_DATA_EFEITO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function partesDataEfeito(data: DataEfeito): PartesData {
  const m = FORMATO_DATA_EFEITO.exec(data);
  // seguro por construção: um DataEfeito só existe validado pela fábrica dataEfeito() do dominio.
  const [, ano, mes, dia] = m!;
  return { ano: parseInt(ano!, 10), mes: parseInt(mes!, 10), dia: parseInt(dia!, 10) };
}
