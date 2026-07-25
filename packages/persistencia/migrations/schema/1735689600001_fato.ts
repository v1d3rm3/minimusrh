import type { MigrationBuilder } from "node-pg-migrate";

// Roteiro §2.1/§2.5.3: a tabela da linha de fatos. AlvoFato e o bloco de Amparo são
// decompostos em colunas (em vez de um único JSONB), decisão registrada em DECISOES #3:
// AlvoFato é união com DUAS formas de identidade (pessoaId/historiaId), cada uma com seu
// próprio índice; e o playbook pede `identificacao_canonica` do amparo INDEXADA.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE fato (
      id                              uuid PRIMARY KEY,

      alvo_escopo                     text NOT NULL CHECK (alvo_escopo IN ('pessoa', 'historia')),
      alvo_pessoa_id                  uuid NULL,
      alvo_historia_id                uuid NULL,

      tipo                            text NOT NULL,
      versao_do_tipo                  integer NOT NULL,

      conteudo                        jsonb NOT NULL,

      data_efeito                     date NOT NULL,
      data_registro                   timestamptz NOT NULL,

      autor                           jsonb NOT NULL,

      amparo_tipo                     text NULL,
      amparo_identificacao_canonica   text NULL,
      amparo_como_informado           text NULL,
      amparo_validado_contra_versao   integer NULL,

      substitui_fato_id               uuid NULL REFERENCES fato (id),

      CONSTRAINT chk_fato_alvo_consistente CHECK (
        (alvo_escopo = 'pessoa'   AND alvo_pessoa_id   IS NOT NULL AND alvo_historia_id IS NULL) OR
        (alvo_escopo = 'historia' AND alvo_historia_id IS NOT NULL AND alvo_pessoa_id   IS NULL)
      ),
      CONSTRAINT chk_fato_amparo_consistente CHECK (
        (amparo_tipo IS NULL AND amparo_identificacao_canonica IS NULL AND amparo_como_informado IS NULL) OR
        (amparo_tipo IS NOT NULL AND amparo_identificacao_canonica IS NOT NULL AND amparo_como_informado IS NOT NULL)
      )
    );

    -- Índices literais do Roteiro §2.5.3.
    CREATE INDEX idx_fato_historia_tipo_efeito_registro
      ON fato (alvo_historia_id, tipo, data_efeito DESC, data_registro DESC);
    CREATE INDEX idx_fato_data_registro ON fato (data_registro);
    CREATE INDEX idx_fato_tipo_efeito ON fato (tipo, data_efeito);

    -- Índices adicionais decorrentes de decompor AlvoFato/Amparo em colunas (DECISOES #3).
    CREATE INDEX idx_fato_pessoa_tipo_efeito_registro
      ON fato (alvo_pessoa_id, tipo, data_efeito DESC, data_registro DESC)
      WHERE alvo_pessoa_id IS NOT NULL;
    CREATE INDEX idx_fato_amparo_canonica
      ON fato (amparo_identificacao_canonica)
      WHERE amparo_identificacao_canonica IS NOT NULL;
    CREATE INDEX idx_fato_substitui
      ON fato (substitui_fato_id)
      WHERE substitui_fato_id IS NOT NULL;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS fato CASCADE;`);
}
