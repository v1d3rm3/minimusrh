import type { MigrationBuilder } from "node-pg-migrate";

// Design §8/§5.5: tabela de ESTADO ATUAL (mutada a cada transição, por isso não recebe a
// trigger append-only — ver DECISOES #4). Precisa existir antes de `registro_calculo` e
// `transicao_folha`, que referenciam `folha(id)`.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE folha (
      id                   uuid PRIMARY KEY,
      competencia_ano      integer NOT NULL,
      competencia_mes      integer NOT NULL CHECK (competencia_mes BETWEEN 1 AND 12),
      tipo                 text NOT NULL,
      estado               text NOT NULL CHECK (estado IN ('aberta', 'em_conferencia', 'fechada', 'cancelada')),
      corte                timestamptz NULL,
      folhas_consumidas    uuid[] NULL
    );
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS folha CASCADE;`);
}
