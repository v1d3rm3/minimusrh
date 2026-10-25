import type { TipoFatoChave } from "@minimusrh/dominio";
import { TIPO_FATO_NASCIMENTO, TIPO_FATO_POSSE } from "@minimusrh/regras-alrn";
import { describe, expect, it } from "vitest";
import { ErroConfiguracao, configuracaoAlrn, validarConfiguracao } from "./configuracao.js";

describe("configuração do importador", () => {
  it("a configuração da ALRN é válida contra o próprio catálogo", () => {
    expect(() => validarConfiguracao(configuracaoAlrn())).not.toThrow();
  });

  it.each([
    ["nascimento inexistente", { nascimento: "nao_existe" as TipoFatoChave }, /nascimento 'nao_existe' não existe/],
    ["nascimento que não é de pessoa", { nascimento: TIPO_FATO_POSSE }, /não serve como nascimento/],
    ["abertura que não abre história", { abertura: TIPO_FATO_NASCIMENTO }, /não serve como abertura/],
    ["encerramento que não encerra história", { encerramento: TIPO_FATO_POSSE }, /não serve como encerramento/],
  ])("recusa %s", (_caso, troca, mensagem) => {
    const base = configuracaoAlrn();
    expect(() => validarConfiguracao({ ...base, tipos: { ...base.tipos, ...troca } })).toThrow(ErroConfiguracao);
    expect(() => validarConfiguracao({ ...base, tipos: { ...base.tipos, ...troca } })).toThrow(mensagem);
  });
});
