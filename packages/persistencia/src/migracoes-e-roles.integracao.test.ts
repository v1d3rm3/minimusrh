import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { subirAmbiente, type AmbienteIntegracao } from "./testes/ambiente-integracao.js";

// migracoes-e-roles.integracao.test.ts — prova as DUAS defesas do append-only
// separadamente (Roteiro §2.5.3): a role `minimus_app` nunca teve UPDATE/DELETE
// concedido (falha por permissao); a trigger bloqueia mesmo `minimus_migracao`, dona das
// tabelas por ownership, que a role sozinha não cobre (Módulo 3, DECISOES #4). Também
// cobre a idempotência de migração (critério de aceite).

const AUTOR_JSON = JSON.stringify({ tipo: "humano", usuarioId: "teste" });

async function inserirFatoMinimo(ambiente: AmbienteIntegracao): Promise<string> {
  const id = randomUUID();
  await ambiente.poolApp.query(
    `INSERT INTO fato (id, alvo_escopo, alvo_historia_id, tipo, versao_do_tipo, conteudo, data_efeito, data_registro, autor)
     VALUES ($1, 'historia', $2, 'posse', 1, '{}', '2026-01-01', '2026-01-01T00:00:00Z', $3)`,
    [id, randomUUID(), AUTOR_JSON],
  );
  return id;
}

async function inserirFolhaMinima(ambiente: AmbienteIntegracao): Promise<string> {
  const id = randomUUID();
  await ambiente.poolApp.query(
    `INSERT INTO folha (id, competencia_ano, competencia_mes, tipo, estado) VALUES ($1, 2026, 7, 'mensal', 'aberta')`,
    [id],
  );
  return id;
}

async function inserirRegistroCalculoMinimo(ambiente: AmbienteIntegracao, folhaId: string): Promise<void> {
  await ambiente.poolApp.query(
    `INSERT INTO registro_calculo (folha_id, historia_id, rubrica, versao_rubrica, regra, versao_regra, valor, explicacao)
     VALUES ($1, $2, 'salario_base', 1, 'salario_base', 1, '100.00', $3)`,
    [folhaId, randomUUID(), JSON.stringify({ descricao: "x", fontes: [] })],
  );
}

describe("append-only, roles e idempotencia de migracao (integracao)", () => {
  let ambiente: AmbienteIntegracao;

  beforeAll(async () => {
    ambiente = await subirAmbiente();
  });

  afterAll(async () => {
    await ambiente.encerrar();
  });

  it("minimus_app nao tem UPDATE/DELETE em fato (permission denied)", async () => {
    const id = await inserirFatoMinimo(ambiente);
    await expect(ambiente.poolApp.query(`UPDATE fato SET conteudo = '{}' WHERE id = $1`, [id])).rejects.toThrow(
      /permission denied/i,
    );
    await expect(ambiente.poolApp.query(`DELETE FROM fato WHERE id = $1`, [id])).rejects.toThrow(/permission denied/i);
  });

  it("minimus_app nao tem UPDATE/DELETE em registro_calculo (permission denied)", async () => {
    const folhaId = await inserirFolhaMinima(ambiente);
    await inserirRegistroCalculoMinimo(ambiente, folhaId);
    await expect(
      ambiente.poolApp.query(`UPDATE registro_calculo SET valor = '0.00' WHERE folha_id = $1`, [folhaId]),
    ).rejects.toThrow(/permission denied/i);
    await expect(ambiente.poolApp.query(`DELETE FROM registro_calculo WHERE folha_id = $1`, [folhaId])).rejects.toThrow(
      /permission denied/i,
    );
  });

  it("a trigger bloqueia UPDATE/DELETE em fato mesmo para minimus_migracao (dono da tabela)", async () => {
    const id = await inserirFatoMinimo(ambiente);
    await expect(ambiente.poolMigracao.query(`UPDATE fato SET conteudo = '{}' WHERE id = $1`, [id])).rejects.toThrow(
      /append-only/i,
    );
    await expect(ambiente.poolMigracao.query(`DELETE FROM fato WHERE id = $1`, [id])).rejects.toThrow(/append-only/i);
  });

  it("a trigger bloqueia UPDATE/DELETE em registro_calculo mesmo para minimus_migracao", async () => {
    const folhaId = await inserirFolhaMinima(ambiente);
    await inserirRegistroCalculoMinimo(ambiente, folhaId);
    await expect(
      ambiente.poolMigracao.query(`UPDATE registro_calculo SET valor = '0.00' WHERE folha_id = $1`, [folhaId]),
    ).rejects.toThrow(/append-only/i);
    await expect(
      ambiente.poolMigracao.query(`DELETE FROM registro_calculo WHERE folha_id = $1`, [folhaId]),
    ).rejects.toThrow(/append-only/i);
  });

  it.each(["servidor_legado", "vinculo_legado", "fato_importado", "gabarito_legado"])(
    "minimus_app nao tem UPDATE/DELETE na tabela de importacao %s (permission denied)",
    async (tabela) => {
      await expect(ambiente.poolApp.query(`UPDATE ${tabela} SET lote = 'x'`)).rejects.toThrow(/permission denied/i);
      await expect(ambiente.poolApp.query(`DELETE FROM ${tabela}`)).rejects.toThrow(/permission denied/i);
    },
  );

  it("a trigger bloqueia UPDATE/DELETE nas tabelas de identidade legada mesmo para minimus_migracao", async () => {
    await ambiente.poolApp.query(
      `INSERT INTO servidor_legado (id_servidor_legado, pessoa_id, lote) VALUES ('s-trigger', $1, 'teste')`,
      [randomUUID()],
    );
    await ambiente.poolApp.query(
      `INSERT INTO vinculo_legado (id_vinculo_legado, historia_id, id_servidor_legado, pessoa_id, lote)
       VALUES ('v-trigger', $1, 's-trigger', $2, 'teste')`,
      [randomUUID(), randomUUID()],
    );
    for (const tabela of ["servidor_legado", "vinculo_legado"]) {
      await expect(ambiente.poolMigracao.query(`UPDATE ${tabela} SET lote = 'x'`)).rejects.toThrow(/append-only/i);
      await expect(ambiente.poolMigracao.query(`DELETE FROM ${tabela}`)).rejects.toThrow(/append-only/i);
    }
  });

  it("reexecutar a fase schema (idempotencia) nao lanca erro", async () => {
    await expect(ambiente.reaplicarMigracaoSchema()).resolves.toBeUndefined();
  });
});
