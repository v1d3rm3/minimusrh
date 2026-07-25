import type { MigrationBuilder } from "node-pg-migrate";

// Roteiro §2.5.3: trigger de exceção como "cinto e suspensório" além do REVOKE de
// UPDATE/DELETE de `minimus_app` (migração de grants) — a trigger protege inclusive
// contra o DONO das tabelas (`minimus_migracao`), que tem UPDATE/DELETE irrestritos por
// ownership e não é coberto pelo REVOKE. Fundação §2, Decisão 1: fatos e registros de
// cálculo nunca são apagados nem editados.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION bloquear_alteracao_append_only() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION
        'tabela % é append-only (Fundação §2, Decisao 1: fatos e registros de calculo nunca sao apagados nem editados) - operacao % bloqueada',
        TG_TABLE_NAME, TG_OP;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_fato_bloquear_update_delete
      BEFORE UPDATE OR DELETE ON fato
      FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_append_only();

    CREATE TRIGGER trg_registro_calculo_bloquear_update_delete
      BEFORE UPDATE OR DELETE ON registro_calculo
      FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_append_only();
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_fato_bloquear_update_delete ON fato;
    DROP TRIGGER IF EXISTS trg_registro_calculo_bloquear_update_delete ON registro_calculo;
    DROP FUNCTION IF EXISTS bloquear_alteracao_append_only();
  `);
}
