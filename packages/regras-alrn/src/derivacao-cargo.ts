import { dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { DataEfeito, Derivacao, DerivacaoChave, Fato, LinhaDoTempo, VersaoDerivacao } from "@minimusrh/dominio";
import { TIPO_FATO_POSSE, TIPO_FATO_PROMOCAO } from "./catalogo-tipos-fato.js";

// derivacao-cargo.ts — "cargo = último fato de promoção/posse vigente" (texto do próprio
// playbook do Módulo 4). posse e promocao são dois TIPOS diferentes que se pronunciam
// sobre a MESMA chave (cargo, Fundação §3.5) — por isso comparamos os dois vigentes na
// data e ficamos com o de dataEfeito mais recente, não um só tipo.
export const DERIVACAO_CARGO = "cargo" as DerivacaoChave;

interface ConteudoCargo {
  readonly cargo: string;
}

function maisRecente(a: Fato<ConteudoCargo> | undefined, b: Fato<ConteudoCargo> | undefined): Fato<ConteudoCargo> | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return b.dataEfeito > a.dataEfeito ? b : a;
}

const V1: VersaoDerivacao<string> = {
  versao: 1,
  dataEfeito: dataEfeito("2026-01-01"),
  dataRegistro: dataRegistro("2026-01-01T00:00:00Z"),
  dependeDe: [TIPO_FATO_POSSE, TIPO_FATO_PROMOCAO],
  derivar(linha: LinhaDoTempo, referencia: DataEfeito): string | undefined {
    const posse = linha.vigenteEm<ConteudoCargo>(TIPO_FATO_POSSE, referencia);
    const promocao = linha.vigenteEm<ConteudoCargo>(TIPO_FATO_PROMOCAO, referencia);
    return maisRecente(posse, promocao)?.conteudo.cargo;
  },
};

export const DERIVACAO_CARGO_IMPL: Derivacao<string> = { chave: DERIVACAO_CARGO, versoes: [V1] };
