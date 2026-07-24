import { describe, expect, it } from "vitest";
import { Amparo } from "./amparo.js";
import type { CatalogoAmparos } from "./catalogo.js";
import type { TipoAmparo, TipoAmparoChave, VersaoTipoAmparo } from "./catalogo-amparos.js";
import type { DataEfeito, DataRegistro } from "./competencia.js";
import type { ErroValidacao } from "./tipos.js";

const PROCESSO = "processo" as TipoAmparoChave;

function versao(overrides: Partial<VersaoTipoAmparo> = {}): VersaoTipoAmparo {
  return {
    versao: 1,
    dataEfeito: "2020-01-01" as DataEfeito,
    dataRegistro: "2020-01-01T00:00:00Z" as DataRegistro,
    mascara: String.raw`(\d+)/(\d{4})`,
    grupos: [
      { nome: "numero", tipo: "numero" },
      { nome: "ano", tipo: "ano" },
    ],
    formatoCanonico: "{numero}/{ano}",
    exemplo: "123/2026",
    ...overrides,
  };
}

function catalogoCom(...tipos: TipoAmparo[]): CatalogoAmparos {
  return {
    porChave: (chave) => tipos.find((t) => t.chave === chave),
    todos: () => tipos,
  };
}

function ehErro(r: Amparo | ErroValidacao): r is ErroValidacao {
  return "erro" in r;
}

describe("Amparo", () => {
  describe("criar()", () => {
    it("normaliza a entrada usando a versão vigente e marca validadoContraVersao", () => {
      const catalogo = catalogoCom({ chave: PROCESSO, versoes: [versao()] });
      const r = Amparo.criar(PROCESSO, "0045/2026", catalogo, "2026-01-01" as DataEfeito);

      expect(ehErro(r)).toBe(false);
      const amparo = r as Amparo;
      expect(amparo.tipo).toBe(PROCESSO);
      expect(amparo.identificacaoCanonica).toBe("45/2026");
      expect(amparo.comoInformado).toBe("0045/2026");
      expect(amparo.validadoContraVersao).toBe(1);
    });

    it("usa sempre a versão mais recente conhecida no catálogo (corte sem limite)", () => {
      const catalogo = catalogoCom({
        chave: PROCESSO,
        versoes: [
          versao({ versao: 1, dataEfeito: "2020-01-01" as DataEfeito, dataRegistro: "2020-01-01T00:00:00Z" as DataRegistro }),
          versao({
            versao: 2,
            dataEfeito: "2020-01-01" as DataEfeito,
            dataRegistro: "2026-06-01T00:00:00Z" as DataRegistro,
            formatoCanonico: "{ano}/{numero}",
          }),
        ],
      });
      const r = Amparo.criar(PROCESSO, "45/2026", catalogo, "2021-01-01" as DataEfeito);
      const amparo = r as Amparo;
      expect(amparo.identificacaoCanonica).toBe("2026/45");
      expect(amparo.validadoContraVersao).toBe(2);
    });

    it("corte sem limite ignora versão fora de ordem cujo dataRegistro não supera o máximo já visto", () => {
      const catalogo = catalogoCom({
        chave: PROCESSO,
        versoes: [
          versao({ versao: 1, dataEfeito: "2020-01-01" as DataEfeito, dataRegistro: "2020-01-01T00:00:00Z" as DataRegistro }),
          versao({ versao: 3, dataEfeito: "2020-01-01" as DataEfeito, dataRegistro: "2026-06-01T00:00:00Z" as DataRegistro }),
          versao({ versao: 2, dataEfeito: "2020-01-01" as DataEfeito, dataRegistro: "2023-01-01T00:00:00Z" as DataRegistro }),
        ],
      });
      const r = Amparo.criar(PROCESSO, "45/2026", catalogo, "2021-01-01" as DataEfeito);
      const amparo = r as Amparo;
      expect(amparo.validadoContraVersao).toBe(3);
    });

    it("retorna ErroValidacao quando o tipo não existe no catálogo", () => {
      const catalogo = catalogoCom();
      const r = Amparo.criar(PROCESSO, "45/2026", catalogo, "2026-01-01" as DataEfeito);
      expect(ehErro(r)).toBe(true);
    });

    it("retorna ErroValidacao quando não há versão vigente para a data", () => {
      const catalogo = catalogoCom({ chave: PROCESSO, versoes: [versao({ dataEfeito: "2027-01-01" as DataEfeito })] });
      const r = Amparo.criar(PROCESSO, "45/2026", catalogo, "2026-01-01" as DataEfeito);
      expect(ehErro(r)).toBe(true);
    });

    it("retorna ErroValidacao quando a entrada não casa com a máscara da versão vigente", () => {
      const catalogo = catalogoCom({ chave: PROCESSO, versoes: [versao()] });
      const r = Amparo.criar(PROCESSO, "não é um amparo", catalogo, "2026-01-01" as DataEfeito);
      expect(ehErro(r)).toBe(true);
    });
  });

  describe("legado()", () => {
    it("preserva comoInformado e usa apenas trim para identificacaoCanonica", () => {
      const amparo = Amparo.legado(PROCESSO, "  0045/2026  ");
      expect(amparo.identificacaoCanonica).toBe("0045/2026");
      expect(amparo.comoInformado).toBe("  0045/2026  ");
      expect(amparo.validadoContraVersao).toBeUndefined();
    });
  });

  describe("mesmoDocumentoQue()", () => {
    it("true quando tipo e identificacaoCanonica coincidem", () => {
      const a = Amparo.legado(PROCESSO, "45/2026");
      const b = Amparo.legado(PROCESSO, "45/2026");
      expect(a.mesmoDocumentoQue(b)).toBe(true);
    });

    it("false quando a identificacaoCanonica difere", () => {
      const a = Amparo.legado(PROCESSO, "45/2026");
      const b = Amparo.legado(PROCESSO, "46/2026");
      expect(a.mesmoDocumentoQue(b)).toBe(false);
    });

    it("false quando o tipo difere", () => {
      const a = Amparo.legado(PROCESSO, "45/2026");
      const b = Amparo.legado("portaria" as TipoAmparoChave, "45/2026");
      expect(a.mesmoDocumentoQue(b)).toBe(false);
    });

    it("agrupa grafias diferentes do mesmo processo normalizadas via criar()", () => {
      const catalogo = catalogoCom({ chave: PROCESSO, versoes: [versao()] });
      const em = "2026-01-01" as DataEfeito;
      const a = Amparo.criar(PROCESSO, "0045/2026", catalogo, em) as Amparo;
      const b = Amparo.criar(PROCESSO, "  45/2026  ", catalogo, em) as Amparo;

      expect(ehErro(a)).toBe(false);
      expect(ehErro(b)).toBe(false);
      expect(a.identificacaoCanonica).toBe(b.identificacaoCanonica);
      expect(a.mesmoDocumentoQue(b)).toBe(true);
    });
  });
});
