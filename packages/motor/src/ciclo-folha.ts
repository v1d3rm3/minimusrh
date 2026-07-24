import { TRANSICOES } from "@minimusrh/dominio";
import type { Amparo, Autor, DataRegistro, EstadoFolha, Folha, TransicaoFolha } from "@minimusrh/dominio";

// ciclo-folha.ts — "fechar é um fato" (Fundacao §5.5). Puro: valida contra `TRANSICOES` do
// dominio (a única tabela, Design §11 decisão 4) e devolve a folha nova + o registro de
// transição; quem persiste é outra camada (Módulo 3/5).
export interface ErroTransicao {
  readonly erro: "transicao_ilegal";
  readonly de: EstadoFolha;
  readonly para: EstadoFolha;
  readonly mensagem: string;
}

/**
 * Semântica do campo `Folha.corte` ao longo do ciclo de vida — o design doc só diz que ele
 * "trava ao entrar em conferência" (Design §8), sem especificar o resto. Decisão registrada
 * em DECISOES-IMPLEMENTACAO.md: entra em 'em_conferencia' → trava no `instante` da
 * transição; é devolvida ('em_conferencia' → 'aberta') → destrava (`undefined`); qualquer
 * outra transição preserva o corte como estava.
 */
function calcularCorte(folha: Folha, para: EstadoFolha, instante: DataRegistro): DataRegistro | undefined {
  if (para === "em_conferencia") return instante;
  if (folha.estado === "em_conferencia" && para === "aberta") return undefined;
  return folha.corte;
}

export function transitar(
  folha: Folha,
  para: EstadoFolha,
  autor: Autor,
  instante: DataRegistro,
  amparo?: Amparo,
): { readonly folha: Folha; readonly transicao: TransicaoFolha } | ErroTransicao {
  const legais = TRANSICOES[folha.estado];
  if (!legais.includes(para)) {
    return {
      erro: "transicao_ilegal",
      de: folha.estado,
      para,
      mensagem: `transição ilegal: '${folha.estado}' → '${para}' (permitidas a partir de '${folha.estado}': ${
        legais.length > 0 ? legais.join(", ") : "nenhuma — estado terminal"
      })`,
    };
  }

  const folhaNova: Folha = { ...folha, estado: para, corte: calcularCorte(folha, para, instante) };
  const transicao: TransicaoFolha = {
    folhaId: folha.id,
    de: folha.estado,
    para,
    instante,
    autor,
    ...(amparo !== undefined ? { amparo } : {}),
  };

  return { folha: folhaNova, transicao };
}
