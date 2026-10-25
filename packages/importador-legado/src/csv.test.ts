import { describe, expect, it } from "vitest";
import { ErroCsv, lerCsv } from "./csv.js";

describe("lerCsv", () => {
  it("separa por ';', numera as linhas e ignora linhas vazias", () => {
    expect(lerCsv("a;b\n1;2\n\n3;\n")).toEqual([
      { numero: 1, celulas: ["a", "b"] },
      { numero: 2, celulas: ["1", "2"] },
      { numero: 4, celulas: ["3", ""] },
    ]);
  });

  it("aceita CRLF, CR sozinho e BOM", () => {
    expect(lerCsv("﻿a;b\r\n1;2\r3;4")).toEqual([
      { numero: 1, celulas: ["a", "b"] },
      { numero: 2, celulas: ["1", "2"] },
      { numero: 3, celulas: ["3", "4"] },
    ]);
  });

  it("aspas protegem ';', aspas dobradas e quebra de linha; o registro guarda a linha onde começa", () => {
    expect(lerCsv('x;y\n"a;b";"diz ""oi"""\n"linha\num";fim\nultimo;1')).toEqual([
      { numero: 1, celulas: ["x", "y"] },
      { numero: 2, celulas: ["a;b", 'diz "oi"'] },
      { numero: 3, celulas: ["linha\num", "fim"] },
      { numero: 5, celulas: ["ultimo", "1"] },
    ]);
  });

  it("aspas no meio de uma célula sem aspas são texto", () => {
    expect(lerCsv('a"b;c')).toEqual([{ numero: 1, celulas: ['a"b', "c"] }]);
  });

  it("aspas não fechadas são erro", () => {
    expect(() => lerCsv('a;b\n"aberta;1')).toThrow(ErroCsv);
    expect(() => lerCsv('a;b\n"aberta;1')).toThrow(/linha 2/);
  });
});
