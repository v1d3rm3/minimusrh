import { randomUUID } from "node:crypto";
import type { Folha, FolhaId, RegistroCalculo, TransicaoFolha } from "@minimusrh/dominio";
import type { Pool } from "pg";
import {
  folhaParaParametrosInsercao,
  linhaParaFolha,
  linhaParaTransicao,
  SELECT_FOLHA,
  SELECT_TRANSICAO_FOLHA,
  transicaoParaParametrosInsercao,
  type LinhaFolha,
  type LinhaTransicaoFolha,
} from "./mapeamento-folha.js";
import { registroCalculoParaParametrosInsercao } from "./mapeamento-registro-calculo.js";
import { withTransacao } from "./pool.js";

// folha-repositorio.ts — persiste o resultado PURO de motor::ciclo-folha::transitar
// (Design §8/§5.5: "fechar é um fato"); a semântica do `corte` já vem pronta na `Folha`
// devolvida pelo motor, esta camada só persiste (não recalcula — Módulo 3 não
// reimplementa decisão de negócio nenhuma).

export type NovaFolha = Omit<Folha, "id">;

export class ErroTransicaoConcorrente extends Error {
  constructor(folhaId: FolhaId, estadoEsperado: string) {
    super(`folha ${folhaId}: transicao concorrente detectada (estado esperado '${estadoEsperado}' nao bateu)`);
    this.name = "ErroTransicaoConcorrente";
  }
}

export interface FolhaRepositorio {
  criar(folha: NovaFolha): Promise<FolhaId>;
  buscarPorId(id: FolhaId): Promise<Folha | undefined>;
  listarTransicoes(folhaId: FolhaId): Promise<readonly TransicaoFolha[]>;

  /**
   * UPDATE em `folha` (estado/corte/folhas_consumidas) + INSERT em `transicao_folha`
   * numa única transação; se `registros` for passado (fechamento), o lote inteiro de
   * `registro_calculo` entra na MESMA transação — qualquer falha desfaz tudo (critério
   * de aceite "fechamento transacional"). Optimistic check: o UPDATE só aplica se o
   * estado no banco bater com `transicao.de` — senão, `ErroTransicaoConcorrente`.
   */
  persistirTransicao(
    resultado: { readonly folha: Folha; readonly transicao: TransicaoFolha },
    registros?: readonly RegistroCalculo[],
  ): Promise<void>;
}

export function folhaRepositorioPg(pool: Pool): FolhaRepositorio {
  return {
    async criar(folha: NovaFolha): Promise<FolhaId> {
      const id = randomUUID() as FolhaId;
      const p = folhaParaParametrosInsercao(id, folha);

      await pool.query(
        `INSERT INTO folha (id, competencia_ano, competencia_mes, tipo, estado, corte, folhas_consumidas)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [p.id, p.competencia_ano, p.competencia_mes, p.tipo, p.estado, p.corte, p.folhas_consumidas],
      );

      return id;
    },

    async buscarPorId(id: FolhaId): Promise<Folha | undefined> {
      const resultado = await pool.query<LinhaFolha>(`SELECT ${SELECT_FOLHA} FROM folha WHERE id = $1`, [id]);
      const linha = resultado.rows[0];
      return linha === undefined ? undefined : linhaParaFolha(linha);
    },

    async listarTransicoes(folhaId: FolhaId): Promise<readonly TransicaoFolha[]> {
      const resultado = await pool.query<LinhaTransicaoFolha>(
        `SELECT ${SELECT_TRANSICAO_FOLHA} FROM transicao_folha WHERE folha_id = $1 ORDER BY id`,
        [folhaId],
      );
      return resultado.rows.map(linhaParaTransicao);
    },

    async persistirTransicao(
      resultado: { readonly folha: Folha; readonly transicao: TransicaoFolha },
      registros?: readonly RegistroCalculo[],
    ): Promise<void> {
      const { folha, transicao } = resultado;

      await withTransacao(pool, async (client) => {
        const p = folhaParaParametrosInsercao(folha.id, folha);
        const atualizacao = await client.query(
          `UPDATE folha SET estado = $1, corte = $2, folhas_consumidas = $3 WHERE id = $4 AND estado = $5`,
          [p.estado, p.corte, p.folhas_consumidas, folha.id, transicao.de],
        );
        if (atualizacao.rowCount !== 1) {
          throw new ErroTransicaoConcorrente(folha.id, transicao.de);
        }

        const t = transicaoParaParametrosInsercao(transicao);
        await client.query(
          `INSERT INTO transicao_folha (folha_id, de, para, instante, autor, amparo)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [t.folha_id, t.de, t.para, t.instante, t.autor, t.amparo],
        );

        if (registros !== undefined) {
          for (const registro of registros) {
            const r = registroCalculoParaParametrosInsercao(registro);
            await client.query(
              `INSERT INTO registro_calculo (folha_id, historia_id, rubrica, versao_rubrica, regra, versao_regra, valor, explicacao)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [r.folha_id, r.historia_id, r.rubrica, r.versao_rubrica, r.regra, r.versao_regra, r.valor, r.explicacao],
            );
          }
        }
      });
    },
  };
}
