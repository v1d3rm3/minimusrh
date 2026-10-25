// registros.ts — o contrato `FonteLegado` (Playbook Módulo 7, item 1): o que o legado entrega,
// ainda CRU. O legado guarda estado, não fatos (Roteiro §4, "dados legados sem
// bitemporalidade"); a fonte só lê e estrutura, sem decidir nada de domínio. Datas, valores e
// chaves de catálogo chegam como texto e são interpretados pelos tradutores (tradutores.ts).

/** De onde veio o registro — toda rejeição do relatório aponta para cá. */
export interface OrigemRegistro {
  readonly arquivo: string;
  /** Linha física do início do registro no arquivo (1 = cabeçalho). */
  readonly linha: number;
}

/** Campos de conteúdo do fato, por nome do schema do catálogo, ainda como texto. */
export type CamposCrus = Readonly<Record<string, string>>;

/** Uma pessoa do legado. A data de nascimento, se conhecida, vira o fato de nascimento. */
export interface RegistroServidor {
  readonly tipo: "servidor";
  readonly origem: OrigemRegistro;
  readonly idServidor: string;
  readonly dataNascimento?: string;
}

/** Um vínculo (matrícula) do legado = uma História: abre na data de início, encerra na de fim. */
export interface RegistroVinculo {
  readonly tipo: "vinculo";
  readonly origem: OrigemRegistro;
  readonly idVinculo: string;
  readonly idServidor: string;
  readonly dataInicio: string;
  /** Último dia de exercício (o dia de saída conta como trabalhado — regras-alrn DECISOES #3). */
  readonly dataFim?: string;
  /** Conteúdo do fato de abertura (ex.: `cargo`). */
  readonly campos: CamposCrus;
}

/** Um evento funcional do legado, já com a chave do tipo de fato do catálogo. */
export interface RegistroEvento {
  readonly tipo: "evento";
  readonly origem: OrigemRegistro;
  readonly idEvento: string;
  readonly idVinculo: string;
  readonly tipoFato: string;
  readonly dataEfeito: string;
  /** Quando o legado soube. Ausente ⇒ CONVENCAO_REGISTRO_DESCONHECIDO. */
  readonly dataRegistro?: string;
  readonly amparo?: { readonly tipo: string; readonly comoInformado: string };
  readonly campos: CamposCrus;
}

/** Uma linha de contracheque do legado: material de comparação, nunca fato (Playbook item 4). */
export interface RegistroContracheque {
  readonly tipo: "contracheque";
  readonly origem: OrigemRegistro;
  readonly idVinculo: string;
  readonly competencia: string;
  readonly tipoFolha: string;
  readonly rubrica: string;
  readonly descricao?: string;
  readonly valor: string;
}

/** Linha que a fonte não conseguiu estruturar. Vai para o relatório; não derruba o lote. */
export interface RegistroIlegivel {
  readonly tipo: "ilegivel";
  readonly origem: OrigemRegistro;
  readonly motivo: string;
}

export type RegistroLegado =
  | RegistroServidor
  | RegistroVinculo
  | RegistroEvento
  | RegistroContracheque
  | RegistroIlegivel;

export type TipoRegistro = RegistroLegado["tipo"];

/**
 * A fonte é plugável (Playbook Módulo 7): o formato real do legado ainda será definido pelo
 * humano. `FonteCsv` (fonte-csv.ts) é a implementação de referência. Uma fonte não
 * precisa entregar os registros em ordem de dependência: o pipeline ordena (importar.ts).
 */
export interface FonteLegado {
  /** Descrição legível da origem do lote (ex.: `csv:/caminho/do/lote`), para o relatório. */
  readonly descricao: string;
  registros(): AsyncIterable<RegistroLegado>;
}
