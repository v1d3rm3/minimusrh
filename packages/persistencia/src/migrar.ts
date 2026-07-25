import { runner } from "node-pg-migrate";
import type { ConexaoBanco } from "./pool.js";

/**
 * Migração em duas fases (DECISOES #2): "bootstrap" cria as roles `minimus_migracao`/
 * `minimus_app` (roda como superusuário); "schema" cria as 4 tabelas + índices +
 * triggers + grants (roda como `minimus_migracao`, dona das tabelas que cria). Cada
 * fase tem sua própria tabela de controle — rodam sob roles diferentes, então não faz
 * sentido compartilhar o tracking de migrações aplicadas.
 */
export async function rodarMigracaoBootstrap(conexaoSuperusuario: ConexaoBanco, dir: string): Promise<void> {
  await runner({
    databaseUrl: conexaoSuperusuario,
    dir,
    direction: "up",
    migrationsTable: "pgmigrations_bootstrap",
    log: () => {},
  });
}

export async function rodarMigracaoSchema(conexaoMigracao: ConexaoBanco, dir: string): Promise<void> {
  await runner({
    databaseUrl: conexaoMigracao,
    dir,
    direction: "up",
    migrationsTable: "pgmigrations",
    log: () => {},
  });
}
