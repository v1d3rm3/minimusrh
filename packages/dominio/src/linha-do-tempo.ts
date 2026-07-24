import { DataRegistro, DataEfeito } from "./competencia.js";
import { Fato } from "./fato.js";
import { HistoriaId, TipoFatoChave } from "./tipos.js";

/**
 * Visão de LEITURA sobre os fatos de uma história (e da pessoa dona dela),
 * já filtrada pelo corte de conhecimento (dataRegistro <= corte, §5.5).
 * É o que a persistência entrega ao motor; o domínio só define o contrato.
 */
export interface LinhaDoTempo {
  readonly historiaId: HistoriaId;
  readonly corte: DataRegistro;

  /** O fato mais recente (em efeito) do tipo, valendo na data — a regra de ouro da Decisão 2. */
  vigenteEm<C>(tipo: TipoFatoChave, em: DataEfeito): Fato<C> | undefined;
  todosDoTipo<C>(tipo: TipoFatoChave): readonly Fato<C>[];   // já sem os substituídos
  aberturaDaHistoria(): Fato;
  encerramentoDaHistoria(): Fato | undefined;
}