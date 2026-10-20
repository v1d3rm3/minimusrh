import { Competencia, Dinheiro } from "@minimusrh/dominio";
import type { CatalogoRubricas, ConsultaJanela, DataRegistro, FolhaId, HistoriaId, RubricaChave, TipoFolhaChave } from "@minimusrh/dominio";
import type { LeitorDeJanelas } from "@minimusrh/motor";
import type { Pool } from "pg";

// leitor-janelas-pg.ts — implementação real de `LeitorDeJanelas` (motor) sobre
// `registro_calculo` de folhas FECHADAS (Fundação §7.3: "a janela olha fatos financeiros já
// selados, nunca o presente móvel"). `LeitorDeJanelas` é SÍNCRONO (o motor é puro), então,
// como `linhaDoTempoPg`, isto faz UMA pré-carga assíncrona e responde em memória depois.
//
// Reprodutibilidade (Fundação §5.4 peça 3 / §5.5): só entram folhas fechadas com instante
// de fechamento <= corte da folha calculada. Fechada é terminal, então esse conjunto nunca
// muda depois. Na reprodução de uma folha já fechada, o selo `folhasConsumidas` restringe
// ainda mais (DECISOES #4).

export interface LeitorDeJanelasCarregado extends LeitorDeJanelas {
  /** Folhas cujos registros alimentaram alguma resposta até agora — o selo do fechamento. */
  folhasConsumidas(): readonly FolhaId[];
}

export interface ParametrosLeitorJanelas {
  /** A folha sendo calculada — referência de "corrente"/"anterior" e excluída da janela. */
  readonly folha: { readonly id: FolhaId; readonly competencia: Competencia };
  readonly corte: DataRegistro;
  readonly rubricas: CatalogoRubricas;
  /**
   * As consultas DECLARADAS pelas regras resolvidas (`DeclaracaoConsumo.janelas`). Definem o
   * horizonte da pré-carga; consulta fora delas é recusada (DECISOES #3).
   */
  readonly consultasDeclaradas: readonly ConsultaJanela[];
  /** Selo de uma folha já fechada: se presente, só estas folhas podem ser lidas. */
  readonly restringirA?: readonly FolhaId[];
}

interface LinhaJanela {
  readonly folha_id: string;
  readonly historia_id: string;
  readonly rubrica: string;
  readonly versao_rubrica: number;
  readonly valor: string;
  readonly tipo: string;
  readonly competencia_ano: number;
  readonly competencia_mes: number;
}

interface RegistroJanela {
  readonly folhaId: FolhaId;
  readonly historiaId: HistoriaId;
  readonly rubrica: RubricaChave;
  readonly versaoRubrica: number;
  readonly valor: Dinheiro;
  readonly tipoFolha: TipoFolhaChave;
  readonly competencia: string;
}

/** Competências da janela, da mais antiga à mais nova (Fundação §5.4, eixo "janela"). */
export function competenciasDaJanela(referencia: Competencia, janela: ConsultaJanela["competencias"]): readonly Competencia[] {
  if (janela === "corrente") return [referencia];
  if (janela === "anterior") return [referencia.anterior()];
  if (janela === "ano_civil") return referencia.ultimas(referencia.mes);
  return referencia.ultimas(janela.ultimas);
}

function indiceCompetencia(c: Competencia): number {
  return c.ano * 12 + c.mes;
}

function chaveConsulta(consulta: ConsultaJanela): string {
  return JSON.stringify(consulta);
}

const SELECT_JANELA = `
  SELECT r.folha_id, r.historia_id, r.rubrica, r.versao_rubrica, r.valor,
         f.tipo, f.competencia_ano, f.competencia_mes
  FROM registro_calculo r
  JOIN folha f ON f.id = r.folha_id
  WHERE f.estado = 'fechada'
    AND f.id <> $1
    AND EXISTS (
      SELECT 1 FROM transicao_folha t
      WHERE t.folha_id = f.id AND t.para = 'fechada' AND t.instante <= $2
    )
    AND (f.competencia_ano * 12 + f.competencia_mes) BETWEEN $3 AND $4
    AND ($5::uuid[] IS NULL OR f.id = ANY($5::uuid[]))
  ORDER BY r.id
`;

export async function carregarLeitorDeJanelasPg(pool: Pool, params: ParametrosLeitorJanelas): Promise<LeitorDeJanelasCarregado> {
  const declaradas = new Set(params.consultasDeclaradas.map(chaveConsulta));
  const consumidas = new Set<FolhaId>();

  const indices = params.consultasDeclaradas.flatMap((c) =>
    competenciasDaJanela(params.folha.competencia, c.competencias).map(indiceCompetencia),
  );

  let registros: readonly RegistroJanela[] = [];
  if (indices.length > 0) {
    const resultado = await pool.query<LinhaJanela>(SELECT_JANELA, [
      params.folha.id,
      params.corte,
      Math.min(...indices),
      Math.max(...indices),
      params.restringirA ?? null,
    ]);
    registros = resultado.rows.map((linha) => ({
      folhaId: linha.folha_id as FolhaId,
      historiaId: linha.historia_id as HistoriaId,
      rubrica: linha.rubrica as RubricaChave,
      versaoRubrica: linha.versao_rubrica,
      valor: Dinheiro.de(linha.valor),
      tipoFolha: linha.tipo as TipoFolhaChave,
      competencia: Competencia.de(linha.competencia_ano, linha.competencia_mes).toString(),
    }));
  }

  /** A classificação vale como estava na VERSÃO da rubrica com que o registro foi selado. */
  function temClassificacao(registro: RegistroJanela, classificacao: string): boolean {
    const versao = params.rubricas.porChave(registro.rubrica)?.versoes.find((v) => v.versao === registro.versaoRubrica);
    if (versao === undefined) {
      throw new Error(
        `janela: rubrica '${registro.rubrica}' v${registro.versaoRubrica} (folha ${registro.folhaId}) ausente do catálogo`,
      );
    }
    return [...versao.classificacoes].some((c) => c === classificacao);
  }

  function selecionar(historiaId: HistoriaId, consulta: ConsultaJanela): readonly RegistroJanela[] {
    if (!declaradas.has(chaveConsulta(consulta))) {
      throw new Error(`janela: consulta não declarada por nenhuma regra resolvida: ${chaveConsulta(consulta)}`);
    }
    const competencias = new Set(competenciasDaJanela(params.folha.competencia, consulta.competencias).map((c) => c.toString()));
    const tipos = consulta.tiposDeFolha;
    const sobre = consulta.sobre;
    const selecionados = registros.filter(
      (r) =>
        r.historiaId === historiaId &&
        competencias.has(r.competencia) &&
        (tipos === "todas" || tipos.includes(r.tipoFolha)) &&
        ("rubrica" in sobre ? r.rubrica === sobre.rubrica : temClassificacao(r, sobre.classificacao)),
    );
    for (const r of selecionados) consumidas.add(r.folhaId);
    return selecionados;
  }

  return {
    agregado(historiaId: HistoriaId, consulta: ConsultaJanela): Dinheiro {
      if (consulta.agregacao === "contagem") {
        throw new Error("janela: agregação 'contagem' é respondida por contagem(), não por agregado()");
      }
      const soma = selecionar(historiaId, consulta).reduce((total, r) => total.somar(r.valor), Dinheiro.zero());
      if (consulta.agregacao === "soma") return soma;
      // média = soma ÷ competências da janela (não ÷ registros) — DECISOES #3.
      return soma.dividirPor(competenciasDaJanela(params.folha.competencia, consulta.competencias).length);
    },

    contagem(historiaId: HistoriaId, consulta: ConsultaJanela): number {
      return selecionar(historiaId, consulta).length;
    },

    folhasConsumidas(): readonly FolhaId[] {
      return [...consumidas].sort();
    },
  };
}
