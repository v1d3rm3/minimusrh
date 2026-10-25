import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { lerCsv, type LinhaCsv } from "./csv.js";
import type { CamposCrus, FonteLegado, OrigemRegistro, RegistroLegado } from "./registros.js";

// fonte-csv.ts — a fonte de referência (Playbook Módulo 7, item 1): um diretório com os quatro
// arquivos do layout documentado em docs/layout-importacao.md. Erros de ESTRUTURA do arquivo
// (ausente, cabeçalho sem coluna obrigatória, coluna desconhecida) são fatais: indicam layout
// errado, não um registro ruim. Erros de LINHA viram `RegistroIlegivel` e seguem para o
// relatório, sem derrubar o lote (DECISOES #4).

export const ARQUIVOS_CSV = {
  servidor: "servidores.csv",
  vinculo: "vinculos.csv",
  evento: "eventos.csv",
  contracheque: "contracheques.csv",
} as const;

/** Colunas `campo.<nome>` carregam o conteúdo do fato, pelo nome do campo no schema do catálogo. */
export const PREFIXO_CAMPO = "campo.";

/** Coluna cujo valor é preservado sem `trim` (vira `Amparo.comoInformado`, auditoria). */
const COLUNA_SEM_TRIM = "amparo";

export class ErroFonte extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroFonte";
  }
}

interface LayoutArquivo {
  readonly obrigatorias: readonly string[];
  readonly opcionais: readonly string[];
  readonly aceitaCampos: boolean;
}

const LAYOUTS: Readonly<Record<keyof typeof ARQUIVOS_CSV, LayoutArquivo>> = {
  servidor: { obrigatorias: ["id_servidor"], opcionais: ["data_nascimento"], aceitaCampos: false },
  vinculo: { obrigatorias: ["id_vinculo", "id_servidor", "data_inicio"], opcionais: ["data_fim"], aceitaCampos: true },
  evento: {
    obrigatorias: ["id_evento", "id_vinculo", "tipo_fato", "data_efeito"],
    opcionais: ["data_registro", "amparo_tipo", "amparo"],
    aceitaCampos: true,
  },
  contracheque: {
    obrigatorias: ["id_vinculo", "competencia", "tipo_folha", "rubrica", "valor"],
    opcionais: ["descricao"],
    aceitaCampos: false,
  },
};

/** Uma linha de dados como mapa coluna → valor; células vazias ficam ausentes. */
type Celulas = ReadonlyMap<string, string>;

function validarCabecalho(arquivo: string, layout: LayoutArquivo, cabecalho: readonly string[]): void {
  const conhecidas = new Set([...layout.obrigatorias, ...layout.opcionais]);
  const vistas = new Set<string>();
  for (const coluna of cabecalho) {
    if (vistas.has(coluna)) throw new ErroFonte(`${arquivo}: coluna repetida no cabeçalho: '${coluna}'`);
    vistas.add(coluna);
    const ehCampo = layout.aceitaCampos && coluna.startsWith(PREFIXO_CAMPO) && coluna.length > PREFIXO_CAMPO.length;
    if (!conhecidas.has(coluna) && !ehCampo) throw new ErroFonte(`${arquivo}: coluna desconhecida no cabeçalho: '${coluna}'`);
  }
  for (const coluna of layout.obrigatorias) {
    if (!vistas.has(coluna)) throw new ErroFonte(`${arquivo}: coluna obrigatória ausente no cabeçalho: '${coluna}'`);
  }
}

function celulasDaLinha(cabecalho: readonly string[], linha: LinhaCsv): Celulas | string {
  if (linha.celulas.length !== cabecalho.length) {
    return `esperadas ${cabecalho.length} colunas, encontradas ${linha.celulas.length}`;
  }
  const celulas = new Map<string, string>();
  cabecalho.forEach((coluna, i) => {
    const bruto = linha.celulas[i] as string;
    if (bruto.trim() === "") return;
    celulas.set(coluna, coluna === COLUNA_SEM_TRIM ? bruto : bruto.trim());
  });
  return celulas;
}

function campos(celulas: Celulas): CamposCrus {
  const resultado: Record<string, string> = {};
  for (const [coluna, valor] of celulas) {
    if (coluna.startsWith(PREFIXO_CAMPO)) resultado[coluna.slice(PREFIXO_CAMPO.length)] = valor;
  }
  return resultado;
}

/** Só inclui a chave quando há valor: registro sem a propriedade, não com `undefined`. */
function opcional<K extends string>(chave: K, valor: string | undefined): { readonly [P in K]?: string } {
  return (valor === undefined ? {} : { [chave]: valor }) as { readonly [P in K]?: string };
}

function montar(tipo: keyof typeof ARQUIVOS_CSV, origem: OrigemRegistro, c: Celulas): RegistroLegado {
  // Colunas obrigatórias já foram conferidas como não vazias antes de chegar aqui.
  const v = (coluna: string): string => c.get(coluna) as string;
  switch (tipo) {
    case "servidor":
      return { tipo, origem, idServidor: v("id_servidor"), ...opcional("dataNascimento", c.get("data_nascimento")) };
    case "vinculo":
      return {
        tipo,
        origem,
        idVinculo: v("id_vinculo"),
        idServidor: v("id_servidor"),
        dataInicio: v("data_inicio"),
        ...opcional("dataFim", c.get("data_fim")),
        campos: campos(c),
      };
    case "evento": {
      const amparoTipo = c.get("amparo_tipo");
      const amparo = c.get("amparo");
      if ((amparoTipo === undefined) !== (amparo === undefined)) {
        return { tipo: "ilegivel", origem, motivo: "'amparo_tipo' e 'amparo' devem vir juntos (ou ambos vazios)" };
      }
      return {
        tipo,
        origem,
        idEvento: v("id_evento"),
        idVinculo: v("id_vinculo"),
        tipoFato: v("tipo_fato"),
        dataEfeito: v("data_efeito"),
        ...opcional("dataRegistro", c.get("data_registro")),
        ...(amparoTipo !== undefined && amparo !== undefined ? { amparo: { tipo: amparoTipo, comoInformado: amparo } } : {}),
        campos: campos(c),
      };
    }
    case "contracheque":
      return {
        tipo,
        origem,
        idVinculo: v("id_vinculo"),
        competencia: v("competencia"),
        tipoFolha: v("tipo_folha"),
        rubrica: v("rubrica"),
        ...opcional("descricao", c.get("descricao")),
        valor: v("valor"),
      };
  }
}

/** Interpreta o texto de um dos quatro arquivos. Exportado para teste sem disco. */
export function registrosDoArquivo(tipo: keyof typeof ARQUIVOS_CSV, arquivo: string, texto: string): readonly RegistroLegado[] {
  const layout = LAYOUTS[tipo];
  let linhas: readonly LinhaCsv[];
  try {
    linhas = lerCsv(texto);
  } catch (e) {
    throw new ErroFonte(`${arquivo}: ${(e as Error).message}`);
  }
  const [cabecalhoLinha, ...dados] = linhas;
  if (cabecalhoLinha === undefined) throw new ErroFonte(`${arquivo}: arquivo vazio (falta o cabeçalho)`);
  const cabecalho = cabecalhoLinha.celulas.map((coluna) => coluna.trim());
  validarCabecalho(arquivo, layout, cabecalho);

  return dados.map((linha) => {
    const origem: OrigemRegistro = { arquivo, linha: linha.numero };
    const celulas = celulasDaLinha(cabecalho, linha);
    if (typeof celulas === "string") return { tipo: "ilegivel", origem, motivo: celulas };
    const vazia = layout.obrigatorias.find((coluna) => !celulas.has(coluna));
    if (vazia !== undefined) return { tipo: "ilegivel", origem, motivo: `coluna obrigatória vazia: '${vazia}'` };
    return montar(tipo, origem, celulas);
  });
}

async function lerArquivo(dir: string, arquivo: string): Promise<string> {
  try {
    return await readFile(join(dir, arquivo), "utf-8");
  } catch (e) {
    throw new ErroFonte(`${arquivo}: não foi possível ler em '${dir}' (${(e as Error).message})`);
  }
}

/** Os quatro arquivos são obrigatórios; um arquivo só com o cabeçalho é um conjunto vazio. */
export function fonteCsv(dir: string): FonteLegado {
  return {
    descricao: `csv:${dir}`,
    async *registros(): AsyncIterable<RegistroLegado> {
      for (const tipo of Object.keys(ARQUIVOS_CSV) as (keyof typeof ARQUIVOS_CSV)[]) {
        const arquivo = ARQUIVOS_CSV[tipo];
        yield* registrosDoArquivo(tipo, arquivo, await lerArquivo(dir, arquivo));
      }
    },
  };
}
