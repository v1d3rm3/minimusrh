import { dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { DataEfeito, Derivacao, DerivacaoChave, LinhaDoTempo, VersaoDerivacao } from "@minimusrh/dominio";
import { TIPO_FATO_EXONERACAO, TIPO_FATO_POSSE } from "./catalogo-tipos-fato.js";

// derivacao-situacao-funcional.ts — "ativo entre abertura e encerramento" (playbook,
// Módulo 4). Mesma lógica estrutural da decisão #6 de packages/motor/DECISOES-IMPLEMENTACAO.md
// (participação de história no cálculo), aqui exposta como derivação de instante consumível
// por regras via `ctx.derivacao('situacao_funcional')`.
export const DERIVACAO_SITUACAO_FUNCIONAL = "situacao_funcional" as DerivacaoChave;

export type SituacaoFuncional = "ativo" | "inativo";

const V1: VersaoDerivacao<SituacaoFuncional> = {
  versao: 1,
  dataEfeito: dataEfeito("2026-01-01"),
  dataRegistro: dataRegistro("2026-01-01T00:00:00Z"),
  dependeDe: [TIPO_FATO_POSSE, TIPO_FATO_EXONERACAO],
  derivar(linha: LinhaDoTempo, referencia: DataEfeito): SituacaoFuncional {
    const abertura = linha.aberturaDaHistoria();
    const encerramento = linha.encerramentoDaHistoria();
    const jaAberta = abertura.dataEfeito <= referencia;
    const aindaNaoEncerrada = encerramento === undefined || encerramento.dataEfeito > referencia;
    return jaAberta && aindaNaoEncerrada ? "ativo" : "inativo";
  },
};

export const DERIVACAO_SITUACAO_FUNCIONAL_IMPL: Derivacao<SituacaoFuncional> = {
  chave: DERIVACAO_SITUACAO_FUNCIONAL,
  versoes: [V1],
};
