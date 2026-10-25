import type {
  Catalogo,
  Competencia,
  DataRegistro,
  RegraChave,
  Rubrica,
  RubricaChave,
  TipoFolhaChave,
  VersaoRegra,
  VersaoRubrica,
} from "@minimusrh/dominio";
import { versaoVigente } from "@minimusrh/dominio";
import { RubricaNaoResolvidaErro } from "./rubrica-nao-resolvida-erro.js";
import { ResolucaoTemporal } from "./resolucao-temporal.js";

// resolucao.ts — dado o conjunto bruto de regras (todas as versões, agrupadas por
// RegraChave) e o catálogo de rubricas, resolve para um (competencia, tipoFolha, corte) as
// versões VIGENTES via `versaoVigente` do dominio — a fonte ÚNICA de semântica temporal
// (Fundacao §5.2 passo 3; Design §11 decisão 8). Derivações NÃO são pré-resolvidas aqui:
// `RegistroDeDerivacoes` só expõe `porChave`, sem `todos()`, então não há como enumerar
// "todas as derivações" de antemão — a resolução delas é sob demanda, por chave, dentro de
// contexto-impl.ts quando uma regra efetivamente lê `ctx.derivacao(chave)`. Decisão
// registrada em DECISOES-IMPLEMENTACAO.md.


/**
 * TODO: Descrição
 * 
 * Não tem estado, não vira classe.
 * 
 * @param regras 
 * @param rubricas 
 * @param competencia 
 * @param tipoFolha 
 * @param corte 
 * @returns 
 */
export function resolverParaExecucao(
  regras: ReadonlyMap<RegraChave, readonly VersaoRegra[]>,
  rubricas: Catalogo<RubricaChave, Rubrica>,
  competencia: Competencia,
  tipoFolha: TipoFolhaChave,
  corte: DataRegistro,
): ResolucaoTemporal {
  const em = competencia.dataReferencia();

  const regrasResolvidas: VersaoRegra[] = [];
  for (const versoes of regras.values()) {
    // aplicaSeAFolhas é a 2ª dimensão da vigência (Design §11 decisão 8, §3.7 do
    // conceitual) — versaoVigente não sabe de tipo de folha, então filtra ANTES.
    const aplicaveisAoTipo = versoes.filter((v) => v.aplicaSeAFolhas.includes(tipoFolha));
    const vigente = versaoVigente(aplicaveisAoTipo, em, corte);
    if (vigente !== undefined) regrasResolvidas.push(vigente);
  }

  const rubricasResolvidas = new Map<RubricaChave, VersaoRubrica>();
  for (const regra of regrasResolvidas) {
    if (rubricasResolvidas.has(regra.produz)) continue;
    const rubrica = rubricas.porChave(regra.produz);
    const vigente = rubrica !== undefined ? versaoVigente(rubrica.versoes, em, corte) : undefined;
    if (vigente === undefined) throw new RubricaNaoResolvidaErro(regra.produz);
    rubricasResolvidas.set(regra.produz, vigente);
  }

  return { regrasResolvidas, rubricasResolvidas };
}
