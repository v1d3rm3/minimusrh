declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type PessoaId   = Brand<string, 'PessoaId'>;    // UUID
export type HistoriaId = Brand<string, 'HistoriaId'>;
export type FatoId     = Brand<string, 'FatoId'>;
export type FolhaId    = Brand<string, 'FolhaId'>;

// Chaves de catálogo (nomenclatura controlada, §3.4/§9 do conceitual)
export type TipoFatoChave   = Brand<string, 'TipoFatoChave'>;    // ex.: 'promocao'
export type RubricaChave    = Brand<string, 'RubricaChave'>;     // ex.: 'salario_base'
export type Classificacao   = Brand<string, 'Classificacao'>;    // ex.: 'incide_previdencia'
export type TipoFolhaChave  = Brand<string, 'TipoFolhaChave'>;   // ex.: 'mensal'
export type DerivacaoChave  = Brand<string, 'DerivacaoChave'>;   // ex.: 'idade'
export type RegraChave      = Brand<string, 'RegraChave'>;       // ex.: 'terco_ferias'