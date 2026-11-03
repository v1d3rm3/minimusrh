import type { RegistroCalculo } from "@minimusrh/dominio";
import { ErroCalculoFolha } from "./erro-calculo-folha.js";
import { NaoAplicavelResultadoCalculoFolha } from "./nao-aplicavel-resultado-calculo-folha.js";


export interface ResultadoCalculoFolha {
  readonly registros: readonly RegistroCalculo[];
  readonly naoAplicaveis: readonly NaoAplicavelResultadoCalculoFolha[];
  readonly erros: readonly ErroCalculoFolha[];
}
