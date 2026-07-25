import { Pool, type ClientConfig, type PoolClient } from "pg";

/** Config de conexão por role — mesma forma aceita por `pg.Pool` e pelo runner de migração. */
export type ConexaoBanco = Pick<ClientConfig, "host" | "port" | "database" | "user" | "password">;

export function criarPool(conexao: ConexaoBanco): Pool {
  return new Pool(conexao);
}

/**
 * BEGIN/COMMIT explícitos (não `pool.query` direto): o fechamento de folha precisa que a
 * transição e o lote de registro_calculo sejam atômicos (Módulo 3, critério de aceite
 * "fechamento transacional").
 */
export async function withTransacao<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const resultado = await fn(client);
    await client.query("COMMIT");
    return resultado;
  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;
  } finally {
    client.release();
  }
}
