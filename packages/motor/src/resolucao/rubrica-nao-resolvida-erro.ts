import { RubricaChave } from "@minimusrh/dominio";

/**
 * Uma regra resolvida aponta (`produz`) para uma rubrica ausente do catálogo, ou presente
 * mas sem versão vigente na mesma data — publicação inconsistente (regra vigente para uma
 * rubrica que não está). Não é um caso do playbook para `resolucao.ts`; decisão: lançar,
 * não devolver silenciosamente uma resolução incompleta (DECISOES-IMPLEMENTACAO.md).
 */
export class RubricaNaoResolvidaErro extends Error {
  constructor(readonly rubrica: RubricaChave) {
    super(`regra vigente produz a rubrica '${rubrica}', mas essa rubrica não tem versão vigente no catálogo de rubricas.`);
  }
}