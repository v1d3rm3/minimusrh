// csv.ts — leitor de CSV mínimo para o layout de referência (docs/layout-importacao.md):
// separador `;`, aspas duplas para células com `;`, aspas ou quebra de linha (aspas dentro de
// aspas dobradas), UTF-8 com ou sem BOM, fim de linha LF ou CRLF. Sem dependência externa: o
// layout é nosso e pequeno (DECISOES #9).

export interface LinhaCsv {
  /** Linha física onde o registro começa (1 = primeira linha do arquivo). */
  readonly numero: number;
  readonly celulas: readonly string[];
}

export class ErroCsv extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroCsv";
  }
}

export const SEPARADOR_CSV = ";";

/** Linhas totalmente vazias são ignoradas (não são registros). */
export function lerCsv(texto: string): readonly LinhaCsv[] {
  const fonte = texto.startsWith("﻿") ? texto.slice(1) : texto;
  const linhas: LinhaCsv[] = [];

  let celulas: string[] = [];
  let celula = "";
  let entreAspas = false;
  let linhaFisica = 1;
  let inicioDoRegistro = 1;

  const fecharRegistro = (): void => {
    celulas.push(celula);
    const vazio = celulas.length === 1 && celulas[0] === "";
    if (!vazio) linhas.push({ numero: inicioDoRegistro, celulas });
    celulas = [];
    celula = "";
  };

  for (let i = 0; i < fonte.length; i++) {
    const c = fonte[i];
    if (entreAspas) {
      if (c === '"' && fonte[i + 1] === '"') {
        celula += '"';
        i++;
      } else if (c === '"') {
        entreAspas = false;
      } else {
        if (c === "\n") linhaFisica++;
        celula += c;
      }
      continue;
    }
    if (c === '"' && celula === "") {
      entreAspas = true;
    } else if (c === SEPARADOR_CSV) {
      celulas.push(celula);
      celula = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && fonte[i + 1] === "\n") i++;
      fecharRegistro();
      linhaFisica++;
      inicioDoRegistro = linhaFisica;
    } else {
      celula += c;
    }
  }

  if (entreAspas) throw new ErroCsv(`aspas não fechadas no registro que começa na linha ${inicioDoRegistro}`);
  fecharRegistro();
  return linhas;
}
