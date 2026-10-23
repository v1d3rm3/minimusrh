import { Dinheiro } from "@minimusrh/dominio";
import type { Competencia, DataRegistro, FolhaId, HistoriaId, NoExplicacao, RegistroCalculo, RubricaChave, TipoFolhaChave } from "@minimusrh/dominio";
import type { ErroCalculoFolha } from "@minimusrh/motor";
import { folhaRepositorioPg } from "@minimusrh/persistencia";
import type { Pool } from "pg";
import { listarFolhasFechadas } from "./alcance-retroativo.js";
import { serializarRegistros } from "./serializacao.js";
import { canonizarInstante, ErroServicoFolha, type ServicoFolha } from "./servico-folha.js";

// apurar-diferencas.ts — o TESTE DE FOGO (Roteiro Marco 2; Fundação §5.3): a diferença
// retroativa é a subtração de duas execuções da MESMA `calcularFolha`, uma com o corte
// selado da folha ("como foi pago") e outra com o corte de agora ("como deveria ser").
// Nenhuma lógica de cálculo mora aqui: se algum dia for preciso, é furo no desenho e vai
// para o DECISOES antes (Playbook Módulo 6). Sem relógio: o "agora" chega do chamador.

export interface DiferencaApurada {
  readonly historiaId: HistoriaId;
  readonly rubrica: RubricaChave;
  readonly valorPago: Dinheiro;
  readonly valorDevido: Dinheiro;
  /** devido − pago: positivo = a pagar (vantagem) ou a descontar (desconto). */
  readonly diferenca: Dinheiro;
  /** Explicação do valor devido; ausente quando a rubrica deixou de ser devida. */
  readonly explicacaoNova: NoExplicacao | undefined;
}

export interface ApuracaoCompetencia {
  readonly folhaId: FolhaId;
  readonly competencia: Competencia;
  readonly tipoFolha: TipoFolhaChave;
  readonly corteSelado: DataRegistro;
  readonly corteNovo: DataRegistro;
  /** Só as diferenças não nulas, em ordem de (história, rubrica). */
  readonly diferencas: readonly DiferencaApurada[];
}

/** O recálculo com o corte selado não bateu com o persistido: a folha fechada não se reproduz. */
export class ErroReprodutibilidadeViolada extends ErroServicoFolha {
  constructor(folhaId: FolhaId) {
    super(`folha ${folhaId}: reprodutibilidade violada — o recálculo com o corte selado diverge dos registros persistidos`);
    this.name = "ErroReprodutibilidadeViolada";
  }
}

/** "Como deveria ser" não calculou limpo: uma diferença parcial seria um retroativo errado. */
export class ErroApuracaoComErros extends ErroServicoFolha {
  constructor(
    folhaId: FolhaId,
    readonly erros: readonly ErroCalculoFolha[],
  ) {
    super(`folha ${folhaId}: apuração recusada — o recálculo com o corte novo produziu ${erros.length} erro(s)`);
    this.name = "ErroApuracaoComErros";
  }
}

function chave(registro: RegistroCalculo): string {
  return JSON.stringify([registro.historiaId, registro.rubrica]);
}

/** A subtração, história × rubrica. Rubrica ausente de um lado vale zero desse lado. Função pura. */
export function diferencasEntre(pago: readonly RegistroCalculo[], devido: readonly RegistroCalculo[]): readonly DiferencaApurada[] {
  const pagos = new Map(pago.map((r) => [chave(r), r]));
  const devidos = new Map(devido.map((r) => [chave(r), r]));
  const chaves = [...new Set([...pagos.keys(), ...devidos.keys()])].sort();

  return chaves.flatMap((k) => {
    const p = pagos.get(k);
    const d = devidos.get(k);
    const valorPago = p?.valor ?? Dinheiro.zero();
    const valorDevido = d?.valor ?? Dinheiro.zero();
    const diferenca = valorDevido.subtrair(valorPago);
    if (diferenca.ehZero()) return [];
    const { historiaId, rubrica } = (d ?? p)!;
    return [{ historiaId, rubrica, valorPago, valorDevido, diferenca, explicacaoNova: d?.explicacao }];
  });
}

/** A única folha FECHADA da competência e do tipo (DECISOES #12). */
async function localizarFolhaFechada(pool: Pool, competencia: Competencia, tipoFolha: TipoFolhaChave) {
  const candidatas = (await listarFolhasFechadas(pool)).filter((f) => f.competencia.igual(competencia) && f.tipo === tipoFolha);
  if (candidatas.length !== 1) {
    throw new ErroServicoFolha(
      `apuração ${competencia.toString()}/${tipoFolha}: esperada exatamente uma folha fechada, encontradas ${candidatas.length}`,
    );
  }
  return candidatas[0]!;
}

export interface ApuradorDeDiferencas {
  apurar(competencia: Competencia, tipoFolha: TipoFolhaChave, corteNovo: DataRegistro): Promise<ApuracaoCompetencia>;
}

export function criarApuradorDeDiferencas(deps: { readonly pool: Pool; readonly servico: ServicoFolha }): ApuradorDeDiferencas {
  return {
    async apurar(competencia, tipoFolha, corteNovo) {
      const folha = await localizarFolhaFechada(deps.pool, competencia, tipoFolha);
      const persistidos = await folhaRepositorioPg(deps.pool).listarRegistros(folha.id);

      // "como foi pago": TEM de ser o que foi persistido, byte a byte — senão não há base
      // para subtrair (Fundação §5.5: mesma folha + mesmo corte ⇒ mesmo resultado).
      const comoFoiPago = await deps.servico.reproduzir(folha.id);
      if (comoFoiPago.erros.length > 0 || serializarRegistros(comoFoiPago.registros) !== serializarRegistros(persistidos)) {
        throw new ErroReprodutibilidadeViolada(folha.id);
      }

      // "como deveria ser": a mesma chamada, com o que se sabe agora.
      const corte = canonizarInstante(corteNovo);
      const comoDeveriaSer = await deps.servico.recalcularComCorte(folha.id, corte);
      if (comoDeveriaSer.erros.length > 0) throw new ErroApuracaoComErros(folha.id, comoDeveriaSer.erros);

      return {
        folhaId: folha.id,
        competencia,
        tipoFolha,
        corteSelado: folha.corte,
        corteNovo: corte,
        diferencas: diferencasEntre(persistidos, comoDeveriaSer.registros),
      };
    },
  };
}
