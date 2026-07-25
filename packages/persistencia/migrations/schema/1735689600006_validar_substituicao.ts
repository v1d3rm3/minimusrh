import type { MigrationBuilder } from "node-pg-migrate";

// DECISOES #5: reforço de integridade não pedido literalmente pelo playbook, mas
// necessário para que a exclusão par-a-par de fatos substituídos (linha-do-tempo-pg.ts)
// resolva cadeias A←B←C corretamente em qualquer corte — exige que um fato substituto
// tenha `data_registro >= data_registro` do substituído e preserve o mesmo `tipo`.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION validar_substituicao_fato() RETURNS trigger AS $$
    DECLARE
      original fato%ROWTYPE;
    BEGIN
      IF NEW.substitui_fato_id IS NOT NULL THEN
        SELECT * INTO original FROM fato WHERE id = NEW.substitui_fato_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'fato substituido % nao encontrado', NEW.substitui_fato_id;
        END IF;
        IF NEW.data_registro < original.data_registro THEN
          RAISE EXCEPTION 'fato substituto (%) nao pode ter data_registro anterior ao substituido (%)', NEW.id, original.id;
        END IF;
        IF NEW.tipo IS DISTINCT FROM original.tipo THEN
          RAISE EXCEPTION 'substituicao deve preservar o tipo do fato original (% != %)', NEW.tipo, original.tipo;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_fato_validar_substituicao
      BEFORE INSERT ON fato
      FOR EACH ROW EXECUTE FUNCTION validar_substituicao_fato();
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_fato_validar_substituicao ON fato;
    DROP FUNCTION IF EXISTS validar_substituicao_fato();
  `);
}
