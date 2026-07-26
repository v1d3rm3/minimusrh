import { versaoVigente } from "@minimusrh/dominio";
import type {
  CatalogoTiposDeFato,
  DataEfeito,
  DataRegistro,
  Fato,
  FatoId,
  HistoriaId,
  LinhaDoTempo,
  TipoFatoChave,
} from "@minimusrh/dominio";

// linha-do-tempo-em-memoria.ts — builder genérico de LinhaDoTempo sobre um array de Fato
// em memória, espelhando EXATAMENTE a semântica de packages/persistencia/src/linha-do-tempo-pg.ts:
// mesma exclusão de substituídos (SQL `NOT EXISTS ... sub.substitui_fato_id = f.id AND
// sub.data_registro <= corte`), mesmo uso de `versaoVigente` do dominio para `vigenteEm`
// (NUNCA reimplementa resolução temporal — arquitetura.test.ts grepa por isso), e mesma
// leitura de `catalogo.porChave(tipo)?.abreHistoria/.encerraHistoria` para achar abertura
// e encerramento. Reutilizável por qualquer fixture (Victor aqui, e os módulos 5–6).
function visiveis(fatos: readonly Fato[], corte: DataRegistro): readonly Fato[] {
  const substituidos = new Set<FatoId>(
    fatos.filter((f) => f.substituiFatoId !== undefined && f.dataRegistro <= corte).map((f) => f.substituiFatoId as FatoId),
  );
  return fatos.filter((f) => f.dataRegistro <= corte && !substituidos.has(f.id));
}

export function linhaDoTempoEmMemoria(
  catalogo: CatalogoTiposDeFato,
  historiaId: HistoriaId,
  todosOsFatos: readonly Fato[],
  corte: DataRegistro,
): LinhaDoTempo {
  const fatos = visiveis(todosOsFatos, corte);

  function todosDoTipo<C>(tipo: TipoFatoChave): readonly Fato<C>[] {
    return fatos.filter((fato) => fato.tipo === tipo) as Fato<C>[];
  }

  function vigenteEm<C>(tipo: TipoFatoChave, em: DataEfeito): Fato<C> | undefined {
    return versaoVigente(todosDoTipo<C>(tipo), em, corte);
  }

  function aberturaDaHistoria(): Fato {
    const abertura = fatos.find((fato) => catalogo.porChave(fato.tipo)?.abreHistoria === true);
    if (abertura === undefined) {
      throw new Error(`historia ${historiaId}: nenhum fato de abertura conhecido ate o corte ${corte}`);
    }
    return abertura;
  }

  function encerramentoDaHistoria(): Fato | undefined {
    return fatos.find((fato) => catalogo.porChave(fato.tipo)?.encerraHistoria === true);
  }

  return { historiaId, corte, vigenteEm, todosDoTipo, aberturaDaHistoria, encerramentoDaHistoria };
}
