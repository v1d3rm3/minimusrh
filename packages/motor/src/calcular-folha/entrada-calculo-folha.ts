import type { FolhaId, Competencia, TipoFolhaChave, DataRegistro, LinhaDoTempo, RegraChave, VersaoRegra, Catalogo, RubricaChave, Rubrica, RegistroDeDerivacoes } from "@minimusrh/dominio";
import type { LeitorDeJanelas } from "../contexto-impl.js";


export interface EntradaCalculoFolha {
  readonly folhaId: FolhaId;
  readonly competencia: Competencia;
  readonly tipoFolha: TipoFolhaChave;
  readonly corte: DataRegistro;
  readonly historias: readonly LinhaDoTempo[];
  readonly regras: ReadonlyMap<RegraChave, readonly VersaoRegra[]>;
  readonly rubricas: Catalogo<RubricaChave, Rubrica>;
  readonly derivacoes: RegistroDeDerivacoes;
  readonly leitorJanelas: LeitorDeJanelas;
}
