import type { CatalogoTiposDeFato } from "@minimusrh/dominio";
import { fatoRepositorioPg, withTransacao } from "@minimusrh/persistencia";
import type { Pool, PoolClient } from "pg";
import type { DestinoImportacao, ResultadoGravacao } from "./destino.js";
import type { FatoTraduzido, IdentidadeServidor, IdentidadeVinculo, LinhaGabarito, UnidadeImportacao } from "./tradutores.js";

// destino-pg.ts — grava uma unidade de importação numa ÚNICA transação (fatos + identidade ou
// gabarito), pelas tabelas da migração 0008 de persistencia (DECISOES #2, #6). Só INSERT e
// SELECT: a idempotência é "já existe igual ⇒ não grava", nunca "atualiza". Os fatos passam
// pela única porta de escrita da linha de fatos, `fatoRepositorioPg.registrar`, que valida
// o conteúdo de novo antes do INSERT.

class ErroConflito extends Error {}

/** Serializa importações concorrentes da mesma chave natural até o fim da transação. */
async function travarChave(client: PoolClient, chave: string): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [chave]);
}

async function gravarServidor(client: PoolClient, s: IdentidadeServidor, lote: string): Promise<boolean> {
  await travarChave(client, `servidor:${s.idServidorLegado}`);
  const existente = await client.query<{ pessoa_id: string }>(
    "SELECT pessoa_id FROM servidor_legado WHERE id_servidor_legado = $1",
    [s.idServidorLegado],
  );
  const linha = existente.rows[0];
  if (linha !== undefined) {
    if (linha.pessoa_id !== s.pessoaId) throw new ErroConflito(`servidor '${s.idServidorLegado}' já importado com outra pessoa (${linha.pessoa_id})`);
    return false;
  }
  await client.query("INSERT INTO servidor_legado (id_servidor_legado, pessoa_id, lote) VALUES ($1, $2, $3)", [
    s.idServidorLegado,
    s.pessoaId,
    lote,
  ]);
  return true;
}

async function gravarVinculo(client: PoolClient, v: IdentidadeVinculo, lote: string): Promise<boolean> {
  await travarChave(client, `vinculo:${v.idVinculoLegado}`);
  const existente = await client.query<{ id_servidor_legado: string }>(
    "SELECT id_servidor_legado FROM vinculo_legado WHERE id_vinculo_legado = $1",
    [v.idVinculoLegado],
  );
  const linha = existente.rows[0];
  if (linha !== undefined) {
    if (linha.id_servidor_legado !== v.idServidorLegado) {
      throw new ErroConflito(`vínculo '${v.idVinculoLegado}' já importado para o servidor '${linha.id_servidor_legado}', não '${v.idServidorLegado}'`);
    }
    return false;
  }
  await client.query(
    "INSERT INTO vinculo_legado (id_vinculo_legado, historia_id, id_servidor_legado, pessoa_id, lote) VALUES ($1, $2, $3, $4, $5)",
    [v.idVinculoLegado, v.historiaId, v.idServidorLegado, v.pessoaId, lote],
  );
  return true;
}

async function gravarFato(client: PoolClient, catalogo: CatalogoTiposDeFato, f: FatoTraduzido, lote: string): Promise<boolean> {
  await travarChave(client, f.chaveNatural);
  const existente = await client.query<{ assinatura: string }>("SELECT assinatura FROM fato_importado WHERE chave_natural = $1", [f.chaveNatural]);
  const linha = existente.rows[0];
  if (linha !== undefined) {
    if (linha.assinatura !== f.assinatura) {
      throw new ErroConflito(`'${f.chaveNatural}' já importado com conteúdo diferente (correção do legado exige fato de substituição)`);
    }
    return false;
  }
  const fatoId = await fatoRepositorioPg(client, catalogo).registrar(f.fato);
  await client.query("INSERT INTO fato_importado (chave_natural, fato_id, assinatura, lote) VALUES ($1, $2, $3, $4)", [
    f.chaveNatural,
    fatoId,
    f.assinatura,
    lote,
  ]);
  return true;
}

async function gravarGabarito(client: PoolClient, g: LinhaGabarito, lote: string): Promise<boolean> {
  await travarChave(client, g.chaveNatural);
  const existente = await client.query<{ valor: string; descricao: string | null }>(
    "SELECT valor::text AS valor, descricao FROM gabarito_legado WHERE chave_natural = $1",
    [g.chaveNatural],
  );
  const linha = existente.rows[0];
  const valor = g.valor.paraString();
  const descricao = g.descricao ?? null;
  if (linha !== undefined) {
    if (linha.valor !== valor || linha.descricao !== descricao) {
      const antes = `${linha.valor} '${linha.descricao ?? ""}'`;
      throw new ErroConflito(`'${g.chaveNatural}' já importado como ${antes}, não ${valor} '${descricao ?? ""}'`);
    }
    return false;
  }
  await client.query(
    `INSERT INTO gabarito_legado
       (chave_natural, id_vinculo_legado, historia_id, competencia, tipo_folha_legado, rubrica_legado, descricao, valor, lote)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [g.chaveNatural, g.idVinculoLegado, g.historiaId, g.competencia.toString(), g.tipoFolhaLegado, g.rubricaLegado, descricao, valor, lote],
  );
  return true;
}

export function destinoPg(pool: Pool, catalogo: CatalogoTiposDeFato, lote: string): DestinoImportacao {
  const existe = async (sql: string, id: string): Promise<boolean> => (await pool.query(sql, [id])).rowCount !== 0;

  return {
    servidorConhecido: (id) => existe("SELECT 1 FROM servidor_legado WHERE id_servidor_legado = $1", id),
    vinculoConhecido: (id) => existe("SELECT 1 FROM vinculo_legado WHERE id_vinculo_legado = $1", id),

    async gravar(unidade: UnidadeImportacao): Promise<ResultadoGravacao> {
      try {
        return await withTransacao(pool, async (client) => {
          let identidadeNova = false;
          if (unidade.tipo === "servidor") identidadeNova = await gravarServidor(client, unidade.servidor, lote);
          if (unidade.tipo === "vinculo") identidadeNova = await gravarVinculo(client, unidade.vinculo, lote);
          if (unidade.tipo === "contracheque") {
            const nova = await gravarGabarito(client, unidade.gabarito, lote);
            return { ok: true, fatosNovos: [], fatosJaImportados: 0, semMudanca: !nova };
          }

          const fatosNovos: FatoTraduzido[] = [];
          for (const fato of unidade.fatos) {
            if (await gravarFato(client, catalogo, fato, lote)) fatosNovos.push(fato);
          }
          const fatosJaImportados = unidade.fatos.length - fatosNovos.length;
          return { ok: true, fatosNovos, fatosJaImportados, semMudanca: !identidadeNova && fatosNovos.length === 0 };
        });
      } catch (e) {
        if (e instanceof ErroConflito) return { ok: false, conflito: e.message };
        throw e;
      }
    },
  };
}
