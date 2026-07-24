# MinimusRH — Design do Domínio (pacote `dominio`) — v1.5

> Terceiro documento da série: o **Conceitual v2.9** diz o quê e por quê; o **Roteiro v1.1** diz em que ordem; este traduz o modelo em **TypeScript revisável**, tipo a tipo, cada um amarrado à seção do conceitual que o justifica.
>
> Escopo: apenas o pacote `dominio` (§2.5.1 do Roteiro) — tipos, valores e contratos, **zero dependências de framework** (única dependência externa: `decimal.js`). O `motor` (grafo, execução), a `persistencia` e as regras concretas ficam fora e consomem o que está aqui.

---

## 0. Princípios do design

1. **Ilegal = intipável.** O que o conceitual proíbe, o sistema de tipos impede: `Dinheiro` não se mistura com `number`; fato não tem setter; estado de folha só transita pelos caminhos declarados.
2. **Tudo que o conceitual versiona vira par `Coisa` + `VersaoDeCoisa`.** Regra, rubrica, tipo de fato — mesmo padrão, sempre.
3. **O domínio não conhece banco, HTTP, nem relógio.** Nenhum `new Date()` sem parâmetro; toda referência temporal chega de fora (Decisão da DSL, §7.1 do conceitual, aplicada ao código host).
4. **Interfaces de leitura, nunca de mutação.** O domínio descreve; quem muda o mundo (append de fatos) é a persistência, pela porta única.

### 0.1 Interface vs. classe — o critério

Três perguntas, nesta ordem, decidem cada conceito:

| Pergunta decisiva | Resposta | Exemplos |
|---|---|---|
| Tem invariante que exige **portão na construção** + comportamento colado ao dado? | **Classe** (construtor privado + factory) | `Dinheiro`, `Percentual`, `Competencia`, `Amparo` |
| É **registro imutável que atravessa fronteiras** (banco, JSONB, serialização)? | **Interface `readonly`** | `Fato`, `Folha`, `RegistroCalculo`, `TransicaoFolha` |
| É **contrato implementado em outro pacote**? | **Interface** | `Contexto`, `LinhaDoTempo`, `Derivacao`, `VersaoRegra` |

Regra de bolso: **classe quando a *origem* do valor importa; interface quando o *shape* basta.** `Dinheiro` errado é catástrofe silenciosa de centavos → a origem importa → classe-portão (interface não promete origem: qualquer objeto com o shape "é" estruturalmente válido, inclusive um float disfarçado). `Fato` com campo errado é barrado pela porta de registro (validação contra o catálogo) antes de existir → shape `readonly` basta.

Nota sobre a aparente "entidade anêmica": `Fato` não tem comportamento **de propósito**. O conselho DDD contra entidades anêmicas mira desenhos de entidade *mutável*, onde métodos protegem estado que muda; nosso fato é imutável por fundação — não *faz* nada, *é* o registro do acontecido. Todo comportamento vive em quem o lê (derivações, motor, regras): núcleo funcional, dados inertes + funções puras. Classe também não sobrevive a serialização (`JSON.stringify` perde métodos; volta um objeto que *parece* a classe mas não é), o que tornaria a hidratação cerimonial em toda borda. Mesmo raciocínio de `TRANSICOES` como tabela de dados, não métodos: máquina de estados como *dado* é exaustivamente testável linha a linha.

---

## 1. Valores fundamentais (value objects)

### 1.1 Identificadores — branded types

```ts
// brand.ts
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
```

*Por quê:* trocar `historiaId` por `pessoaId` num argumento vira erro de compilação, não bug de produção. Custo zero em runtime.

### 1.2 Dinheiro (§7.7 do conceitual; §2.5.2 do Roteiro)

```ts
// dinheiro.ts
import Decimal from 'decimal.js';

export type PoliticaArredondamento = 'meio_para_cima' | 'truncar' | 'banqueiro';

export class Dinheiro {
  private constructor(private readonly d: Decimal) {}

  /** Única porta de entrada: string ("1250.00") ou centavos como bigint. NUNCA number. */
  static de(valor: string): Dinheiro { return new Dinheiro(new Decimal(valor)); }
  static deCentavos(c: bigint): Dinheiro { return new Dinheiro(new Decimal(c.toString()).div(100)); }
  static zero(): Dinheiro { return Dinheiro.de('0'); }

  somar(o: Dinheiro): Dinheiro { return new Dinheiro(this.d.plus(o.d)); }
  subtrair(o: Dinheiro): Dinheiro { return new Dinheiro(this.d.minus(o.d)); }
  vezes(p: Percentual): Dinheiro { return new Dinheiro(this.d.mul(p.comoFator())); }
  dividirPor(n: number): Dinheiro { return new Dinheiro(this.d.div(n)); }
  menorEntre(o: Dinheiro): Dinheiro { return this.d.lte(o.d) ? this : o; }
  maiorEntre(o: Dinheiro): Dinheiro { return this.d.gte(o.d) ? this : o; }
  maiorQue(o: Dinheiro): boolean { return this.d.gt(o.d); }
  ehZero(): boolean { return this.d.isZero(); }
  ehNegativo(): boolean { return this.d.isNegative(); }

  /** Arredondamento SEMPRE explícito (§7.7: nada arredonda implicitamente no meio da conta). */
  arredondar(politica: PoliticaArredondamento): Dinheiro {
    const modo = { meio_para_cima: Decimal.ROUND_HALF_UP,
                   truncar:        Decimal.ROUND_DOWN,
                   banqueiro:      Decimal.ROUND_HALF_EVEN }[politica];
    return new Dinheiro(this.d.toDecimalPlaces(2, modo));
  }

  /** Serialização canônica: string com 2+ casas. Para o NUMERIC do Postgres, sem passar por number. */
  paraString(): string { return this.d.toFixed(2); }
}

export class Percentual {
  private constructor(private readonly d: Decimal) {}
  /** Percentual.de('15') === 15% */
  static de(valor: string): Percentual { return new Percentual(new Decimal(valor)); }
  comoFator(): Decimal { return this.d.div(100); }
}
```

*Decisões:* construtor privado + factory `de(string)` fecha a porta do `number` na origem; sem método que devolva `number` (só `paraString`), o float nunca entra na cadeia. `somar`/`vezes` não arredondam — a política mora na rubrica (§2.4 abaixo) e o **motor** a aplica ao resultado final.

### 1.3 Tempo: efeito, registro, competência (Decisão 1 do conceitual)

```ts
// tempo.ts
export type DataEfeito   = Brand<string, 'DataEfeito'>;    // 'YYYY-MM-DD' — quando passa a valer
export type DataRegistro = Brand<string, 'DataRegistro'>;  // ISO timestamp — quando se soube

export const dataEfeito   = (iso: string): DataEfeito => valida(iso) as DataEfeito;
export const dataRegistro = (iso: string): DataRegistro => valida(iso) as DataRegistro;

export class Competencia {
  private constructor(readonly ano: number, readonly mes: number) {}
  static de(ano: number, mes: number): Competencia { /* valida 1..12 */ return new Competencia(ano, mes); }

  anterior(): Competencia { /* ... */ }
  ultimas(n: number): Competencia[] { /* janela p/ agregações, §5.4 */ }
  /** Data de referência do cálculo: último dia do mês (convenção; configurável no futuro). */
  dataReferencia(): DataEfeito { /* ... */ }
  contem(d: DataEfeito): boolean { /* ... */ }
  toString(): string { /* 'YYYY-MM' */ }
  igual(o: Competencia): boolean { /* ... */ }
}
```

*Por quê strings branded e não `Date`:* `Date` do JS é timestamp com fuso — fonte clássica de "efeito em 31/03 virou 01/04". Data de efeito é conceito de calendário, não de instante; string `YYYY-MM-DD` comparável lexicograficamente resolve sem armadilha. `DataEfeito` e `DataRegistro` são brands **diferentes**: impossível passar uma onde vai a outra — a confusão entre as duas é literalmente o bug que a bitemporalidade existe para evitar.

### 1.4 Vigência — a resolução bitemporal de versões, e os contratos de catálogo

Tipos de fato, rubricas, regras e tipos de amparo — tudo versiona, e "qual versão vale em tal data?" precisa ter **uma única semântica** no sistema inteiro. E como a Decisão 3 do conceitual manda ("versões são fatos sobre a regra"), toda versão carrega **as duas datas**: sem `dataRegistro` (quando foi *publicada*), o corte da folha (§5.5) não filtra versões e a subtração do retroativo (§5.3) fica inimplementável.

```ts
// vigencia.ts
export interface ComVigencia {
  readonly dataEfeito: DataEfeito;
  readonly dataFimEfeito?: DataEfeito;
  readonly dataRegistro: DataRegistro;   // quando a versão foi PUBLICADA — o corte filtra por isto
}

/**
 * A função de resolução temporal do sistema — ÚNICA, compartilhada por regras, rubricas
 * e os seis catálogos. Semântica: entre as versões CONHECIDAS até o corte
 * (dataRegistro <= corte), a de maior dataEfeito <= em, respeitando dataFimEfeito.
 * É a maquinaria do §5.3: corte da época => "como foi pago"; corte de hoje => "como
 * deveria ser"; a subtração entre os dois é o retroativo.
 */
export function versaoVigente<V extends ComVigencia>(
  versoes: readonly V[], em: DataEfeito, corte: DataRegistro,
): V | undefined { /* ... */ }

// catalogo.ts — contratos de LEITURA (família da LinhaDoTempo): o domínio define;
// implementa a configuração em memória (MVP) ou a persistência (depois).
export interface Catalogo<Chave extends string, T> {
  porChave(chave: Chave): T | undefined;
  todos(): readonly T[];
}

export type CatalogoTiposDeFato = Catalogo<TipoFatoChave, TipoFato>;
export type CatalogoRubricas    = Catalogo<RubricaChave, Rubrica>;
export type CatalogoAmparos     = Catalogo<TipoAmparoChave, TipoAmparo>;
// ... e os demais, na mesma forma
```

*Divisão de trabalho:* o **catálogo** só acha por chave (burro de propósito); a **vigência** é resolvida pela função única (esperta e testada uma vez só); interpretações específicas (`normalizarAmparo`, validação de schema) recebem a versão já resolvida. Três responsabilidades, três peças, nenhuma sabendo demais. Uso típico: `versaoVigente(catalogo.porChave(tipo)!.versoes, em, corte)`.

**Todas as interfaces `VersaoDeX` deste documento estendem `ComVigencia`** — o `dataRegistro` que aparece nelas abaixo existe por força desta seção.

---

## 2. O fato e sua anatomia (Decisão 1, §3.3)

```ts
// fato.ts
export type AlvoFato =
  | { readonly escopo: 'pessoa';   readonly pessoaId: PessoaId }
  | { readonly escopo: 'historia'; readonly historiaId: HistoriaId };

export type Autor =
  | { readonly tipo: 'humano';     readonly usuarioId: string }
  | { readonly tipo: 'sistema';    readonly regraConsistencia: string;
      readonly versao: number;     readonly gatilhos: readonly FatoId[] }   // §8.2
  | { readonly tipo: 'importacao'; readonly lote: string };                 // Marco 3 do Roteiro
```

### 2.1 Amparo — identificação tipada pelo sexto catálogo

O formato do identificador depende do tipo ('processo' = `999/9999`; 'portaria' = outro padrão) — mas formato é **vocabulário da instituição** e muda com o tempo. Hardcodar `999/9999` no domínio seria o primo elegante do `if tipo == 'auxilio_saude'` (§4 do conceitual). Logo: **tipos de amparo são o sexto catálogo** (junto aos cinco do §9.1), com máscara e normalização versionadas. E a normalização vale mais que a validação: a **forma canônica é identidade** — "todos os fatos amparados pelo processo 123/2026" vira consulta trivial, exatamente a pergunta que auditoria e procuradoria fazem.

```ts
// catalogo-amparos.ts — configuração, versionada como os demais catálogos. TUDO dado serializável.
export type TipoAmparoChave = Brand<string, 'TipoAmparoChave'>;  // 'processo', 'portaria', 'resolucao'...

export type TipoGrupo = 'numero' | 'ano' | 'texto';
// ^ vocabulário FECHADO de canonicalizações — cresce por versão do SISTEMA, nunca por
//   instituição (mesmo estatuto do catálogo de funções da DSL, §7.8 do conceitual).
//   numero => sem zeros à esquerda; ano => exige 4 dígitos; texto => trim + caixa alta.

export interface GrupoMascara {
  readonly nome: string;        // 'numero', 'ano'
  readonly tipo: TipoGrupo;
}

export interface VersaoTipoAmparo extends ComVigencia {
  readonly versao: number;
  readonly dataEfeito: DataEfeito;
  readonly dataRegistro: DataRegistro;   // publicação (§1.4)
  readonly mascara: string;                  // FONTE da regex (string — RegExp não serializa)
  readonly grupos: readonly GrupoMascara[];  // na ordem dos grupos de captura da máscara
  readonly formatoCanonico: string;          // template sobre os grupos: '{numero}/{ano}'
  readonly exemplo: string;                  // '123/2026' — mensagens de erro e placeholder de tela
}

export interface TipoAmparo {
  readonly chave: TipoAmparoChave;
  readonly versoes: readonly VersaoTipoAmparo[];
}

// Exemplo de entrada (a ALRN edita isto, sem programador):
// { versao: 1, dataEfeito: '2026-01-01', mascara: '^(\\d{1,4})\\/(\\d{4})$',
//   grupos: [{ nome: 'numero', tipo: 'numero' }, { nome: 'ano', tipo: 'ano' }],
//   formatoCanonico: '{numero}/{ano}', exemplo: '123/2026' }

// normalizacao-amparo.ts — no dominio: o INTERPRETADOR. Função pura, UMA para todos os tipos.
// O catálogo descreve; o core interpreta — a filosofia da DSL aplicada à normalização.
export function normalizarAmparo(
  v: VersaoTipoAmparo,
  entrada: string,
): { readonly canonica: string } | ErroValidacao {
  // 1. compila v.mascara, aplica sobre entrada.trim(); não casou => ErroValidacao (cita v.exemplo)
  // 2. canonicaliza grupo a grupo conforme GrupoMascara.tipo ('0045' => '45')
  // 3. injeta em v.formatoCanonico => '45/2026'
}

// amparo.ts — no dominio: a FORMA "amparo tem tipo e identificação validável"; os formatos são catálogo
export class Amparo {
  private constructor(
    readonly tipo: TipoAmparoChave,
    /** Identidade canônica — agrupa fatos do mesmo documento; indexada no banco. */
    readonly identificacaoCanonica: string,
    /** Como foi digitado/importado — preservado para auditoria ("o documento físico diz o quê?"). */
    readonly comoInformado: string,
    readonly validadoContraVersao?: number,  // ausente = legado importado sem validação
  ) {}

  /** Porta dos fatos NOVOS: usa normalizarAmparo com a versão vigente do tipo. */
  static criar(tipo: TipoAmparoChave, entrada: string, catalogo: CatalogoAmparos,
               em: DataEfeito): Amparo | ErroValidacao { /* ... */ }

  /** Porta do importador (Marco 3): aceita sem validar, preserva original, normaliza se possível. */
  static legado(tipo: TipoAmparoChave, entrada: string): Amparo { /* ... */ }

  mesmoDocumentoQue(o: Amparo): boolean {
    return this.tipo === o.tipo && this.identificacaoCanonica === o.identificacaoCanonica;
  }
}
```

**Decisões:** (a) **normalização é especificação declarativa no catálogo + interpretador puro no domínio** — método em entrada de catálogo violaria o §0.1 (catálogo é dado que atravessa fronteiras; método não serializa) e exigiria programador para formato novo, matando o propósito do catálogo. A máscara é string-fonte pelo mesmo motivo (RegExp não serializa); (b) **vocabulário de `TipoGrupo` fechado no core** — canonicalização nova ('cnpj', 'uf'...) é decisão de plataforma com testes, nunca gambiarra por instituição; (c) **`'ano'` exige 4 dígitos em tipos novos** — inferir século de "89" é adivinhação, e adivinhação não entra em identidade canônica; "Proc. 45/89" entra pela porta `legado()`; (d) **duas portas** — rigor total para o futuro, honestidade total com o passado; (e) **`comoInformado` sempre preservado** — a canônica serve à máquina, a digitada serve à auditoria; (f) **validação roda na porta de registro do fato**, junto com a validação de schema do conteúdo; (g) **horizonte anotado, não construído**: amparo como *entidade* referenciada (registro de documentos com ementa, anexos, link SEI) pode nascer depois como projeção sobre a identidade canônica, sem quebrar nada.

```ts
// fato.ts (continuação)

export interface Fato<C = unknown> {
  readonly id: FatoId;
  readonly alvo: AlvoFato;
  readonly tipo: TipoFatoChave;
  readonly versaoDoTipo: number;        // sob qual versão do catálogo nasceu (§3.4)
  readonly conteudo: C;                 // validado contra o schema da versão do tipo
  readonly dataEfeito: DataEfeito;
  readonly dataRegistro: DataRegistro;
  readonly autor: Autor;
  readonly amparo?: Amparo;
  readonly substituiFatoId?: FatoId;    // correção referencia o corrigido; nada se edita
}
```

*Decisões:* tudo `readonly` — fato não tem setter, por tipo. `Autor` como união discriminada carrega a auditoria das reações (§8.2: "produzido pela regra R vN, gatilhos X,Y") no próprio tipo. `substituiFatoId` materializa o corolário "corrige-se com fato novo".

---

## 3. Catálogo de tipos de fato — recorte do MVP (§3.4)

```ts
// catalogo-fatos.ts
export type TipoCampo = 'texto' | 'dinheiro' | 'percentual' | 'numero' | 'data' | 'logico';

export interface CampoSchema {
  readonly nome: string;
  readonly tipo: TipoCampo;
  readonly obrigatorio: boolean;
  readonly depreciado?: boolean;        // §9.2: campos nunca somem, depreciam
}

export interface VersaoTipoFato extends ComVigencia {
  readonly versao: number;
  readonly dataEfeito: DataEfeito;
  readonly dataRegistro: DataRegistro;   // publicação — o corte filtra por isto (§1.4)
  readonly schema: readonly CampoSchema[];
  readonly exigeAmparo: boolean;
}

export interface TipoFato {
  readonly chave: TipoFatoChave;
  readonly alvo: 'pessoa' | 'historia';
  readonly abreHistoria?: boolean;      // posse/admissão (§3.2)
  readonly encerraHistoria?: boolean;   // exoneração/aposentadoria
  readonly versoes: readonly VersaoTipoFato[];
}
```

*Recorte assumido (Roteiro §1):* no MVP o catálogo vive em configuração (arquivo TS/JSON tipado), sem telas nem fluxo de aprovação. A **forma** já é a definitiva — governança (§9) muda quem edita, não o tipo. Validações de estado ("exoneração exige ativo") ficam para pós-MVP junto com as receitas.

---

## 4. Linha do tempo e derivações (Decisão 2, §3.5)

```ts
// linha-do-tempo.ts
/**
 * Visão de LEITURA sobre os fatos de uma história (e da pessoa dona dela),
 * já filtrada pelo corte de conhecimento (dataRegistro <= corte, §5.5).
 * É o que a persistência entrega ao motor; o domínio só define o contrato.
 */
export interface LinhaDoTempo {
  readonly historiaId: HistoriaId;
  readonly corte: DataRegistro;

  /** O fato mais recente (em efeito) do tipo, valendo na data — a regra de ouro da Decisão 2. */
  vigenteEm<C>(tipo: TipoFatoChave, em: DataEfeito): Fato<C> | undefined;
  todosDoTipo<C>(tipo: TipoFatoChave): readonly Fato<C>[];   // já sem os substituídos
  aberturaDaHistoria(): Fato;
  encerramentoDaHistoria(): Fato | undefined;
}

// derivacao.ts — CONTRATO (§0.1, critério 3): implementado em código no pacote da
// instituição (regras-alrn), pois quase toda derivação referencia vocabulário institucional
// ('cargo' lê fatos 'promocao'/'posse'; 'saldo_divida_auxilio' lê a dívida do auxílio).
// VERSIONADO como tudo que participa do cálculo: mudar "como se contam os dias trabalhados"
// por edição destrutiva quebraria a reprodutibilidade pelo mesmo buraco do §1.4.
export interface VersaoDerivacao<T> extends ComVigencia {
  readonly versao: number;
  readonly dataEfeito: DataEfeito;
  readonly dataRegistro: DataRegistro;
  /** Dependências declaradas — insumo do grafo e da análise de impacto (§9.3). */
  readonly dependeDe: readonly TipoFatoChave[];
  derivar(linha: LinhaDoTempo, referencia: DataEfeito, competencia: Competencia): T | undefined;
}

export interface Derivacao<T> {
  readonly chave: DerivacaoChave;
  readonly versoes: readonly VersaoDerivacao<T>[];
}

// registro-derivacoes.ts — liga o catálogo de chaves (dado) às implementações (código).
// Contrato de leitura (família do Catalogo, §1.4); regras-alrn implementa.
// Verificação de integridade na inicialização: toda chave catalogada tem implementação
// registrada, e vice-versa — "nada morre com dependentes vivos", aplicado ao nascimento.
export interface RegistroDeDerivacoes {
  porChave(chave: DerivacaoChave): Derivacao<unknown> | undefined;
}
```

*Decisões:* `LinhaDoTempo` é interface — a implementação (query `DISTINCT ON`, Roteiro §2.5.3) mora na persistência; o domínio fixa apenas a semântica. `derivar` recebe a competência além da data para derivações de calendário (`dias_trabalhados`, `avos`). Devolver `undefined` = "não derivável" (ex.: `idade` sem fato de nascimento) — distinto de zero, mesmo espírito do `quando` (§7.6). *Pragmatismo do MVP:* tudo nasce `versao: 1` e não muda — custo zero; mas a forma já é a definitiva, então a primeira mudança de política (ex.: nova contagem de dias) entra como versão nova, sem refatoração no pior momento. No horizonte, derivações-expressão (saldo) poderão virar DSL; as algorítmicas (calendário) permanecem código — mesmo paralelo das regras.

---

## 5. Rubrica (§3.6)

```ts
// rubrica.ts
export type NaturezaRubrica = 'vantagem' | 'desconto' | 'informativa';

export interface VersaoRubrica extends ComVigencia {
  readonly versao: number;
  readonly dataEfeito: DataEfeito;
  readonly dataRegistro: DataRegistro;   // publicação (§1.4)
  readonly nome: string;
  readonly natureza: NaturezaRubrica;
  readonly classificacoes: ReadonlySet<Classificacao>;   // 'incide_previdencia', 'compoe_terco'...
  readonly arredondamento: PoliticaArredondamento;       // aplicada PELO MOTOR ao resultado (§7.7)
  readonly proporcionalizavel: boolean;                  // sofre fator de dias (§3.6)
}

export interface Rubrica {
  readonly chave: RubricaChave;
  readonly versoes: readonly VersaoRubrica[];
}
```

---

## 6. Contexto — as quatro leituras (§7.3)

```ts
// contexto.ts
/** Consulta de janela: os quatro eixos da consolidação (§5.4) como leitura (§7.3, forma 3). */
export interface ConsultaJanela {
  readonly agregacao: 'soma' | 'media' | 'contagem';
  readonly sobre: { readonly rubrica: RubricaChave } | { readonly classificacao: Classificacao };
  readonly competencias: 'corrente' | 'anterior' | { readonly ultimas: number } | 'ano_civil';
  readonly tiposDeFolha: readonly TipoFolhaChave[] | 'todas';
}

/**
 * TUDO que uma regra pode enxergar. Não há outra porta (§7.1: "enxerga só o contexto").
 * Implementado pelo motor; instrumentável em teste para validar a declaração de consumo (§7.4 abaixo).
 */
export interface Contexto {
  readonly competencia: Competencia;
  readonly tipoFolha: TipoFolhaChave;
  readonly dataReferencia: DataEfeito;

  // 1. Derivações de instante
  derivacao<T>(chave: DerivacaoChave): T | undefined;

  // 2. Rubricas da folha corrente (já calculadas — o grafo garante a ordem)
  rubrica(chave: RubricaChave): Dinheiro | undefined;
  somaDasRubricasCom(c: Classificacao): Dinheiro;

  // 3. Fatos financeiros agregados sobre janela (folhas FECHADAS — §7.3)
  agregado(consulta: ConsultaJanela): Dinheiro;
  contagem(consulta: ConsultaJanela): number;

  // 4. Conteúdo de fato vigente na data de referência
  vigente<C>(tipo: TipoFatoChave): C | undefined;
  existe(tipo: TipoFatoChave): boolean;
}
```

---

## 7. Regra — o contrato que a DSL compilará (§7; Roteiro §2.3)

```ts
// regra.ts
/** Espelho do cabeçalho da DSL (§7.6). No MVP, escrito à mão; no Marco 5, extraído por parse. */
export interface DeclaracaoConsumo {
  readonly derivacoes: readonly DerivacaoChave[];
  readonly rubricas: readonly RubricaChave[];
  readonly classificacoes: readonly Classificacao[];
  readonly tiposFato: readonly TipoFatoChave[];
  readonly janelas: readonly ConsultaJanela[];
}

export type EscopoRegra =
  | { readonly tipo: 'global' }
  | { readonly tipo: 'individual'; readonly historiaId: HistoriaId };  // o caso raro (§3.7)

export interface VersaoRegra extends ComVigencia {
  readonly regra: RegraChave;
  readonly versao: number;
  readonly dataEfeito: DataEfeito;
  readonly dataFimEfeito?: DataEfeito;               // "depreciada" = fim de efeito (§3.7)
  readonly dataRegistro: DataRegistro;               // publicação — sem isto, o §5.3 não existe (§1.4)
  readonly aplicaSeAFolhas: readonly TipoFolhaChave[]; // a 2ª dimensão da vigência (§3.7)
  readonly escopo: EscopoRegra;
  readonly produz: RubricaChave;                     // a tupla <valor, rubrica>
  readonly consome: DeclaracaoConsumo;               // insumo do grafo (§5.1)

  /** Guarda de aplicabilidade: falso => NÃO produz rubrica ("não se aplica" ≠ "vale zero", §7.6). */
  quando(ctx: Contexto): boolean;

  /** FUNÇÃO PURA. Sem I/O, sem relógio, sem estado — imposto pelo layout de pacotes (Roteiro §2.5.1). */
  calcular(ctx: Contexto): Dinheiro;
}
```

*Como a declaração de consumo não mente:* em teste, o motor envolve o `Contexto` numa versão **instrumentada** que registra cada leitura; leitura fora do declarado ⇒ teste falha. No MVP isso substitui a análise estática por parse; quando a DSL chegar, as duas convergem.

---

## 8. Folha e ciclo de vida (§3.10, §5.5)

```ts
// folha.ts
export type EstadoFolha = 'aberta' | 'em_conferencia' | 'fechada' | 'cancelada';

/** Transições legais — a máquina do §5.5 como dado, verificável e exaustiva. */
export const TRANSICOES: Readonly<Record<EstadoFolha, readonly EstadoFolha[]>> = {
  aberta:          ['em_conferencia', 'cancelada'],
  em_conferencia:  ['aberta', 'fechada'],
  fechada:         [],                                // terminal e sagrado — sem reabertura, NUNCA
  cancelada:       [],
};

export interface Folha {
  readonly id: FolhaId;
  readonly competencia: Competencia;
  readonly tipo: TipoFolhaChave;
  readonly estado: EstadoFolha;
  readonly corte?: DataRegistro;                     // travado ao entrar em conferência
  readonly folhasConsumidas?: readonly FolhaId[];    // selo da consolidação (§5.4)
}

export interface TransicaoFolha {                    // "fechar é um fato" (§5.5)
  readonly folhaId: FolhaId;
  readonly de: EstadoFolha;
  readonly para: EstadoFolha;
  readonly instante: DataRegistro;
  readonly autor: Autor;
  readonly amparo?: Amparo;
}
```

## 9. Registro de cálculo e explicação (§3.11)

```ts
// registro-calculo.ts
export type FonteExplicacao =
  | { readonly tipo: 'fato';      readonly fatoId: FatoId }
  | { readonly tipo: 'derivacao'; readonly chave: DerivacaoChave; readonly valor: string }
  | { readonly tipo: 'rubrica';   readonly chave: RubricaChave;   readonly valor: string }
  | { readonly tipo: 'tabela';    readonly chave: string;         readonly versao: number }
  | { readonly tipo: 'no';        readonly no: NoExplicacao };    // recursão: a árvore

export interface NoExplicacao {
  readonly descricao: string;                        // "base = soma das rubricas 'incide_previdencia'"
  readonly valor?: string;                           // Dinheiro.paraString()
  readonly fontes: readonly FonteExplicacao[];
}

export interface RegistroCalculo {
  readonly folhaId: FolhaId;
  readonly historiaId: HistoriaId;
  readonly rubrica: RubricaChave;
  readonly versaoRubrica: number;
  readonly regra: RegraChave;
  readonly versaoRegra: number;
  readonly valor: Dinheiro;                          // já com a política de arredondamento aplicada
  readonly explicacao: NoExplicacao;                 // "provar como chegou nesse número"
}
```

---

## 10. O que NÃO está no `dominio` (e onde está)

| Fora do dominio | Onde mora | Por quê |
|---|---|---|
| Grafo de dependências, ordenação, detecção de ciclos | `motor` | Algoritmo, não vocabulário |
| Execução da folha, resolução de versões vigentes, aplicação do arredondamento | `motor` | Idem |
| Implementação de `LinhaDoTempo`, queries bitemporais, append de fatos | `persistencia` | O domínio define o contrato de leitura; só a persistência escreve |
| Regras concretas da ALRN | `regras-alrn` | Domínio da instituição, não do sistema (§4 do conceitual) |
| Tabelas de valores (auxílio por idade) | `regras-alrn` (config versionada) | Idem |
| Importador, harness | pacotes próprios | Ferramentas do MVP |

---

## 11. Decisões deste design (para revisão do time)

1. **`Dinheiro` como classe com construtor privado** (não branded string): precisa de aritmética; a classe fecha a porta do `number` melhor que helpers soltos. *Trade-off:* objetos na memória — irrelevante no volume de folha.
2. **Datas como strings branded, não `Date`**: elimina a classe inteira de bugs de fuso; comparação lexicográfica funciona. *Trade-off:* aritmética de datas via utilitário (`date-fns` no motor) — aceitável.
3. **`DeclaracaoConsumo` manual no MVP + contexto instrumentado em teste**: substitui a análise por parse até o Marco 5, com verificação real de que a declaração não mente.
4. **`TRANSICOES` como dado, não como métodos**: a máquina de estados vira tabela exaustiva que teste unitário cobre linha a linha — e `fechada: []` é a decisão "sem reabertura" legível em uma linha de código.
5. **Explicação como árvore serializável (strings, não `Dinheiro`)**: o `NoExplicacao` vai para JSONB e para a tela sem transformação; a perda de tipo ali é aceitável porque explicação é saída, nunca insumo.
6. **`Contexto` sem acesso à `LinhaDoTempo` crua**: regra não passeia pelos fatos — só lê pelas quatro portas. A linha do tempo é insumo das *derivações*, que o motor executa antes. Mantém a regra na coleira do §7.1.
7. **Amparo com formato por tipo via sexto catálogo, não via código** (§2.1): máscaras e normalização são especificação DECLARATIVA versionada, interpretada por função pura no domínio — método em entrada de catálogo não serializa e exigiria programador para formato novo. A forma canônica cria a trilha processo→fatos; duas portas de entrada (validada para o novo, `legado` para a importação).
8. **`versaoVigente` como função única e bitemporal** (§1.4): uma só semântica de vigência para regras, rubricas e os seis catálogos; toda versão carrega `dataRegistro` além de `dataEfeito` (Decisão 3: versões são fatos). *Correção de furo:* as versões da v1.3 tinham só `dataEfeito` — sem a data de publicação, o corte não filtra versões e o retroativo (§5.3) fica inimplementável. Catálogos são contratos de leitura burros (`porChave`); a inteligência temporal mora na função compartilhada.
9. **Derivações versionadas e registradas** (§4): `derivar()` com método é correto pelo §0.1 (contrato implementado em `regras-alrn` — código, não dado de catálogo); o que faltava era (a) o `RegistroDeDerivacoes` ligando chaves catalogadas a implementações, com verificação de integridade nos dois sentidos, e (b) o versionamento — derivação que carrega política (dias trabalhados, avos, saldos) é "como se calcula" tanto quanto regra, e edição destrutiva quebraria a reprodutibilidade. Fecha a simetria: **tudo que participa do cálculo versiona com as duas datas e resolve pela mesma `versaoVigente`**.

---

## 12. Próximo passo natural

Com este design aprovado: materializar os arquivos do pacote (`rush init`, `packages/dominio` com os módulos acima), escrever os primeiros testes unitários dos value objects (`Dinheiro` primeiro — inclusive o teste que documenta por que `number` é proibido) e, em paralelo, o esqueleto do `motor` consumindo apenas estas interfaces — chegando ao golden test do Marco 0.
