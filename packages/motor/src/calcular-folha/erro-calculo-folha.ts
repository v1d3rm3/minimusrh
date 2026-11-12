import type { HistoriaId, RegraChave } from "@minimusrh/dominio";
import type { GrafoErroCiclo } from "../grafo/grafo-erro-ciclo.js";

export type ErroCalculoFolha = { readonly tipo: "ciclo"; readonly erro: GrafoErroCiclo; } |
{ readonly tipo: "excecao"; readonly historiaId: HistoriaId; readonly regra: RegraChave; readonly mensagem: string; };
