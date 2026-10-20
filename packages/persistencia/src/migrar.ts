import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";
import type { ConexaoBanco } from "./pool.js";

// `migrations/` mora na raiz do pacote — um nível acima tanto de `src/` quanto de `dist/`,
// então o mesmo caminho relativo vale rodando do fonte (vitest) ou do build. Exportado
// para que outros pacotes (app-folha, Módulo 5) subam o mesmo schema sem copiar arquivos.
const RAIZ_PACOTE = join(dirname(fileURLToPath(import.meta.url)), "..");

export const DIRETORIO_MIGRACOES = {
  bootstrap: join(RAIZ_PACOTE, "migrations", "bootstrap"),
  schema: join(RAIZ_PACOTE, "migrations", "schema"),
} as const;

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
