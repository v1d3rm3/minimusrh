import type { FatoTraduzido, UnidadeImportacao } from "./tradutores.js";

// destino.ts — para onde vão as unidades traduzidas. O pipeline (importar.ts) só conhece esta
// porta; a implementação Postgres (destino-pg.ts) grava cada unidade numa transação, e o
// suporte de teste tem uma em memória com a mesma semântica de idempotência (DECISOES #2).

export type ResultadoGravacao =
  | {
      readonly ok: true;
      /** Fatos efetivamente gravados agora. */
      readonly fatosNovos: readonly FatoTraduzido[];
      /** Fatos cuja chave natural já existia com a mesma assinatura (reimportação). */
      readonly fatosJaImportados: number;
      /** A unidade inteira já estava gravada, idêntica: nada mudou. */
      readonly semMudanca: boolean;
    }
  | {
      readonly ok: false;
      /** Chave já importada com conteúdo diferente: nada desta unidade é gravado. */
      readonly conflito: string;
    };

export interface DestinoImportacao {
  /** O servidor já tem identidade gravada (de um lote anterior)? */
  servidorConhecido(idServidorLegado: string): Promise<boolean>;
  /** O vínculo já tem identidade gravada (de um lote anterior)? */
  vinculoConhecido(idVinculoLegado: string): Promise<boolean>;
  /** Grava a unidade inteira ou nada dela. */
  gravar(unidade: UnidadeImportacao): Promise<ResultadoGravacao>;
}
