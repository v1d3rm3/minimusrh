import type { RegistroCalculo } from "@minimusrh/dominio";

// serializacao.ts — forma canônica de um resultado de folha, para o golden test de
// reprodutibilidade (Roteiro Marco 0/1). "Byte a byte" só faz sentido se a serialização
// não depender de detalhes acidentais:
// - registros ordenados por (história, rubrica), não pela ordem de inserção;
// - chaves de objeto em ordem alfabética, em qualquer profundidade (o JSONB do Postgres
//   reordena as chaves da explicação; a memória não);
// - valores monetários como string (`Dinheiro.paraString()`), nunca número.
// `apelidos` troca ids gerados no momento (UUIDs de folha e fato) por nomes estáveis, para
// que o arquivo golden commitado sobreviva a uma nova semeadura do banco (DECISOES #6).

function ordenarChaves(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenarChaves);
  if (typeof valor === "object" && valor !== null) {
    return Object.fromEntries(
      Object.keys(valor)
        .sort()
        .map((chave) => [chave, ordenarChaves((valor as Record<string, unknown>)[chave])]),
    );
  }
  return valor;
}

function compararRegistros(a: RegistroCalculo, b: RegistroCalculo): number {
  if (a.historiaId !== b.historiaId) return a.historiaId < b.historiaId ? -1 : 1;
  if (a.rubrica !== b.rubrica) return a.rubrica < b.rubrica ? -1 : 1;
  return 0;
}

export function serializarRegistros(
  registros: readonly RegistroCalculo[],
  apelidos: ReadonlyMap<string, string> = new Map(),
): string {
  const ordenados = [...registros].sort(compararRegistros).map((registro) => ({
    ...registro,
    valor: registro.valor.paraString(),
  }));
  const texto = JSON.stringify(
    ordenarChaves(ordenados),
    (_chave, valor: unknown) => (typeof valor === "string" ? (apelidos.get(valor) ?? valor) : valor),
    2,
  );
  return `${texto}\n`;
}
