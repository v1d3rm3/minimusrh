import type { HistoriaId, RegraChave } from "@minimusrh/dominio";


export interface NaoAplicavelResultadoCalculoFolha {
  readonly historiaId: HistoriaId;
  readonly regra: RegraChave;
  readonly versao: number;
}
