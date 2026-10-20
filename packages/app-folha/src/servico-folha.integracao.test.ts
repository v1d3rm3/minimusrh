import { Competencia, Dinheiro, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { Autor, EstadoFolha, Fato, FolhaId, HistoriaId, PessoaId, TipoFolhaChave, VersaoRegra } from "@minimusrh/dominio";
import { transitar } from "@minimusrh/motor";
import { fatoRepositorioPg, folhaRepositorioPg } from "@minimusrh/persistencia";
import {
  CATALOGO_REGRAS,
  REGRA_SALARIO_BASE_V1,
  TIPO_FATO_POSSE,
  criarCatalogoTiposDeFato,
} from "@minimusrh/regras-alrn";
import { serializarRegistros } from "./serializacao.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agruparRegras, cadastroEmMemoria, configuracaoAlrn, type ConfiguracaoInstituicao } from "./configuracao.js";
import { canonizarInstante, criarServicoFolha, ErroFechamentoComErros, ErroServicoFolha, type ServicoFolha } from "./servico-folha.js";
import { subirAmbiente, type AmbienteIntegracao } from "./testes/ambiente-integracao.js";
import { semearVictor, VICTOR_ALVO } from "./testes/semear-victor.js";

// servico-folha.integracao.test.ts — o ciclo abrir → simular → travar → fechar contra um
// Postgres real, com o papel `minimus_app` (sem UPDATE/DELETE em fato/registro_calculo).

const MENSAL = "mensal" as TipoFolhaChave;
const JULHO = Competencia.de(2026, 7);
const AUTOR: Autor = { tipo: "humano", usuarioId: "teste-servico" };
const ANTES_DA_PROMOCAO = dataRegistro("2026-07-01T00:00:00Z"); // promoção registrada em 10/07
const DEPOIS_DA_PROMOCAO = dataRegistro("2026-08-01T00:00:00Z");
// Como o banco (e o serviço) guardam o instante — DECISOES #7.
const DEPOIS_DA_PROMOCAO_CANONICO = dataRegistro("2026-08-01T00:00:00.000Z");

// Uma segunda história, cuja posse só é REGISTRADA em setembro: não existe para um corte de agosto.
const TARDIA_ALVO = {
  pessoaId: "00000000-0000-4000-8000-00000000b002" as PessoaId,
  historiaId: "00000000-0000-4000-8000-00000000a002" as HistoriaId,
};

function comSalarioBase(base: ConfiguracaoInstituicao, regra: Partial<VersaoRegra>): ConfiguracaoInstituicao {
  const outras = CATALOGO_REGRAS.filter((r) => r.regra !== REGRA_SALARIO_BASE_V1.regra);
  return { ...base, regras: agruparRegras([{ ...REGRA_SALARIO_BASE_V1, ...regra }, ...outras]) };
}

describe("servico-folha (integração)", () => {
  let ambiente: AmbienteIntegracao;
  let servico: ServicoFolha;

  function servicoCom(configuracao: ConfiguracaoInstituicao): ServicoFolha {
    return criarServicoFolha({ pool: ambiente.poolApp, configuracao, cadastro: cadastroEmMemoria([VICTOR_ALVO, TARDIA_ALVO]) });
  }

  async function folhaEmConferencia(s: ServicoFolha = servico): Promise<FolhaId> {
    const id = await s.abrir(JULHO, MENSAL);
    await s.travarCorte(id, DEPOIS_DA_PROMOCAO, AUTOR);
    return id;
  }

  async function contarRegistros(folhaId: FolhaId): Promise<number> {
    return (await folhaRepositorioPg(ambiente.poolApp).listarRegistros(folhaId)).length;
  }

  beforeAll(async () => {
    ambiente = await subirAmbiente();
    await semearVictor(ambiente.poolApp);
    await fatoRepositorioPg(ambiente.poolApp, criarCatalogoTiposDeFato()).registrar({
      alvo: { escopo: "historia", historiaId: TARDIA_ALVO.historiaId },
      tipo: TIPO_FATO_POSSE,
      versaoDoTipo: 1,
      conteudo: { cargo: "B5" },
      dataEfeito: dataEfeito("2026-01-01"),
      dataRegistro: dataRegistro("2026-09-01T00:00:00Z"),
      autor: AUTOR,
    } satisfies Omit<Fato, "id">);
    servico = servicoCom(configuracaoAlrn());
  });

  afterAll(async () => {
    await ambiente?.encerrar();
  });

  describe("abrir", () => {
    it("cria a folha 'aberta', sem corte", async () => {
      const id = await servico.abrir(JULHO, MENSAL);
      expect(await folhaRepositorioPg(ambiente.poolApp).buscarPorId(id)).toMatchObject({ id, estado: "aberta", tipo: MENSAL });
      expect((await folhaRepositorioPg(ambiente.poolApp).buscarPorId(id))?.corte).toBeUndefined();
    });

    it("recusa tipo de folha fora do catálogo", async () => {
      await expect(servico.abrir(JULHO, "suplementar" as TipoFolhaChave)).rejects.toThrow(ErroServicoFolha);
    });
  });

  describe("calcularSimulacao", () => {
    it("marca o resultado como simulação, registra o corte usado e não persiste nada", async () => {
      const id = await servico.abrir(JULHO, MENSAL);
      const simulacao = await servico.calcularSimulacao(id, DEPOIS_DA_PROMOCAO);

      expect(simulacao).toMatchObject({ simulacao: true, folhaId: id, corte: DEPOIS_DA_PROMOCAO_CANONICO });
      expect(simulacao.resultado.registros.map((r) => [r.rubrica, r.valor.paraString()])).toEqual([
        ["salario_base", "6200.00"],
        ["contribuicao_previdencia", "665.50"],
      ]);
      expect(await contarRegistros(id)).toBe(0);
      expect((await folhaRepositorioPg(ambiente.poolApp).buscarPorId(id))?.estado).toBe("aberta");
    });

    it("o corte decide o que se sabe: antes do registro da promoção, julho ainda paga B6", async () => {
      const id = await servico.abrir(JULHO, MENSAL);
      const simulacao = await servico.calcularSimulacao(id, ANTES_DA_PROMOCAO);
      expect(simulacao.resultado.registros.find((r) => r.rubrica === "salario_base")?.valor.paraString()).toBe("5000.00");
    });

    it("história sem fato de abertura conhecido até o corte não participa (DECISOES #5)", async () => {
      const id = await servico.abrir(JULHO, MENSAL);
      const simulacao = await servico.calcularSimulacao(id, DEPOIS_DA_PROMOCAO);
      expect(simulacao.resultado.registros.every((r) => r.historiaId === VICTOR_ALVO.historiaId)).toBe(true);

      const depoisDeSetembro = await servico.calcularSimulacao(id, dataRegistro("2026-09-02T00:00:00Z"));
      expect(depoisDeSetembro.resultado.registros.some((r) => r.historiaId === TARDIA_ALVO.historiaId)).toBe(true);
    });

    it("a ordem dos registros não depende da ordem em que o cadastro lista as histórias", async () => {
      const invertido = criarServicoFolha({
        pool: ambiente.poolApp,
        configuracao: configuracaoAlrn(),
        cadastro: cadastroEmMemoria([TARDIA_ALVO, VICTOR_ALVO]),
      });
      const id = await servico.abrir(JULHO, MENSAL);
      const corte = dataRegistro("2026-09-02T00:00:00Z");
      const ordem = (r: Awaited<ReturnType<ServicoFolha["calcularSimulacao"]>>) => r.resultado.registros.map((x) => `${x.historiaId}/${x.rubrica}`);
      expect(ordem(await invertido.calcularSimulacao(id, corte))).toEqual(ordem(await servico.calcularSimulacao(id, corte)));
    });

    it("só em folha aberta; folha inexistente é erro", async () => {
      const id = await folhaEmConferencia();
      await expect(servico.calcularSimulacao(id, DEPOIS_DA_PROMOCAO)).rejects.toThrow(/exige estado 'aberta'/);
      await expect(servico.calcularSimulacao("00000000-0000-4000-8000-0000000000ff" as FolhaId, DEPOIS_DA_PROMOCAO)).rejects.toThrow(
        /não encontrada/,
      );
    });
  });

  describe("travarCorte", () => {
    it("leva a 'em_conferencia' com o corte travado e registra a transição", async () => {
      const id = await servico.abrir(JULHO, MENSAL);
      const folha = await servico.travarCorte(id, DEPOIS_DA_PROMOCAO, AUTOR);

      expect(folha).toMatchObject({ estado: "em_conferencia", corte: DEPOIS_DA_PROMOCAO_CANONICO });
      // o que o serviço devolve é exatamente o que o banco guarda — nenhuma divergência de formato.
      expect(await folhaRepositorioPg(ambiente.poolApp).buscarPorId(id)).toEqual(folha);
      expect(await folhaRepositorioPg(ambiente.poolApp).listarTransicoes(id)).toEqual([
        { folhaId: id, de: "aberta", para: "em_conferencia", instante: DEPOIS_DA_PROMOCAO_CANONICO, autor: AUTOR },
      ]);
    });

    it("recusa travar duas vezes (em_conferencia → em_conferencia é ilegal)", async () => {
      const id = await folhaEmConferencia();
      await expect(servico.travarCorte(id, DEPOIS_DA_PROMOCAO, AUTOR)).rejects.toThrow(/transição ilegal/);
    });
  });

  describe("fechar", () => {
    it("persiste registros + transição + selo atomicamente", async () => {
      const id = await folhaEmConferencia();
      const { folha, resultado } = await servico.fechar(id, AUTOR, dataRegistro("2026-08-02T00:00:00Z"));

      expect(folha).toMatchObject({ estado: "fechada", corte: DEPOIS_DA_PROMOCAO_CANONICO, folhasConsumidas: [] });
      expect(await folhaRepositorioPg(ambiente.poolApp).buscarPorId(id)).toEqual(folha);
      expect(await contarRegistros(id)).toBe(resultado.registros.length);
      expect((await folhaRepositorioPg(ambiente.poolApp).listarTransicoes(id)).map((t) => t.para)).toEqual(["em_conferencia", "fechada"]);
    });

    it("recusa fechar folha aberta (aberta → fechada é ilegal)", async () => {
      const id = await servico.abrir(JULHO, MENSAL);
      await expect(servico.fechar(id, AUTOR, DEPOIS_DA_PROMOCAO)).rejects.toThrow(/transição ilegal/);
    });

    it("recusa instante de fechamento anterior ao corte", async () => {
      const id = await folhaEmConferencia();
      await expect(servico.fechar(id, AUTOR, dataRegistro("2026-07-31T23:59:59Z"))).rejects.toThrow(/anterior ao corte/);
    });

    it("recusa fechar quando o cálculo tem erros — e nada é persistido", async () => {
      const quebrado = servicoCom(
        comSalarioBase(configuracaoAlrn(), {
          calcular: () => {
            throw new Error("tabela salarial indisponível");
          },
        }),
      );
      const id = await folhaEmConferencia(quebrado);

      const erro = await quebrado.fechar(id, AUTOR, dataRegistro("2026-08-02T00:00:00Z")).catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroFechamentoComErros);
      expect((erro as ErroFechamentoComErros).erros[0]).toMatchObject({ tipo: "excecao", mensagem: "tabela salarial indisponível" });
      expect((await folhaRepositorioPg(ambiente.poolApp).buscarPorId(id))?.estado).toBe("em_conferencia");
      expect(await contarRegistros(id)).toBe(0);
    });

    it("atomicidade: se um registro falha no INSERT, nem registros nem transição ficam (rollback)", async () => {
      // 1 trilhão não cabe em NUMERIC(14,2): o INSERT do registro estoura DENTRO da transação.
      const gigante = servicoCom(comSalarioBase(configuracaoAlrn(), { calcular: () => Dinheiro.de("1000000000000.00") }));
      const id = await folhaEmConferencia(gigante);

      await expect(gigante.fechar(id, AUTOR, dataRegistro("2026-08-02T00:00:00Z"))).rejects.toThrow();
      expect((await folhaRepositorioPg(ambiente.poolApp).buscarPorId(id))?.estado).toBe("em_conferencia");
      expect(await contarRegistros(id)).toBe(0);
      expect((await folhaRepositorioPg(ambiente.poolApp).listarTransicoes(id)).map((t) => t.para)).toEqual(["em_conferencia"]);
    });
  });

  describe("fronteira do corte (DECISOES #7)", () => {
    // Grafias em que a ordem de TEXTO contradiz a ordem real, frente ao corte relido do banco
    // ("2026-08-01T00:00:00.000Z"): "…00Z" > "…00.000Z"; e "01:00+02:00" (= 23:00Z do dia
    // 31, antes do corte) > "00:00…". Sem a forma canônica única de DataRegistro, a v2 valia
    // na simulação (corte informado) e sumia no fechamento (corte relido).
    it.each(["2026-08-01T00:00:00Z", "2026-08-01T01:00:00+02:00"])(
      "versão de regra publicada em %s (até o corte) vale igual na simulação, no fechamento e na reprodução",
      async (publicadaEm) => {
        const v2: VersaoRegra = {
          ...REGRA_SALARIO_BASE_V1,
          versao: 2,
          dataEfeito: dataEfeito("2026-07-01"),
          dataRegistro: dataRegistro(publicadaEm),
          calcular: () => Dinheiro.de("9999.00"),
        };
        const s = servicoCom({ ...configuracaoAlrn(), regras: agruparRegras([...CATALOGO_REGRAS, v2]) });
        const salario = (registros: readonly { rubrica: string; valor: Dinheiro }[]) =>
          registros.find((r) => r.rubrica === "salario_base")?.valor.paraString();

        const id = await s.abrir(JULHO, MENSAL);
        const simulacao = await s.calcularSimulacao(id, DEPOIS_DA_PROMOCAO);
        await s.travarCorte(id, DEPOIS_DA_PROMOCAO, AUTOR);
        const { resultado } = await s.fechar(id, AUTOR, dataRegistro("2026-08-02T00:00:00Z"));

        expect(salario(simulacao.resultado.registros)).toBe("9999.00");
        expect(salario(resultado.registros)).toBe("9999.00");
        expect(serializarRegistros((await s.reproduzir(id)).registros)).toBe(serializarRegistros(resultado.registros));
      },
    );
  });

  describe("folha fechada é terminal (Fundação §5.5: 'não existe reabrir. Nunca.')", () => {
    let fechadaId: FolhaId;

    beforeAll(async () => {
      fechadaId = await folhaEmConferencia();
      await servico.fechar(fechadaId, AUTOR, dataRegistro("2026-08-02T00:00:00Z"));
    });

    it.each<EstadoFolha>(["aberta", "em_conferencia", "fechada", "cancelada"])("motor::transitar recusa fechada → %s", async (para) => {
      const folha = (await folhaRepositorioPg(ambiente.poolApp).buscarPorId(fechadaId))!;
      expect(transitar(folha, para, AUTOR, dataRegistro("2026-09-01T00:00:00Z"))).toMatchObject({ erro: "transicao_ilegal", de: "fechada" });
    });

    it("o serviço recusa travar, fechar de novo e simular", async () => {
      await expect(servico.travarCorte(fechadaId, DEPOIS_DA_PROMOCAO, AUTOR)).rejects.toThrow(/estado terminal/);
      await expect(servico.fechar(fechadaId, AUTOR, dataRegistro("2026-09-01T00:00:00Z"))).rejects.toThrow(/estado terminal/);
      await expect(servico.calcularSimulacao(fechadaId, DEPOIS_DA_PROMOCAO)).rejects.toThrow(/exige estado 'aberta'/);
    });

    it("folha fechada SEM selo (fechada fora do serviço) reproduz sem ler janela nenhuma", async () => {
      const repositorio = folhaRepositorioPg(ambiente.poolApp);
      const id = await repositorio.criar({ competencia: JULHO, tipo: MENSAL, estado: "em_conferencia", corte: DEPOIS_DA_PROMOCAO_CANONICO });
      const folha = (await repositorio.buscarPorId(id))!;
      const fechamento = transitar(folha, "fechada", AUTOR, DEPOIS_DA_PROMOCAO_CANONICO);
      if ("erro" in fechamento) throw new Error(fechamento.mensagem);
      await repositorio.persistirTransicao(fechamento, []);

      expect((await repositorio.buscarPorId(id))?.folhasConsumidas).toBeUndefined();
      expect((await servico.reproduzir(id)).registros).toHaveLength(2);
    });

    it("reproduzir só vale para folha fechada", async () => {
      const aberta = await servico.abrir(JULHO, MENSAL);
      await expect(servico.reproduzir(aberta)).rejects.toThrow(/exige estado 'fechada'/);
      expect((await servico.reproduzir(fechadaId)).registros).toHaveLength(2);
    });
  });
});

describe("canonizarInstante", () => {
  it("leva qualquer ISO 8601 válido à forma do Postgres (UTC, milissegundos, 'Z')", () => {
    expect(canonizarInstante(dataRegistro("2026-08-01T00:00:00Z"))).toBe("2026-08-01T00:00:00.000Z");
    expect(canonizarInstante(dataRegistro("2026-07-31T21:00:00-03:00"))).toBe("2026-08-01T00:00:00.000Z");
  });
});
