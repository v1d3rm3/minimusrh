import type { MigrationBuilder } from "node-pg-migrate";

// Fase "bootstrap" (Módulo 3, DECISOES #2): roda autenticada como o superusuário do
// ambiente/container — precisa existir ANTES da fase "schema" poder rodar autenticada
// como `minimus_migracao` (que precisa já existir, com CREATE no schema, para ser dono
// das tabelas que a fase "schema" cria). Roteiro §2.5.3: "papel da aplicação SEM
// update/delete"; `minimus_migracao` roda as migrações com papel separado.
function senhaOuPadrao(variavelDeAmbiente: string, padrao: string): string {
  return process.env[variavelDeAmbiente] ?? padrao;
}

function literalSql(valor: string): string {
  return `'${valor.replace(/'/g, "''")}'`;
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  const senhaMigracao = literalSql(senhaOuPadrao("MINIMUS_MIGRACAO_SENHA", "minimus_migracao_dev"));
  const senhaApp = literalSql(senhaOuPadrao("MINIMUS_APP_SENHA", "minimus_app_dev"));

  // Idempotente: `rush rebuild`/re-execução do teste não falha se os papéis já existirem.
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'minimus_migracao') THEN
        CREATE ROLE minimus_migracao LOGIN PASSWORD ${senhaMigracao};
      END IF;
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'minimus_app') THEN
        CREATE ROLE minimus_app LOGIN PASSWORD ${senhaApp};
      END IF;
    END $$;
  `);

  pgm.sql(`GRANT CREATE, USAGE ON SCHEMA public TO minimus_migracao;`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`REVOKE CREATE, USAGE ON SCHEMA public FROM minimus_migracao;`);
  pgm.sql(`DROP ROLE IF EXISTS minimus_app;`);
  pgm.sql(`DROP ROLE IF EXISTS minimus_migracao;`);
}
