import type { MigrationBuilder } from "node-pg-migrate";

// Design §8.2: "fechar é um fato" — uma linha por transição, nunca reescrita na prática
// (ver DECISOES #4 sobre por que esta tabela não recebe a trigger append-only dedicada).
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE transicao_folha (
      id          bigserial PRIMARY KEY,
      folha_id    uuid NOT NULL REFERENCES folha (id),
      de          text NOT NULL,
      para        text NOT NULL,
      instante    timestamptz NOT NULL,
      autor       jsonb NOT NULL,
      amparo      jsonb NULL
    );

    CREATE INDEX idx_transicao_folha_folha ON transicao_folha (folha_id);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS transicao_folha CASCADE;`);
}
