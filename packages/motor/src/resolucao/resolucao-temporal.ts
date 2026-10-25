import { RubricaChave, VersaoRegra, VersaoRubrica } from "@minimusrh/dominio";

export interface ResolucaoTemporal {
  readonly regrasResolvidas: readonly VersaoRegra[];
  readonly rubricasResolvidas: ReadonlyMap<RubricaChave, VersaoRubrica>;
}