import { randomUUID } from "node:crypto";
import type { CatalogoTiposDeFato, DataRegistro, ErroValidacao, Fato, FatoId, HistoriaId, PessoaId } from "@minimusrh/dominio";
import { fatoParaParametrosInsercao, linhaParaFato, SELECT_FATO, type LinhaFato } from "./mapeamento-fato.js";
import type { ExecutorSql } from "./pool.js";
import { validarConteudo } from "./validacao-conteudo.js";

// fato-repositorio.ts — única porta de escrita da linha de fatos (Design §10). `id` é
// cunhado aqui via randomUUID(), não por DEFAULT do banco: persistencia é a única fonte
// da identidade antes/depois do INSERT (DECISOES #7).

export type NovoFato<C = unknown> = Omit<Fato<C>, "id">;

export class ErroRegistroFato extends Error {
  constructor(readonly detalhe: ErroValidacao) {
    super(detalhe.erro);
    this.name = "ErroRegistroFato";
  }
}

export interface FatoRepositorio {
  /** Única porta de escrita. Valida `conteudo` contra o schema da versão do tipo ANTES do insert. */
  registrar<C>(fato: NovoFato<C>): Promise<FatoId>;

  buscarPorId<C>(id: FatoId): Promise<Fato<C> | undefined>;

  /**
   * Pré-carga bruta que sustenta `linha-do-tempo-pg.ts`: todos os fatos (qualquer tipo,
   * sem colapsar por data_efeito) de uma história+pessoa, com `data_registro <= corte`,
   * excluindo os substituídos dentro do mesmo corte (exclusão par-a-par — DECISOES #5).
   */
  carregarParaLinhaDoTempo<C>(
    alvo: { readonly pessoaId: PessoaId; readonly historiaId: HistoriaId },
    corte: DataRegistro,
  ): Promise<readonly Fato<C>[]>;

  /**
   * A query `DISTINCT ON` literal do Roteiro §2.5.3 — "o mais recente em efeito, de cada
   * tipo, conhecido até o corte". NÃO alimenta `vigenteEm` (que precisa de `em`
   * histórico arbitrário, ver linha-do-tempo-pg.ts) — é um atalho de leitura de "estado
   * atual" para relatórios/depuração.
   */
  instantaneoAtual<C>(historiaId: HistoriaId, corte: DataRegistro): Promise<readonly Fato<C>[]>;
}

export function fatoRepositorioPg(pool: ExecutorSql, catalogo: CatalogoTiposDeFato): FatoRepositorio {
  return {
    async registrar<C>(fato: NovoFato<C>): Promise<FatoId> {
      const validacao = validarConteudo(catalogo, fato);
      if (validacao !== true) {
        throw new ErroRegistroFato(validacao);
      }

      const id = randomUUID() as FatoId;
      const p = fatoParaParametrosInsercao(id, fato);

      await pool.query(
        `INSERT INTO fato (
           id, alvo_escopo, alvo_pessoa_id, alvo_historia_id, tipo, versao_do_tipo,
           conteudo, data_efeito, data_registro, autor,
           amparo_tipo, amparo_identificacao_canonica, amparo_como_informado, amparo_validado_contra_versao,
           substitui_fato_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          p.id,
          p.alvo_escopo,
          p.alvo_pessoa_id,
          p.alvo_historia_id,
          p.tipo,
          p.versao_do_tipo,
          p.conteudo,
          p.data_efeito,
          p.data_registro,
          p.autor,
          p.amparo_tipo,
          p.amparo_identificacao_canonica,
          p.amparo_como_informado,
          p.amparo_validado_contra_versao,
          p.substitui_fato_id,
        ],
      );

      return id;
    },

    async buscarPorId<C>(id: FatoId): Promise<Fato<C> | undefined> {
      const resultado = await pool.query<LinhaFato>(`SELECT ${SELECT_FATO} FROM fato WHERE id = $1`, [id]);
      const linha = resultado.rows[0];
      return linha === undefined ? undefined : linhaParaFato<C>(linha);
    },

    async carregarParaLinhaDoTempo<C>(
      alvo: { readonly pessoaId: PessoaId; readonly historiaId: HistoriaId },
      corte: DataRegistro,
    ): Promise<readonly Fato<C>[]> {
      const resultado = await pool.query<LinhaFato>(
        `SELECT ${SELECT_FATO} FROM fato f
         WHERE (f.alvo_historia_id = $1 OR f.alvo_pessoa_id = $2)
           AND f.data_registro <= $3
           AND NOT EXISTS (
             SELECT 1 FROM fato sub
             WHERE sub.substitui_fato_id = f.id AND sub.data_registro <= $3
           )`,
        [alvo.historiaId, alvo.pessoaId, corte],
      );
      return resultado.rows.map((linha) => linhaParaFato<C>(linha));
    },

    async instantaneoAtual<C>(historiaId: HistoriaId, corte: DataRegistro): Promise<readonly Fato<C>[]> {
      const resultado = await pool.query<LinhaFato>(
        `SELECT DISTINCT ON (tipo) ${SELECT_FATO} FROM fato
         WHERE alvo_historia_id = $1 AND data_registro <= $2
         ORDER BY tipo, data_efeito DESC, data_registro DESC`,
        [historiaId, corte],
      );
      return resultado.rows.map((linha) => linhaParaFato<C>(linha));
    },
  };
}
