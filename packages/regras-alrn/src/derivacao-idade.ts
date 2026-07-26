import { dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { DataEfeito, Derivacao, DerivacaoChave, LinhaDoTempo, VersaoDerivacao } from "@minimusrh/dominio";
import { TIPO_FATO_NASCIMENTO } from "./catalogo-tipos-fato.js";
import { partesDataEfeito } from "./data-util.js";

// derivacao-idade.ts — Fundação Decisão 2: "a idade do servidor muda todo ano sem que
// ninguém registre nada... porque idade nunca foi fato armazenado; é derivação do fato
// nascimento contra a data de referência". `undefined` = sem fato de nascimento (não
// derivável), distinto de idade zero.
export const DERIVACAO_IDADE = "idade" as DerivacaoChave;

function calcularIdadeEmAnos(nascimento: DataEfeito, referencia: DataEfeito): number {
  const n = partesDataEfeito(nascimento);
  const r = partesDataEfeito(referencia);
  const aindaNaoFezAniversarioEsteAno = r.mes < n.mes || (r.mes === n.mes && r.dia < n.dia);
  return r.ano - n.ano - (aindaNaoFezAniversarioEsteAno ? 1 : 0);
}

const V1: VersaoDerivacao<number> = {
  versao: 1,
  dataEfeito: dataEfeito("2026-01-01"),
  dataRegistro: dataRegistro("2026-01-01T00:00:00Z"),
  dependeDe: [TIPO_FATO_NASCIMENTO],
  derivar(linha: LinhaDoTempo, referencia: DataEfeito): number | undefined {
    const nascimento = linha.vigenteEm(TIPO_FATO_NASCIMENTO, referencia);
    return nascimento === undefined ? undefined : calcularIdadeEmAnos(nascimento.dataEfeito, referencia);
  },
};

export const DERIVACAO_IDADE_IMPL: Derivacao<number> = { chave: DERIVACAO_IDADE, versoes: [V1] };
