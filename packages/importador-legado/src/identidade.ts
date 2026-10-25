import { createHash } from "node:crypto";
import type { HistoriaId, PessoaId } from "@minimusrh/dominio";

// identidade.ts — DECISOES #3: as colunas de pessoa/história são uuid, e o legado tem
// matrículas. O UUID é DERIVADO do identificador legado (UUID v5, RFC 9562 §5.5), não
// sorteado: reimportar o mesmo lote chega ao mesmo id sem consultar o banco, e um evento
// aponta para a história do seu vínculo antes mesmo de o vínculo ser gravado. A tabela
// `vinculo_legado`/`servidor_legado` guarda o mesmo par para consulta (harness, Módulo 8).

/** Namespace fixo do MinimusRH para identidades vindas do legado. Mudá-lo muda TODOS os ids. */
export const NAMESPACE_LEGADO = "3f8a4c1e-6b2d-5e7f-9a0b-1c2d3e4f5a6b";

function bytesDoUuid(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

/** UUID v5: SHA-1 de namespace + nome, com os bits de versão (5) e de variante (RFC). */
export function uuidV5(nome: string, namespace: string = NAMESPACE_LEGADO): string {
  const hash = createHash("sha1").update(bytesDoUuid(namespace)).update(nome, "utf-8").digest();
  const b = hash.subarray(0, 16);
  b[6] = ((b[6] as number) & 0x0f) | 0x50;
  b[8] = ((b[8] as number) & 0x3f) | 0x80;
  const hex = b.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function pessoaIdDoServidor(idServidor: string): PessoaId {
  return uuidV5(`servidor:${idServidor}`) as PessoaId;
}

export function historiaIdDoVinculo(idVinculo: string): HistoriaId {
  return uuidV5(`vinculo:${idVinculo}`) as HistoriaId;
}
