import type { MigrationBuilder } from "node-pg-migrate";

// Design §9/Roteiro §2.1: append-only, escrita em lote no fechamento da folha (mesma
// transação da transição — ver folha-repositorio.ts). `id` é técnico: RegistroCalculo do
// dominio não tem identidade própria.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE registro_calculo (
      id              bigserial PRIMARY KEY,
      folha_id        uuid NOT NULL REFERENCES folha (id),
      historia_id     uuid NOT NULL,
      rubrica         text NOT NULL,
      versao_rubrica  integer NOT NULL,
      regra           text NOT NULL,
      versao_regra    integer NOT NULL,
      valor           NUMERIC(14, 2) NOT NULL,
      explicacao      jsonb NOT NULL
    );

    CREATE INDEX idx_registro_calculo_folha ON registro_calculo (folha_id);
    CREATE INDEX idx_registro_calculo_historia ON registro_calculo (historia_id);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS registro_calculo CASCADE;`);
}
