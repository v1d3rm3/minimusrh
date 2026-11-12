import type { RubricaChave } from "@minimusrh/dominio";


export interface GrafoErroCiclo {
  readonly erro: "ciclo";
  readonly caminho: readonly RubricaChave[]; // ex.: [a, b, c, a] — cita o ciclo completo
  readonly mensagem: string;
}
