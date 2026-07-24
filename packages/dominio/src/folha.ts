import { Amparo } from "./amparo.js";
import { Competencia, DataRegistro } from "./competencia.js";
import { Autor } from "./fato.js";
import { FolhaId, TipoFolhaChave } from "./tipos.js";

// folha.ts — ciclo de vida da folha (§3.10, §5.5)
export type EstadoFolha = 'aberta' | 'em_conferencia' | 'fechada' | 'cancelada';

/** Transições legais — a máquina do §5.5 como dado, verificável e exaustiva. */
export const TRANSICOES: Readonly<Record<EstadoFolha, readonly EstadoFolha[]>> = {
  aberta:          ['em_conferencia', 'cancelada'],
  em_conferencia:  ['aberta', 'fechada'],
  fechada:         [],                                // terminal e sagrado — sem reabertura, NUNCA
  cancelada:       [],
};

export interface Folha {
  readonly id: FolhaId;
  readonly competencia: Competencia;
  readonly tipo: TipoFolhaChave;
  readonly estado: EstadoFolha;
  readonly corte?: DataRegistro;                     // travado ao entrar em conferência
  readonly folhasConsumidas?: readonly FolhaId[];    // selo da consolidação (§5.4)
}

export interface TransicaoFolha {                    // "fechar é um fato" (§5.5)
  readonly folhaId: FolhaId;
  readonly de: EstadoFolha;
  readonly para: EstadoFolha;
  readonly instante: DataRegistro;
  readonly autor: Autor;
  readonly amparo?: Amparo;
}
