import type { HistoriaId, PessoaId } from "@minimusrh/dominio";
import type { Pool } from "pg";

// vinculos-importados.ts — a leitura do mapa de identidade (DECISOES #3): as histórias
// importadas com a pessoa dona de cada uma. É o par que `linhaDoTempoPg` exige e que o
// `CadastroDeHistorias` do app-folha recebe por porta (app-folha DECISOES #2); o harness
// (Módulo 8) o usa para calcular as histórias importadas e cruzar com o gabarito.

export interface VinculoImportado {
  readonly pessoaId: PessoaId;
  readonly historiaId: HistoriaId;
  readonly idVinculoLegado: string;
  readonly idServidorLegado: string;
}

export async function listarVinculosImportados(pool: Pool): Promise<readonly VinculoImportado[]> {
  const resultado = await pool.query<{ pessoa_id: string; historia_id: string; id_vinculo_legado: string; id_servidor_legado: string }>(
    "SELECT pessoa_id, historia_id, id_vinculo_legado, id_servidor_legado FROM vinculo_legado ORDER BY id_vinculo_legado",
  );
  return resultado.rows.map((l) => ({
    pessoaId: l.pessoa_id as PessoaId,
    historiaId: l.historia_id as HistoriaId,
    idVinculoLegado: l.id_vinculo_legado,
    idServidorLegado: l.id_servidor_legado,
  }));
}
