import { Competencia, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { HistoriaId } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { TIPO_FATO_NASCIMENTO, criarCatalogoTiposDeFato } from "./catalogo-tipos-fato.js";
import { DERIVACAO_IDADE_IMPL } from "./derivacao-idade.js";
import { linhaDoTempoEmMemoria } from "./linha-do-tempo-em-memoria.js";
import { criarFato } from "./testes/fabrica-fato.js";

const CATALOGO = criarCatalogoTiposDeFato();
const HISTORIA = "h1" as HistoriaId;
const CORTE = dataRegistro("2026-12-31T00:00:00Z");
const COMPETENCIA = Competencia.de(2026, 6);
const V1 = DERIVACAO_IDADE_IMPL.versoes[0]!;

function linhaComNascimento(dataNascimento: string) {
  const nascimento = criarFato({
    tipo: TIPO_FATO_NASCIMENTO,
    dataEfeito: dataEfeito(dataNascimento),
    dataRegistro: dataRegistro(`${dataNascimento}T00:00:00Z`),
  });
  return linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [nascimento], CORTE);
}

describe("derivacao idade", () => {
  it("já fez aniversário este ano: idade = ano referência - ano nascimento", () => {
    const linha = linhaComNascimento("1990-05-20");
    expect(V1.derivar(linha, dataEfeito("2026-06-01"), COMPETENCIA)).toBe(36);
  });

  it("ainda não fez aniversário este ano: idade = diferença - 1", () => {
    const linha = linhaComNascimento("1990-05-20");
    expect(V1.derivar(linha, dataEfeito("2026-05-19"), COMPETENCIA)).toBe(35);
  });

  it("no próprio dia do aniversário já conta o ano novo", () => {
    const linha = linhaComNascimento("1990-05-20");
    expect(V1.derivar(linha, dataEfeito("2026-05-20"), COMPETENCIA)).toBe(36);
  });

  it("sem fato de nascimento conhecido: undefined (não derivável, distinto de zero)", () => {
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [], CORTE);
    expect(V1.derivar(linha, dataEfeito("2026-06-01"), COMPETENCIA)).toBeUndefined();
  });
});
