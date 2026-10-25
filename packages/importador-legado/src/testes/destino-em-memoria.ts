import type { DestinoImportacao, ResultadoGravacao } from "../destino.js";
import type { FatoTraduzido, IdentidadeServidor, IdentidadeVinculo, LinhaGabarito, UnidadeImportacao } from "../tradutores.js";

// destino-em-memoria.ts — suporte de teste (NÃO é `*.test.ts`): a mesma semântica de
// idempotência do destino Postgres (destino-pg.ts), sem banco — para os testes do pipeline
// rodarem sem Docker. A equivalência com o destino real é provada pelo teste de integração.

export interface DestinoEmMemoria extends DestinoImportacao {
  readonly servidores: ReadonlyMap<string, IdentidadeServidor>;
  readonly vinculos: ReadonlyMap<string, IdentidadeVinculo>;
  /** chave natural → fato gravado (na ordem de gravação). */
  readonly fatos: ReadonlyMap<string, FatoTraduzido>;
  readonly gabarito: ReadonlyMap<string, LinhaGabarito>;
}

export function destinoEmMemoria(): DestinoEmMemoria {
  const servidores = new Map<string, IdentidadeServidor>();
  const vinculos = new Map<string, IdentidadeVinculo>();
  const fatos = new Map<string, FatoTraduzido>();
  const gabarito = new Map<string, LinhaGabarito>();

  return {
    servidores,
    vinculos,
    fatos,
    gabarito,
    servidorConhecido: async (id) => servidores.has(id),
    vinculoConhecido: async (id) => vinculos.has(id),

    async gravar(unidade: UnidadeImportacao): Promise<ResultadoGravacao> {
      if (unidade.tipo === "contracheque") {
        const existente = gabarito.get(unidade.chaveNatural);
        if (existente === undefined) {
          gabarito.set(unidade.chaveNatural, unidade.gabarito);
          return { ok: true, fatosNovos: [], fatosJaImportados: 0, semMudanca: false };
        }
        if (existente.valor.paraString() !== unidade.gabarito.valor.paraString() || existente.descricao !== unidade.gabarito.descricao) {
          return { ok: false, conflito: `'${unidade.chaveNatural}' já importado com valor ${existente.valor.paraString()}` };
        }
        return { ok: true, fatosNovos: [], fatosJaImportados: 0, semMudanca: true };
      }

      // tudo ou nada: confere antes de gravar qualquer peça da unidade.
      if (unidade.tipo === "vinculo") {
        const existente = vinculos.get(unidade.vinculo.idVinculoLegado);
        if (existente !== undefined && existente.idServidorLegado !== unidade.vinculo.idServidorLegado) {
          return { ok: false, conflito: `vínculo '${unidade.vinculo.idVinculoLegado}' já importado para outro servidor` };
        }
      }
      for (const f of unidade.fatos) {
        const existente = fatos.get(f.chaveNatural);
        if (existente !== undefined && existente.assinatura !== f.assinatura) {
          return { ok: false, conflito: `'${f.chaveNatural}' já importado com conteúdo diferente` };
        }
      }

      let identidadeNova = false;
      if (unidade.tipo === "servidor" && !servidores.has(unidade.servidor.idServidorLegado)) {
        servidores.set(unidade.servidor.idServidorLegado, unidade.servidor);
        identidadeNova = true;
      }
      if (unidade.tipo === "vinculo" && !vinculos.has(unidade.vinculo.idVinculoLegado)) {
        vinculos.set(unidade.vinculo.idVinculoLegado, unidade.vinculo);
        identidadeNova = true;
      }
      const fatosNovos = unidade.fatos.filter((f) => !fatos.has(f.chaveNatural));
      for (const f of fatosNovos) fatos.set(f.chaveNatural, f);
      const fatosJaImportados = unidade.fatos.length - fatosNovos.length;
      return { ok: true, fatosNovos, fatosJaImportados, semMudanca: !identidadeNova && fatosNovos.length === 0 };
    },
  };
}
