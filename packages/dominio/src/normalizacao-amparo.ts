import { TipoGrupo, VersaoTipoAmparo } from "./catalogo-amparos.js";
import { ErroValidacao } from "./tipos.js";

export type { ErroValidacao } from "./tipos.js";

function canonicalizarGrupo(tipo: TipoGrupo, valor: string): string | null {
  switch (tipo) {
    case 'numero':
      return valor.replace(/^0+(?=\d)/, '');
    case 'ano':
      return valor.length === 4 ? valor : null;
    case 'texto':
      return valor.trim().toUpperCase();
  }
}

export function normalizarAmparo(
  v: VersaoTipoAmparo,
  entrada: string,
): { readonly canonica: string } | ErroValidacao {
  const regex = new RegExp(`^(?:${v.mascara})$`);
  const match = regex.exec(entrada.trim());
  if (!match) {
    return { erro: `entrada não corresponde ao formato esperado (ex.: '${v.exemplo}')` };
  }

  const valores: Record<string, string> = {};
  for (const [indice, grupo] of v.grupos.entries()) {
    const bruto = match[indice + 1] ?? '';
    const canonico = canonicalizarGrupo(grupo.tipo, bruto);
    if (canonico === null) {
      return { erro: `entrada não corresponde ao formato esperado (ex.: '${v.exemplo}')` };
    }
    valores[grupo.nome] = canonico;
  }

  const canonica = v.formatoCanonico.replace(
    /\{(\w+)\}/g,
    (_match, nome: string) => valores[nome] ?? '',
  );
  return { canonica };
}
