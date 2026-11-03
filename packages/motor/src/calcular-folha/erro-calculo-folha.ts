import type { HistoriaId, RegraChave } from "@minimusrh/dominio";
import type { ErroCiclo } from "../grafo.js";

export type ErroCalculoFolha = { readonly tipo: "ciclo"; readonly erro: ErroCiclo; } |
{ readonly tipo: "excecao"; readonly historiaId: HistoriaId; readonly regra: RegraChave; readonly mensagem: string; };
