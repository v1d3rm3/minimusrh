import { describe, expect, it } from "vitest";
import type { PessoaId, HistoriaId } from "./tipos.js";
import type { DataEfeito, DataRegistro } from "./competencia.js";

describe("brands", () => {
  it("em runtime, um branded type é só a string/valor de base — o custo é zero", () => {
    const pessoaId = "abc-123" as PessoaId;
    expect(typeof pessoaId).toBe("string");
    expect(pessoaId).toBe("abc-123");
  });
});

// Testes de TIPO (verificados por `rushx typecheck`, não pelas asserções do vitest em
// runtime): provam que brands diferentes não são intercambiáveis, mesmo carregando a
// mesma representação primitiva. Se um `@ts-expect-error` deixar de ser necessário
// (porque o brand quebrou), o `tsc` do typecheck falha com "Unused '@ts-expect-error'".
function _provaDeTipo(): void {
  function aceitaDataEfeito(_d: DataEfeito): void {}
  function aceitaDataRegistro(_d: DataRegistro): void {}
  function aceitaHistoriaId(_h: HistoriaId): void {}
  function aceitaPessoaId(_p: PessoaId): void {}

  const dataEfeito = "2026-01-01" as DataEfeito;
  const dataRegistro = "2026-01-01T00:00:00Z" as DataRegistro;
  const historiaId = "historia-1" as HistoriaId;
  const pessoaId = "pessoa-1" as PessoaId;

  aceitaDataEfeito(dataEfeito);
  aceitaDataRegistro(dataRegistro);
  aceitaHistoriaId(historiaId);
  aceitaPessoaId(pessoaId);

  // @ts-expect-error DataEfeito não é DataRegistro — a confusão entre as duas é
  // exatamente o bug que a bitemporalidade existe para evitar (§1.3 do design doc).
  aceitaDataRegistro(dataEfeito);

  // @ts-expect-error DataRegistro não é DataEfeito
  aceitaDataEfeito(dataRegistro);

  // @ts-expect-error HistoriaId não é PessoaId
  aceitaPessoaId(historiaId);

  // @ts-expect-error PessoaId não é HistoriaId
  aceitaHistoriaId(pessoaId);
}
