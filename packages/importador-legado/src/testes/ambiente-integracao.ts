import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { criarPool, DIRETORIO_MIGRACOES, rodarMigracaoBootstrap, rodarMigracaoSchema, type ConexaoBanco } from "@minimusrh/persistencia";
import type { Pool } from "pg";

// ambiente-integracao.ts — suporte de teste (NÃO é `*.test.ts`): o mesmo ambiente do app-folha
// (Postgres efêmero, migrações exportadas por `persistencia`, pool por role). O importador
// grava com `minimus_app`, o papel SEM update/delete (Roteiro §2.5.3).

const IMAGEM_POSTGRES = "postgres:16-alpine";
const SENHA_SUPERUSUARIO = "minimus_super_teste";
const SENHA_MIGRACAO = "minimus_migracao_dev";
const SENHA_APP = "minimus_app_dev";

export interface AmbienteIntegracao {
  readonly poolApp: Pool;
  /** Conexão do papel da aplicação, para a CLI abrir o próprio pool. */
  conexaoApp(): ConexaoBanco;
  encerrar(): Promise<void>;
}

function conexaoPara(container: StartedPostgreSqlContainer, user: string, password: string): ConexaoBanco {
  return { host: container.getHost(), port: container.getPort(), database: container.getDatabase(), user, password };
}

export async function subirAmbiente(): Promise<AmbienteIntegracao> {
  process.env["MINIMUS_MIGRACAO_SENHA"] = SENHA_MIGRACAO;
  process.env["MINIMUS_APP_SENHA"] = SENHA_APP;

  const container = await new PostgreSqlContainer(IMAGEM_POSTGRES)
    .withDatabase("minimusrh")
    .withUsername("minimus_super")
    .withPassword(SENHA_SUPERUSUARIO)
    .start();

  await rodarMigracaoBootstrap(conexaoPara(container, "minimus_super", SENHA_SUPERUSUARIO), DIRETORIO_MIGRACOES.bootstrap);
  await rodarMigracaoSchema(conexaoPara(container, "minimus_migracao", SENHA_MIGRACAO), DIRETORIO_MIGRACOES.schema);

  const poolApp = criarPool(conexaoPara(container, "minimus_app", SENHA_APP));
  return {
    poolApp,
    conexaoApp: () => conexaoPara(container, "minimus_app", SENHA_APP),
    async encerrar(): Promise<void> {
      await poolApp.end();
      await container.stop();
    },
  };
}
