import { dataRegistro } from "@minimusrh/dominio";
import type {
  Autor,
  Competencia,
  ConsultaJanela,
  DataRegistro,
  EstadoFolha,
  Folha,
  FolhaId,
  LinhaDoTempo,
  TipoFolhaChave,
} from "@minimusrh/dominio";
import {
  calcularFolha,
  resolverParaExecucao,
  transitar,
  type ErroCalculoFolha,
  type ErroTransicao,
  type ResultadoCalculo,
} from "@minimusrh/motor";
import { folhaRepositorioPg, linhaDoTempoPg } from "@minimusrh/persistencia";
import type { Pool } from "pg";
import type { CadastroDeHistorias, ConfiguracaoInstituicao } from "./configuracao.js";
import { carregarLeitorDeJanelasPg } from "./leitor-janelas-pg.js";

// servico-folha.ts — o primeiro fluxo completo (Roteiro Marco 1, "O Victor recebe"):
// abrir → simular → travar corte → fechar → reproduzir. Classes/funções puras orquestrando
// motor + persistencia, sem NestJS (Roteiro §2.5.6). Sem relógio: todo instante chega do
// chamador (Regra Global #2 — o relógio mora só na `api`).

/**
 * Forma canônica de um instante (UTC, milissegundos — a mesma do Postgres). A porta
 * `dataRegistro()` do dominio já canoniza; isto reaplica a porta a valores que possam ter
 * chegado por cast (`"..." as DataRegistro`), que contornam a validação (DECISOES #7).
 */
export function canonizarInstante(instante: DataRegistro): DataRegistro {
  return dataRegistro(instante);
}

export class ErroServicoFolha extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroServicoFolha";
  }
}

/** Fechar com erro de cálculo é recusado: folha fechada é terminal (Fundação §5.5). */
export class ErroFechamentoComErros extends ErroServicoFolha {
  constructor(
    folhaId: FolhaId,
    readonly erros: readonly ErroCalculoFolha[],
  ) {
    super(`folha ${folhaId}: fechamento recusado — o cálculo produziu ${erros.length} erro(s)`);
    this.name = "ErroFechamentoComErros";
  }
}

/** Resultado de um cálculo em folha ABERTA: nunca persistido, sempre marcado (Fundação §5.5). */
export interface ResultadoSimulacao {
  readonly simulacao: true;
  readonly folhaId: FolhaId;
  /** O instante de conhecimento usado — "cada simulação registra o corte que usou". */
  readonly corte: DataRegistro;
  readonly resultado: ResultadoCalculo;
}

export interface ResultadoFechamento {
  readonly folha: Folha;
  readonly resultado: ResultadoCalculo;
}

export interface ServicoFolha {
  abrir(competencia: Competencia, tipo: TipoFolhaChave): Promise<FolhaId>;
  calcularSimulacao(folhaId: FolhaId, corteProvisorio: DataRegistro): Promise<ResultadoSimulacao>;
  travarCorte(folhaId: FolhaId, corte: DataRegistro, autor: Autor): Promise<Folha>;
  /** Calcula com o corte travado e persiste registros + transição numa única transação. */
  fechar(folhaId: FolhaId, autor: Autor, instante: DataRegistro): Promise<ResultadoFechamento>;
  /** Recalcula do zero uma folha FECHADA com o mesmo corte e o mesmo selo — não persiste nada. */
  reproduzir(folhaId: FolhaId): Promise<ResultadoCalculo>;
}

export interface DependenciasServicoFolha {
  readonly pool: Pool;
  readonly configuracao: ConfiguracaoInstituicao;
  readonly cadastro: CadastroDeHistorias;
}

export function criarServicoFolha(deps: DependenciasServicoFolha): ServicoFolha {
  const repositorio = folhaRepositorioPg(deps.pool);
  const { configuracao } = deps;

  async function carregarFolha(folhaId: FolhaId): Promise<Folha> {
    const folha = await repositorio.buscarPorId(folhaId);
    if (folha === undefined) throw new ErroServicoFolha(`folha ${folhaId} não encontrada`);
    return folha;
  }

  /** Para operações que NÃO são transição (simular, reproduzir); transições quem valida é `transitar`. */
  function exigirEstado(folha: Folha, estado: EstadoFolha, operacao: string): void {
    if (folha.estado !== estado) {
      throw new ErroServicoFolha(`folha ${folha.id}: '${operacao}' exige estado '${estado}', mas está '${folha.estado}'`);
    }
  }

  /**
   * Linhas do tempo de todas as histórias cadastradas, como conhecidas até `corte`, em ordem
   * de historiaId (ordem estável ⇒ registros em ordem estável ⇒ golden comparável). História
   * sem fato de abertura conhecido até o corte ainda não existe para esta folha (DECISOES #5).
   */
  async function carregarHistorias(corte: DataRegistro): Promise<readonly LinhaDoTempo[]> {
    const alvos = [...(await deps.cadastro.listar())].sort((a, b) => (a.historiaId < b.historiaId ? -1 : 1));
    const linhas: LinhaDoTempo[] = [];
    for (const alvo of alvos) {
      const linha = await linhaDoTempoPg(deps.pool, configuracao.tiposDeFato, alvo, corte);
      try {
        linha.aberturaDaHistoria();
      } catch {
        continue;
      }
      linhas.push(linha);
    }
    return linhas;
  }

  /** Janelas declaradas pelas regras resolvidas — o horizonte do leitor (DECISOES #3). */
  function janelasDeclaradas(folha: Folha, corte: DataRegistro): readonly ConsultaJanela[] {
    const { regrasResolvidas } = resolverParaExecucao(configuracao.regras, configuracao.rubricas, folha.competencia, folha.tipo, corte);
    return regrasResolvidas.flatMap((regra) => regra.consome.janelas);
  }

  async function calcular(folha: Folha, corte: DataRegistro, restringirA?: readonly FolhaId[]) {
    const leitorJanelas = await carregarLeitorDeJanelasPg(deps.pool, {
      folha,
      corte,
      rubricas: configuracao.rubricas,
      consultasDeclaradas: janelasDeclaradas(folha, corte),
      ...(restringirA !== undefined ? { restringirA } : {}),
    });
    const resultado = calcularFolha({
      folhaId: folha.id,
      competencia: folha.competencia,
      tipoFolha: folha.tipo,
      corte,
      historias: await carregarHistorias(corte),
      regras: configuracao.regras,
      rubricas: configuracao.rubricas,
      derivacoes: configuracao.derivacoes,
      leitorJanelas,
    });
    return { resultado, folhasConsumidas: leitorJanelas.folhasConsumidas() };
  }

  /** A máquina de estados do dominio (via motor::transitar) é a única que decide o que é legal. */
  function exigirTransicao(resultado: ReturnType<typeof transitar>): Exclude<ReturnType<typeof transitar>, ErroTransicao> {
    if ("erro" in resultado) throw new ErroServicoFolha(`folha: ${resultado.mensagem}`);
    return resultado;
  }

  return {
    async abrir(competencia: Competencia, tipo: TipoFolhaChave): Promise<FolhaId> {
      if (configuracao.tiposDeFolha.porChave(tipo) === undefined) {
        throw new ErroServicoFolha(`tipo de folha '${tipo}' não existe no catálogo`);
      }
      return repositorio.criar({ competencia, tipo, estado: "aberta" });
    },

    async calcularSimulacao(folhaId: FolhaId, corteProvisorio: DataRegistro): Promise<ResultadoSimulacao> {
      const folha = await carregarFolha(folhaId);
      exigirEstado(folha, "aberta", "calcularSimulacao");
      const corte = canonizarInstante(corteProvisorio);
      const { resultado } = await calcular(folha, corte);
      return { simulacao: true, folhaId, corte, resultado };
    },

    async travarCorte(folhaId: FolhaId, corte: DataRegistro, autor: Autor): Promise<Folha> {
      const folha = await carregarFolha(folhaId);
      // motor::transitar trava o corte no `instante` da transição para 'em_conferencia'.
      const transicao = exigirTransicao(transitar(folha, "em_conferencia", autor, canonizarInstante(corte)));
      await repositorio.persistirTransicao(transicao);
      return transicao.folha;
    },

    async fechar(folhaId: FolhaId, autor: Autor, instante: DataRegistro): Promise<ResultadoFechamento> {
      const folha = await carregarFolha(folhaId);
      // valida a transição ANTES de calcular: só 'em_conferencia' → 'fechada' é legal.
      const { folha: fechada, transicao } = exigirTransicao(transitar(folha, "fechada", autor, canonizarInstante(instante)));
      // invariante da máquina: entrar em 'em_conferencia' sempre trava o corte (motor DECISOES #9).
      const corte = folha.corte!;
      if (transicao.instante < corte) {
        throw new ErroServicoFolha(`folha ${folhaId}: instante de fechamento (${transicao.instante}) anterior ao corte (${corte})`);
      }

      const { resultado, folhasConsumidas } = await calcular(folha, corte);
      if (resultado.erros.length > 0) throw new ErroFechamentoComErros(folhaId, resultado.erros);

      // o selo das folhas consumidas entra na MESMA transação dos registros (Fundação §5.4).
      const folhaSelada: Folha = { ...fechada, folhasConsumidas };
      await repositorio.persistirTransicao({ folha: folhaSelada, transicao }, resultado.registros);
      return { folha: folhaSelada, resultado };
    },

    async reproduzir(folhaId: FolhaId): Promise<ResultadoCalculo> {
      const folha = await carregarFolha(folhaId);
      exigirEstado(folha, "fechada", "reproduzir");
      const { resultado } = await calcular(folha, folha.corte!, folha.folhasConsumidas ?? []);
      return resultado;
    },
  };
}
