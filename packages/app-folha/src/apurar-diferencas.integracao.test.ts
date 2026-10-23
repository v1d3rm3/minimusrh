import { Competencia, Dinheiro, dataRegistro } from "@minimusrh/dominio";
import type { VersaoRegra } from "@minimusrh/dominio";
import { criarPool } from "@minimusrh/persistencia";
import { CATALOGO_REGRAS, REGRA_SALARIO_BASE_V2, RUBRICA_CONTRIBUICAO_PREVIDENCIA, RUBRICA_SALARIO_BASE } from "@minimusrh/regras-alrn";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { folhasAlcancadas, listarFolhasFechadas } from "./alcance-retroativo.js";
import { criarApuradorDeDiferencas, ErroApuracaoComErros, ErroReprodutibilidadeViolada, type ApuradorDeDiferencas } from "./apurar-diferencas.js";
import { agruparRegras, cadastroEmMemoria, configuracaoAlrn } from "./configuracao.js";
import { renderizarExplicacao } from "./extrato.js";
import { criarServicoFolha, ErroServicoFolha } from "./servico-folha.js";
import { subirAmbiente, type AmbienteIntegracao } from "./testes/ambiente-integracao.js";
import { MENSAL, MESMO_CARGO_ALVO, montarCenarioRetroativo, type CenarioRetroativo } from "./testes/cenario-retroativo.js";
import { VICTOR_ALVO, VICTOR_HISTORIA_UUID } from "./testes/semear-victor.js";

// apurar-diferencas.integracao.test.ts — Marco 2, o TESTE DE FOGO (Roteiro; Fundação §5.3):
// a promoção B6 → B8 do Victor, com efeito em 15/02/2026 e registrada em 10/07/2026,
// depois que fevereiro–junho já fecharam pagando B6. Diferença = execução com o corte de
// agora − execução com o corte selado, nada mais.

// "Agora" (sem relógio no core): depois da publicação da salario_base V2 (22/10/2026,
// regras-alrn DECISOES #14), que paga a promoção de fevereiro pro rata.
const AGORA = dataRegistro("2026-10-23T12:00:00Z");

// Tabela INVENTADA de regras-alrn (DECISOES #6): B6 = 5.000,00, B8 = 6.200,00.
const B8_MENOS_B6 = Dinheiro.de("6200.00").subtrair(Dinheiro.de("5000.00"));
// Fevereiro: 16 dos 30 dias comerciais já no B8 (o dia 15 conta no cargo novo).
function proporcionalDias(valor: Dinheiro, dias: number): Dinheiro {
  let total = Dinheiro.zero();
  for (let i = 0; i < dias; i += 1) total = total.somar(valor.dividirPor(30));
  return total.arredondar("meio_para_cima");
}

describe("apurar diferenças retroativas — Victor promovido com efeito em 15/02/2026", () => {
  let ambiente: AmbienteIntegracao;
  let cenario: CenarioRetroativo;
  let apurador: ApuradorDeDiferencas;

  beforeAll(async () => {
    ambiente = await subirAmbiente();
    cenario = await montarCenarioRetroativo(ambiente.poolApp);
    apurador = criarApuradorDeDiferencas({ pool: ambiente.poolApp, servico: cenario.servico });
  });

  afterAll(async () => {
    await ambiente?.encerrar();
  });

  it("alcance da promoção: fevereiro a junho (janeiro é anterior ao efeito; julho já sabia)", async () => {
    const alcancadas = folhasAlcancadas(await listarFolhasFechadas(ambiente.poolApp), cenario.promocao);
    expect(alcancadas.map((f) => f.competencia.toString())).toEqual(["2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]);
    expect(alcancadas.map((f) => f.id)).toEqual(["2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].map((c) => cenario.folhas.get(c)));
  });

  it("alcance da salario_base V2 (efeito 01/2026, publicada em 22/10): todas as folhas fechadas antes", async () => {
    const alcancadas = folhasAlcancadas(await listarFolhasFechadas(ambiente.poolApp), REGRA_SALARIO_BASE_V2);
    expect(alcancadas.map((f) => f.competencia.toString())).toEqual([...cenario.folhas.keys()]);
  });

  it("diferenças do Victor = (B8 − B6) proporcional aos períodos, centavo a centavo", async () => {
    const salario: [string, string][] = [];
    const previdencia: [string, string][] = [];
    for (const mes of [2, 3, 4, 5, 6]) {
      const apuracao = await apurador.apurar(Competencia.de(2026, mes), MENSAL, AGORA);
      const doVictor = apuracao.diferencas.filter((d) => d.historiaId === VICTOR_HISTORIA_UUID);
      salario.push(...doVictor.filter((d) => d.rubrica === RUBRICA_SALARIO_BASE).map((d) => [apuracao.competencia.toString(), d.diferenca.paraString()] as [string, string]));
      previdencia.push(
        ...doVictor.filter((d) => d.rubrica === RUBRICA_CONTRIBUICAO_PREVIDENCIA).map((d) => [apuracao.competencia.toString(), d.diferenca.paraString()] as [string, string]),
      );
      expect(doVictor).toHaveLength(2);
    }

    expect(salario).toEqual([
      ["2026-02", proporcionalDias(B8_MENOS_B6, 16).paraString()],
      ["2026-03", B8_MENOS_B6.paraString()],
      ["2026-04", B8_MENOS_B6.paraString()],
      ["2026-05", B8_MENOS_B6.paraString()],
      ["2026-06", B8_MENOS_B6.paraString()],
    ]);
    expect(salario[0]![1]).toBe("640.00");
    // previdência: toda a diferença cai na faixa marginal de 14% (base > 4.500,00).
    expect(previdencia).toEqual([
      ["2026-02", "89.60"],
      ["2026-03", "168.00"],
      ["2026-04", "168.00"],
      ["2026-05", "168.00"],
      ["2026-06", "168.00"],
    ]);
  });

  it("pago e devido vêm das duas leituras do tempo, e a explicação nova cita a promoção e a V2", async () => {
    const apuracao = await apurador.apurar(Competencia.de(2026, 2), MENSAL, AGORA);
    const salario = apuracao.diferencas.find((d) => d.historiaId === VICTOR_HISTORIA_UUID && d.rubrica === RUBRICA_SALARIO_BASE)!;

    expect(apuracao.folhaId).toBe(cenario.folhas.get("2026-02"));
    expect(apuracao.corteSelado).toBe("2026-03-01T00:00:00.000Z");
    expect(apuracao.corteNovo).toBe("2026-10-23T12:00:00.000Z");
    expect([salario.valorPago.paraString(), salario.valorDevido.paraString()]).toEqual(["5000.00", "5640.00"]);

    const extrato = renderizarExplicacao(salario.explicacaoNova!, { fatos: cenario.fatos });
    expect(extrato).toContain("regra 'salario_base' v2");
    expect(extrato).toContain('derivação periodos_cargo = {"periodos":[{"cargo":"B6","dias":14},{"cargo":"B8","dias":16}],"diasNoMes":30}');
    expect(extrato).toMatch(/fato 'promocao' \{"cargo":"B8"\} \(efeito 2026-02-15, registrado 2026-07-10T00:00:00\.000Z, amparo processo /);
  });

  it("promoção para o mesmo cargo (B6 → B6) não gera diferença nenhuma", async () => {
    for (const mes of [2, 3, 4, 5, 6]) {
      const apuracao = await apurador.apurar(Competencia.de(2026, mes), MENSAL, AGORA);
      expect(apuracao.diferencas.filter((d) => d.historiaId === MESMO_CARGO_ALVO.historiaId)).toEqual([]);
    }
  });

  it("competências fora do alcance da promoção (janeiro, julho) não têm diferença", async () => {
    expect((await apurador.apurar(Competencia.de(2026, 1), MENSAL, AGORA)).diferencas).toEqual([]);
    expect((await apurador.apurar(Competencia.de(2026, 7), MENSAL, AGORA)).diferencas).toEqual([]);
  });

  it("sem folha fechada da competência, a apuração é recusada", async () => {
    await expect(apurador.apurar(Competencia.de(2026, 8), MENSAL, AGORA)).rejects.toThrow(ErroServicoFolha);
    await expect(apurador.apurar(Competencia.de(2026, 8), MENSAL, AGORA)).rejects.toThrow(/encontradas 0/);
  });

  it("recálculo com o corte novo com erro ⇒ apuração recusada (nada de retroativo parcial)", async () => {
    const quebrada: VersaoRegra = {
      ...REGRA_SALARIO_BASE_V2,
      versao: 3,
      dataRegistro: dataRegistro("2026-10-23T00:00:00Z"),
      calcular: () => {
        throw new Error("tabela salarial indisponível");
      },
    };
    const configuracao = { ...configuracaoAlrn(), regras: agruparRegras([...CATALOGO_REGRAS, quebrada]) };
    const servico = criarServicoFolha({ pool: ambiente.poolApp, configuracao, cadastro: cadastroEmMemoria([VICTOR_ALVO, MESMO_CARGO_ALVO]) });
    const comRegraQuebrada = criarApuradorDeDiferencas({ pool: ambiente.poolApp, servico });

    await expect(comRegraQuebrada.apurar(Competencia.de(2026, 3), MENSAL, AGORA)).rejects.toThrow(ErroApuracaoComErros);
  });

  it("recalcularComCorte só vale para folha fechada", async () => {
    const aberta = await cenario.servico.abrir(Competencia.de(2026, 9), MENSAL);
    await expect(cenario.servico.recalcularComCorte(aberta, AGORA)).rejects.toThrow(/exige estado 'fechada'/);
  });

  // ÚLTIMO teste do arquivo: adultera junho para sempre neste banco.
  it("registro persistido adulterado ⇒ 'reprodutibilidade violada'", async () => {
    const junho = cenario.folhas.get("2026-06")!;
    await expect(apurador.apurar(Competencia.de(2026, 6), MENSAL, AGORA)).resolves.toBeDefined();

    // por fora do serviço: superusuário, com os triggers append-only desligados na sessão.
    const superusuario = criarPool(ambiente.conexaoSuperusuario());
    try {
      const cliente = await superusuario.connect();
      try {
        await cliente.query("SET session_replication_role = replica");
        const { rowCount } = await cliente.query(
          "UPDATE registro_calculo SET valor = valor + 0.01 WHERE folha_id = $1 AND rubrica = $2",
          [junho, RUBRICA_SALARIO_BASE],
        );
        expect(rowCount).toBe(2); // Victor e a história "mesmo cargo"
      } finally {
        cliente.release();
      }
    } finally {
      await superusuario.end();
    }

    await expect(apurador.apurar(Competencia.de(2026, 6), MENSAL, AGORA)).rejects.toThrow(ErroReprodutibilidadeViolada);
  });
});
