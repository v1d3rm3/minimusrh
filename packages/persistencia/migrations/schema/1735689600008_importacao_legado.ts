import type { MigrationBuilder } from "node-pg-migrate";

// Módulo 7 (importador-legado, Roteiro Marco 3) — DECISOES #11. Quatro tabelas, nenhuma
// delas linha de fatos:
// - `servidor_legado` / `vinculo_legado`: o mapa de identidade legado ⇄ MinimusRH. É aqui
//   que o vínculo pessoa↔história passa a existir (DECISOES #8; app-folha DECISOES #2).
// - `fato_importado`: a chave natural de cada fato gerado por importação + a assinatura do
//   conteúdo traduzido — sustenta a idempotência de lote sem tocar em `fato`.
// - `gabarito_legado`: contracheques do legado, material de comparação do harness
//   (Módulo 8), "fora da linha de fatos" (playbook).
// Todas são append-only como `fato`: proveniência de importação não se reescreve.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE servidor_legado (
      id_servidor_legado  text PRIMARY KEY,
      pessoa_id           uuid NOT NULL UNIQUE,
      lote                text NOT NULL
    );

    CREATE TABLE vinculo_legado (
      id_vinculo_legado   text PRIMARY KEY,
      historia_id         uuid NOT NULL UNIQUE,
      id_servidor_legado  text NOT NULL REFERENCES servidor_legado (id_servidor_legado),
      pessoa_id           uuid NOT NULL,
      lote                text NOT NULL
    );

    CREATE TABLE fato_importado (
      chave_natural       text PRIMARY KEY,
      fato_id             uuid NOT NULL UNIQUE REFERENCES fato (id),
      assinatura          text NOT NULL,
      lote                text NOT NULL
    );

    CREATE TABLE gabarito_legado (
      id                  bigserial PRIMARY KEY,
      chave_natural       text NOT NULL UNIQUE,
      id_vinculo_legado   text NOT NULL REFERENCES vinculo_legado (id_vinculo_legado),
      historia_id         uuid NOT NULL,
      competencia         text NOT NULL CHECK (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
      tipo_folha_legado   text NOT NULL,
      rubrica_legado      text NOT NULL,
      descricao           text NULL,
      valor               NUMERIC(14, 2) NOT NULL,
      lote                text NOT NULL
    );

    CREATE INDEX idx_gabarito_legado_competencia ON gabarito_legado (competencia, tipo_folha_legado);

    CREATE TRIGGER trg_servidor_legado_bloquear_update_delete
      BEFORE UPDATE OR DELETE ON servidor_legado
      FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_append_only();
    CREATE TRIGGER trg_vinculo_legado_bloquear_update_delete
      BEFORE UPDATE OR DELETE ON vinculo_legado
      FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_append_only();
    CREATE TRIGGER trg_fato_importado_bloquear_update_delete
      BEFORE UPDATE OR DELETE ON fato_importado
      FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_append_only();
    CREATE TRIGGER trg_gabarito_legado_bloquear_update_delete
      BEFORE UPDATE OR DELETE ON gabarito_legado
      FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_append_only();

    GRANT SELECT, INSERT ON servidor_legado, vinculo_legado, fato_importado, gabarito_legado TO minimus_app;
    GRANT USAGE, SELECT ON gabarito_legado_id_seq TO minimus_app;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS gabarito_legado CASCADE;
    DROP TABLE IF EXISTS fato_importado CASCADE;
    DROP TABLE IF EXISTS vinculo_legado CASCADE;
    DROP TABLE IF EXISTS servidor_legado CASCADE;
  `);
}
