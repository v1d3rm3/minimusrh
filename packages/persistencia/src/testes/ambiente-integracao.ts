import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { Pool } from "pg";
import { DIRETORIO_MIGRACOES, rodarMigracaoBootstrap, rodarMigracaoSchema } from "../migrar.js";
import { criarPool, type ConexaoBanco } from "../pool.js";

// ambiente-integracao.ts — suporte de teste (NÃO é `*.test.ts`): sobe um Postgres
// efêmero via Testcontainers, roda as duas fases de migração (DECISOES #2) e devolve um
// pool por role, para os testes exercitarem exatamente a separação de privilégios do
// Roteiro §2.5.3. Container por chamada (isolamento total — "container limpo" do
// critério de aceite do Módulo 3).

const IMAGEM_POSTGRES = "postgres:16-alpine";
const SENHA_SUPERUSUARIO = "minimus_super_teste";
const SENHA_MIGRACAO = "minimus_migracao_dev";
const SENHA_APP = "minimus_app_dev";

const DIR_MIGRACOES_BOOTSTRAP = DIRETORIO_MIGRACOES.bootstrap;
const DIR_MIGRACOES_SCHEMA = DIRETORIO_MIGRACOES.schema;

export interface AmbienteIntegracao {
  readonly container: StartedPostgreSqlContainer;
  readonly poolApp: Pool;
  readonly poolMigracao: Pool;
  /** Reaplica a fase "schema" no mesmo banco — sustenta o teste de idempotencia de migracao. */
  reaplicarMigracaoSchema(): Promise<void>;
  encerrar(): Promise<void>;
}

function conexaoPara(container: StartedPostgreSqlContainer, user: string, password: string): ConexaoBanco {
  return {
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    user,
    password,
  };
}

export async function subirAmbiente(): Promise<AmbienteIntegracao> {
  process.env["MINIMUS_MIGRACAO_SENHA"] = SENHA_MIGRACAO;
  process.env["MINIMUS_APP_SENHA"] = SENHA_APP;

  const container = await new PostgreSqlContainer(IMAGEM_POSTGRES)
    .withDatabase("minimusrh")
    .withUsername("minimus_super")
    .withPassword(SENHA_SUPERUSUARIO)
    .start();

  const conexaoSuperusuario = conexaoPara(container, "minimus_super", SENHA_SUPERUSUARIO);
  await rodarMigracaoBootstrap(conexaoSuperusuario, DIR_MIGRACOES_BOOTSTRAP);

  const conexaoMigracao = conexaoPara(container, "minimus_migracao", SENHA_MIGRACAO);
  await rodarMigracaoSchema(conexaoMigracao, DIR_MIGRACOES_SCHEMA);

  const poolMigracao = criarPool(conexaoMigracao);
  const poolApp = criarPool(conexaoPara(container, "minimus_app", SENHA_APP));

  return {
    container,
    poolApp,
    poolMigracao,
    async reaplicarMigracaoSchema(): Promise<void> {
      await rodarMigracaoSchema(conexaoMigracao, DIR_MIGRACOES_SCHEMA);
    },
    async encerrar(): Promise<void> {
      await poolApp.end();
      await poolMigracao.end();
      await container.stop();
    },
  };
}
