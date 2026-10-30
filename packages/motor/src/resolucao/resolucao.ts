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

/**
 * O catálogo de rubricas e regras são conjuntos de objetos desorganizados e, às vezes, interdependentes. Esta função tem o objetivo
 * de resolver as versões de cada um desses objetos para uma determinada competência e folha para que possam ser utilizados no 
 * cálculo da folha.
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
