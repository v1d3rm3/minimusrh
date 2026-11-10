import type { EstadoFolha } from "@minimusrh/dominio";


export interface ErroTransicaoFolha {
  readonly erro: "transicao_ilegal";
  readonly de: EstadoFolha;
  readonly para: EstadoFolha;
  readonly mensagem: string;
}
