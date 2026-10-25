import type { Pool } from "pg";
import { configuracaoAlrn } from "./configuracao.js";
import { destinoPg } from "./destino-pg.js";
import { fonteCsv } from "./fonte-csv.js";
import { importar } from "./importar.js";
import type { FonteLegado } from "./registros.js";
import { renderizarRelatorio } from "./relatorio.js";

// cli.ts — `importar --fonte csv --dir <diretório> --lote <id>` (Playbook Módulo 7, critério de
// aceite). A conexão vem das variáveis PG* do ambiente (PGHOST, PGPORT, PGDATABASE, PGUSER,
// PGPASSWORD), lidas pelo próprio `pg`; o papel esperado é `minimus_app`, sobre um schema já
// migrado. Testável sem processo: `bin/importar.ts` só repassa `process.argv`.

/** Fontes plugáveis por nome: uma fonte nova do legado real entra aqui. */
export const FONTES: Readonly<Record<string, (dir: string) => FonteLegado>> = { csv: fonteCsv };

export const USO = "uso: importar --fonte <csv> --dir <diretório do lote> --lote <identificador do lote>";

/** Códigos de saída: rejeição não derruba o lote, mas o script que chamou precisa saber. */
export const SAIDA = { ok: 0, erro: 1, comRejeicoes: 2 } as const;

export interface Argumentos {
  readonly fonte: string;
  readonly dir: string;
  readonly lote: string;
}

const OPCOES = ["--fonte", "--dir", "--lote"] as const;

export function lerArgumentos(argv: readonly string[]): Argumentos | { readonly erro: string } {
  const valores = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const opcao = argv[i] as string;
    const valor = argv[i + 1];
    if (!(OPCOES as readonly string[]).includes(opcao)) return { erro: `opção desconhecida: '${opcao}'` };
    if (valor === undefined || valor.startsWith("--")) return { erro: `falta o valor de '${opcao}'` };
    if (valores.has(opcao)) return { erro: `opção repetida: '${opcao}'` };
    valores.set(opcao, valor);
  }
  const falta = OPCOES.find((opcao) => !valores.has(opcao));
  if (falta !== undefined) return { erro: `falta a opção '${falta}'` };
  const fonte = valores.get("--fonte") as string;
  if (FONTES[fonte] === undefined) return { erro: `fonte desconhecida: '${fonte}' (disponíveis: ${Object.keys(FONTES).join(", ")})` };
  return { fonte, dir: valores.get("--dir") as string, lote: valores.get("--lote") as string };
}

export interface DependenciasCli {
  readonly criarPool: () => Pool;
  readonly escrever: (texto: string) => void;
  readonly escreverErro: (texto: string) => void;
}

export async function executarCli(argv: readonly string[], deps: DependenciasCli): Promise<number> {
  const argumentos = lerArgumentos(argv);
  if ("erro" in argumentos) {
    deps.escreverErro(`${argumentos.erro}\n${USO}\n`);
    return SAIDA.erro;
  }

  const configuracao = configuracaoAlrn();
  const pool = deps.criarPool();
  const codigo = await importar({
    fonte: (FONTES[argumentos.fonte] as (dir: string) => FonteLegado)(argumentos.dir),
    destino: destinoPg(pool, configuracao.tiposDeFato, argumentos.lote),
    configuracao,
    lote: argumentos.lote,
  }).then(
    (relatorio) => {
      deps.escrever(renderizarRelatorio(relatorio));
      return relatorio.rejeicoes.length === 0 ? SAIDA.ok : SAIDA.comRejeicoes;
    },
    (e: unknown) => {
      deps.escreverErro(`importação abortada, nada foi gravado depois deste ponto: ${(e as Error).message}\n`);
      return SAIDA.erro;
    },
  );
  await pool.end();
  return codigo;
}
