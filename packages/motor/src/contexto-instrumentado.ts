import type {
  Classificacao,
  Contexto,
  ConsultaJanela,
  DeclaracaoConsumo,
  DerivacaoChave,
  Dinheiro,
  RubricaChave,
  TipoFatoChave,
} from "@minimusrh/dominio";

// contexto-instrumentado.ts — decorator de `Contexto` que registra toda leitura e confere
// contra a `DeclaracaoConsumo` de uma regra (Design §7). No MVP substitui a análise
// estática por parse — quando a DSL chegar (Módulo 10), as duas convergem (Design §7,
// nota final). Usado tanto em teste (fiscaliza cada regra da ALRN) quanto em PRODUÇÃO por
// `calcular-folha.ts`, que reaproveita o log de leituras como matéria-prima de
// `NoExplicacao` — decisão registrada em DECISOES-IMPLEMENTACAO.md.
export type Violacao =
  | { readonly eixo: "derivacao"; readonly chave: DerivacaoChave }
  | { readonly eixo: "rubrica"; readonly chave: RubricaChave }
  | { readonly eixo: "classificacao"; readonly chave: Classificacao }
  | { readonly eixo: "tipoFato"; readonly chave: TipoFatoChave }
  | { readonly eixo: "janela"; readonly consulta: ConsultaJanela };

export interface LeituraDerivacao {
  readonly eixo: "derivacao";
  readonly chave: DerivacaoChave;
  readonly valor: unknown;
}
export interface LeituraRubrica {
  readonly eixo: "rubrica";
  readonly chave: RubricaChave;
  readonly valor: Dinheiro | undefined;
}
export type Leitura = LeituraDerivacao | LeituraRubrica;

export interface ContextoInstrumentado {
  readonly ctx: Contexto;
  /** Log cru de leituras de derivação/rubrica, na ordem em que ocorreram — matéria-prima de NoExplicacao. */
  readonly leituras: readonly Leitura[];
  violacoes(declarado: DeclaracaoConsumo): readonly Violacao[];
}

export function instrumentar(base: Contexto): ContextoInstrumentado {
  const derivacoesLidas = new Set<DerivacaoChave>();
  const rubricasLidas = new Set<RubricaChave>();
  const classificacoesLidas = new Set<Classificacao>();
  const tiposFatoLidos = new Set<TipoFatoChave>();
  const janelasLidas: ConsultaJanela[] = [];
  const leituras: Leitura[] = [];

  const ctx: Contexto = {
    competencia: base.competencia,
    tipoFolha: base.tipoFolha,
    dataReferencia: base.dataReferencia,

    derivacao<T>(chave: DerivacaoChave): T | undefined {
      derivacoesLidas.add(chave);
      const valor = base.derivacao<T>(chave);
      leituras.push({ eixo: "derivacao", chave, valor });
      return valor;
    },

    rubrica(chave: RubricaChave): Dinheiro | undefined {
      rubricasLidas.add(chave);
      const valor = base.rubrica(chave);
      leituras.push({ eixo: "rubrica", chave, valor });
      return valor;
    },

    somaDasRubricasCom(c: Classificacao): Dinheiro {
      classificacoesLidas.add(c);
      return base.somaDasRubricasCom(c);
    },

    agregado(consulta: ConsultaJanela): Dinheiro {
      janelasLidas.push(consulta);
      return base.agregado(consulta);
    },

    contagem(consulta: ConsultaJanela): number {
      janelasLidas.push(consulta);
      return base.contagem(consulta);
    },

    vigente<C>(tipo: TipoFatoChave): C | undefined {
      tiposFatoLidos.add(tipo);
      return base.vigente<C>(tipo);
    },

    existe(tipo: TipoFatoChave): boolean {
      tiposFatoLidos.add(tipo);
      return base.existe(tipo);
    },
  };

  function violacoes(declarado: DeclaracaoConsumo): readonly Violacao[] {
    const v: Violacao[] = [];

    const derivacoesDeclaradas = new Set(declarado.derivacoes);
    for (const chave of derivacoesLidas) {
      if (!derivacoesDeclaradas.has(chave)) v.push({ eixo: "derivacao", chave });
    }

    const rubricasDeclaradas = new Set(declarado.rubricas);
    for (const chave of rubricasLidas) {
      if (!rubricasDeclaradas.has(chave)) v.push({ eixo: "rubrica", chave });
    }

    const classificacoesDeclaradas = new Set(declarado.classificacoes);
    for (const chave of classificacoesLidas) {
      if (!classificacoesDeclaradas.has(chave)) v.push({ eixo: "classificacao", chave });
    }

    const tiposDeclarados = new Set(declarado.tiposFato);
    for (const chave of tiposFatoLidos) {
      if (!tiposDeclarados.has(chave)) v.push({ eixo: "tipoFato", chave });
    }

    // ConsultaJanela é dado (sem identidade) — comparação estrutural por serialização.
    const janelasDeclaradas = new Set(declarado.janelas.map((j) => JSON.stringify(j)));
    for (const consulta of janelasLidas) {
      if (!janelasDeclaradas.has(JSON.stringify(consulta))) v.push({ eixo: "janela", consulta });
    }

    return v;
  }

  return { ctx, leituras, violacoes };
}
