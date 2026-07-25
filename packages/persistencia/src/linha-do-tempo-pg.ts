import { versaoVigente } from "@minimusrh/dominio";
import type {
  CatalogoTiposDeFato,
  DataEfeito,
  DataRegistro,
  Fato,
  HistoriaId,
  LinhaDoTempo,
  PessoaId,
  TipoFatoChave,
} from "@minimusrh/dominio";
import type { Pool } from "pg";
import { fatoRepositorioPg } from "./fato-repositorio.js";

// linha-do-tempo-pg.ts — LinhaDoTempo é SÍNCRONA (Design §4: "a implementação mora na
// persistência; o domínio fixa apenas a semântica"), então esta função faz UMA pré-carga
// assíncrona (todos os fatos não substituídos até `corte`, sem colapsar por tipo) e
// resolve tudo em memória depois. `vigenteEm` delega a `versaoVigente` do dominio —
// NUNCA reimplementa a semântica temporal em SQL (motor/arquitetura.test.ts grepa por
// isso; mesma regra vale aqui).
//
// DECISOES #8 (suposição a confirmar): nenhuma tabela em escopo do Módulo 3 modela o
// vínculo história↔pessoa — `linhaDoTempoPg` recebe os dois ids explicitamente do
// chamador.

function agruparPorTipo<C>(fatos: readonly Fato<C>[]): Map<TipoFatoChave, Fato<C>[]> {
  const mapa = new Map<TipoFatoChave, Fato<C>[]>();
  for (const fato of fatos) {
    const lista = mapa.get(fato.tipo);
    if (lista !== undefined) lista.push(fato);
    else mapa.set(fato.tipo, [fato]);
  }
  return mapa;
}

export async function linhaDoTempoPg(
  pool: Pool,
  catalogo: CatalogoTiposDeFato,
  alvo: { readonly pessoaId: PessoaId; readonly historiaId: HistoriaId },
  corte: DataRegistro,
): Promise<LinhaDoTempo> {
  const repositorio = fatoRepositorioPg(pool, catalogo);
  const fatos = await repositorio.carregarParaLinhaDoTempo<unknown>(alvo, corte);
  const porTipo = agruparPorTipo(fatos);

  function todosDoTipo<C>(tipo: TipoFatoChave): readonly Fato<C>[] {
    return (porTipo.get(tipo) as Fato<C>[] | undefined) ?? [];
  }

  function vigenteEm<C>(tipo: TipoFatoChave, em: DataEfeito): Fato<C> | undefined {
    return versaoVigente(todosDoTipo<C>(tipo), em, corte);
  }

  function aberturaDaHistoria(): Fato {
    const abertura = fatos.find((fato) => catalogo.porChave(fato.tipo)?.abreHistoria === true);
    if (abertura === undefined) {
      throw new Error(`historia ${alvo.historiaId}: nenhum fato de abertura conhecido ate o corte ${corte}`);
    }
    return abertura;
  }

  function encerramentoDaHistoria(): Fato | undefined {
    return fatos.find((fato) => catalogo.porChave(fato.tipo)?.encerraHistoria === true);
  }

  return {
    historiaId: alvo.historiaId,
    corte,
    vigenteEm,
    todosDoTipo,
    aberturaDaHistoria,
    encerramentoDaHistoria,
  };
}
