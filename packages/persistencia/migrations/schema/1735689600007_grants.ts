import type { MigrationBuilder } from "node-pg-migrate";

// Roteiro §2.5.3: papel da aplicação com INSERT+SELECT em fato/registro_calculo e NADA
// MAIS — o REVOKE é redundante (nunca foi concedido) mas explícito por clareza/auditoria.
// `folha` recebe UPDATE porque é tabela de estado atual, mutada a cada transição
// (DECISOES #4); `transicao_folha` só INSERT+SELECT, por princípio de menor privilégio,
// mesmo sem trigger append-only dedicada.
//
// As sequences são concedidas por nome (não "ALL SEQUENCES IN SCHEMA public"): esse
// schema também hospeda `pgmigrations_bootstrap_id_seq`, dona de `minimus_super` — como
// `minimus_migracao` (quem roda esta migração) não é dona nem tem GRANT OPTION sobre ela,
// um GRANT/REVOKE "ALL SEQUENCES" falha com permission denied ao tentar varrê-la junto.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    GRANT USAGE ON SCHEMA public TO minimus_app;

    GRANT SELECT, INSERT ON fato, registro_calculo TO minimus_app;
    REVOKE UPDATE, DELETE ON fato, registro_calculo FROM minimus_app;

    GRANT SELECT, INSERT, UPDATE ON folha TO minimus_app;
    GRANT SELECT, INSERT ON transicao_folha TO minimus_app;

    GRANT USAGE, SELECT ON registro_calculo_id_seq, transicao_folha_id_seq TO minimus_app;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    REVOKE ALL ON fato, folha, registro_calculo, transicao_folha FROM minimus_app;
    REVOKE ALL ON registro_calculo_id_seq, transicao_folha_id_seq FROM minimus_app;
    REVOKE USAGE ON SCHEMA public FROM minimus_app;
  `);
}
