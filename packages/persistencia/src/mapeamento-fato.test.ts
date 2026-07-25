import { Amparo } from "@minimusrh/dominio";
import type { AlvoFato, Autor, DataEfeito, DataRegistro, FatoId, HistoriaId, PessoaId, TipoAmparoChave, TipoFatoChave } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { fatoParaParametrosInsercao, linhaParaFato, type LinhaFato } from "./mapeamento-fato.js";
import type { NovoFato } from "./fato-repositorio.js";

const AUTOR_HUMANO: Autor = { tipo: "humano", usuarioId: "u1" };

function linhaBase(sobrescritas: Partial<LinhaFato> = {}): LinhaFato {
  return {
    id: "f1",
    alvo_escopo: "historia",
    alvo_pessoa_id: null,
    alvo_historia_id: "h1",
    tipo: "promocao",
    versao_do_tipo: 1,
    conteudo: { cargo: "B8" },
    data_efeito: "2026-02-01",
    data_registro: "2026-07-01T10:00:00.000Z",
    autor: AUTOR_HUMANO,
    amparo_tipo: null,
    amparo_identificacao_canonica: null,
    amparo_como_informado: null,
    amparo_validado_contra_versao: null,
    substitui_fato_id: null,
    ...sobrescritas,
  };
}

describe("linhaParaFato", () => {
  it("mapeia alvo escopo historia", () => {
    const fato = linhaParaFato(linhaBase());
    expect(fato.alvo).toEqual({ escopo: "historia", historiaId: "h1" as HistoriaId });
  });

  it("mapeia alvo escopo pessoa", () => {
    const fato = linhaParaFato(
      linhaBase({ alvo_escopo: "pessoa", alvo_pessoa_id: "p1", alvo_historia_id: null }),
    );
    expect(fato.alvo).toEqual({ escopo: "pessoa", pessoaId: "p1" as PessoaId });
  });

  it("nao inclui amparo quando as colunas de amparo sao nulas", () => {
    const fato = linhaParaFato(linhaBase());
    expect(fato.amparo).toBeUndefined();
  });

  it("reidrata o amparo preservando a canonica exata gravada (sem recanonicalizar)", () => {
    const fato = linhaParaFato(
      linhaBase({
        amparo_tipo: "processo",
        amparo_identificacao_canonica: "45/2026",
        amparo_como_informado: "0045/2026",
        amparo_validado_contra_versao: 1,
      }),
    );
    expect(fato.amparo).toBeInstanceOf(Amparo);
    expect(fato.amparo?.identificacaoCanonica).toBe("45/2026");
    expect(fato.amparo?.comoInformado).toBe("0045/2026");
    expect(fato.amparo?.validadoContraVersao).toBe(1);
    expect(fato.amparo?.mesmoDocumentoQue(Amparo.legado("processo" as TipoAmparoChave, "45/2026"))).toBe(true);
  });

  it("nao inclui substituiFatoId quando a coluna e nula", () => {
    const fato = linhaParaFato(linhaBase());
    expect(fato.substituiFatoId).toBeUndefined();
  });

  it("mapeia substituiFatoId quando presente", () => {
    const fato = linhaParaFato(linhaBase({ substitui_fato_id: "f0" }));
    expect(fato.substituiFatoId).toBe("f0" as FatoId);
  });
});

describe("fatoParaParametrosInsercao", () => {
  function novoFato(sobrescritas: Partial<NovoFato> = {}): NovoFato {
    const alvo: AlvoFato = { escopo: "historia", historiaId: "h1" as HistoriaId };
    return {
      alvo,
      tipo: "promocao" as TipoFatoChave,
      versaoDoTipo: 1,
      conteudo: { cargo: "B8" },
      dataEfeito: "2026-02-01" as DataEfeito,
      dataRegistro: "2026-07-01T10:00:00.000Z" as DataRegistro,
      autor: AUTOR_HUMANO,
      ...sobrescritas,
    };
  }

  it("serializa conteudo e autor como JSON", () => {
    const params = fatoParaParametrosInsercao("f1" as FatoId, novoFato());
    expect(JSON.parse(params.conteudo)).toEqual({ cargo: "B8" });
    expect(JSON.parse(params.autor)).toEqual(AUTOR_HUMANO);
  });

  it("decompoe alvo pessoa em colunas, deixando historia nula", () => {
    const params = fatoParaParametrosInsercao(
      "f1" as FatoId,
      novoFato({ alvo: { escopo: "pessoa", pessoaId: "p1" as PessoaId } }),
    );
    expect(params.alvo_escopo).toBe("pessoa");
    expect(params.alvo_pessoa_id).toBe("p1");
    expect(params.alvo_historia_id).toBeNull();
  });

  it("decompoe amparo em colunas quando presente", () => {
    const amparo = Amparo.legado("processo" as TipoAmparoChave, "45/2026");
    const params = fatoParaParametrosInsercao("f1" as FatoId, novoFato({ amparo }));
    expect(params.amparo_tipo).toBe("processo");
    expect(params.amparo_identificacao_canonica).toBe("45/2026");
    expect(params.amparo_como_informado).toBe("45/2026");
    expect(params.amparo_validado_contra_versao).toBeNull();
  });

  it("colunas de amparo ficam nulas quando ausente", () => {
    const params = fatoParaParametrosInsercao("f1" as FatoId, novoFato());
    expect(params.amparo_tipo).toBeNull();
    expect(params.amparo_identificacao_canonica).toBeNull();
    expect(params.amparo_como_informado).toBeNull();
    expect(params.amparo_validado_contra_versao).toBeNull();
  });

  it("substitui_fato_id nulo quando ausente", () => {
    const params = fatoParaParametrosInsercao("f1" as FatoId, novoFato());
    expect(params.substitui_fato_id).toBeNull();
  });

  it("round-trip completo (insercao -> linha simulada -> leitura) preserva os dados", () => {
    const amparo = Amparo.legado("processo" as TipoAmparoChave, "45/2026");
    const original = novoFato({ amparo, substituiFatoId: "f0" as FatoId });
    const params = fatoParaParametrosInsercao("f1" as FatoId, original);

    const linhaSimulada: LinhaFato = {
      id: params.id,
      alvo_escopo: params.alvo_escopo as "pessoa" | "historia",
      alvo_pessoa_id: params.alvo_pessoa_id,
      alvo_historia_id: params.alvo_historia_id,
      tipo: params.tipo,
      versao_do_tipo: params.versao_do_tipo,
      conteudo: JSON.parse(params.conteudo),
      data_efeito: params.data_efeito,
      data_registro: params.data_registro,
      autor: JSON.parse(params.autor),
      amparo_tipo: params.amparo_tipo,
      amparo_identificacao_canonica: params.amparo_identificacao_canonica,
      amparo_como_informado: params.amparo_como_informado,
      amparo_validado_contra_versao: params.amparo_validado_contra_versao,
      substitui_fato_id: params.substitui_fato_id,
    };

    const reconstruido = linhaParaFato(linhaSimulada);
    expect(reconstruido).toEqual({ id: "f1" as FatoId, ...original });
  });
});
