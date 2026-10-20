import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Competencia, dataRegistro } from "@minimusrh/dominio";
import type { Autor, FolhaId, TipoFolhaChave } from "@minimusrh/dominio";
import { folhaRepositorioPg } from "@minimusrh/persistencia";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cadastroEmMemoria, configuracaoAlrn } from "./configuracao.js";
import { renderizarExtrato } from "./extrato.js";
import { serializarRegistros } from "./serializacao.js";
import { criarServicoFolha } from "./servico-folha.js";
import { subirAmbiente, type AmbienteIntegracao } from "./testes/ambiente-integracao.js";
import { semearVictor, VICTOR_ALVO, VICTOR_HISTORIA_UUID, type VictorSemeado } from "./testes/semear-victor.js";

// golden-reprodutibilidade.integracao.test.ts — O TESTE MAIS IMPORTANTE DO REPOSITÓRIO
// (Roteiro Marco 0: "mesma folha + mesmo corte ⇒ mesmo resultado, centavo a centavo"; roda
// em toda mudança, para sempre — Fundação §1). Nunca desligue, nunca "atualize para passar"
// sem entender a diferença: um golden que muda é um contracheque que muda.
//
// Duas provas independentes:
// 1. REPRODUÇÃO: o que foi persistido no fechamento == recálculo do zero com o mesmo corte
//    e o mesmo selo, byte a byte (ids reais, nenhuma normalização além da canônica).
// 2. GOLDEN: o resultado, com ids gerados trocados por apelidos estáveis, == arquivo
//    commitado em `golden/`. Para regravar CONSCIENTEMENTE: ATUALIZAR_GOLDEN=1 rushx test.

const ARQUIVO_GOLDEN = join(dirname(fileURLToPath(import.meta.url)), "..", "golden", "victor-2026-07-mensal.json");

const MENSAL = "mensal" as TipoFolhaChave;
const AUTOR: Autor = { tipo: "humano", usuarioId: "golden-test" };
// Corte depois do registro da promoção (10/07/2026): a folha de julho enxerga o B8.
const CORTE = dataRegistro("2026-08-01T00:00:00Z");
const INSTANTE_FECHAMENTO = dataRegistro("2026-08-02T12:00:00Z");

describe("golden test de reprodutibilidade — Victor, folha mensal 07/2026", () => {
  let ambiente: AmbienteIntegracao;
  let victor: VictorSemeado;
  let folhaId: FolhaId;

  beforeAll(async () => {
    ambiente = await subirAmbiente();
    victor = await semearVictor(ambiente.poolApp);

    const servico = criarServicoFolha({ pool: ambiente.poolApp, configuracao: configuracaoAlrn(), cadastro: cadastroEmMemoria([VICTOR_ALVO]) });
    folhaId = await servico.abrir(Competencia.de(2026, 7), MENSAL);
    await servico.travarCorte(folhaId, CORTE, AUTOR);
    await servico.fechar(folhaId, AUTOR, INSTANTE_FECHAMENTO);
  });

  afterAll(async () => {
    await ambiente?.encerrar();
  });

  it("o fechamento produziu registros (a cadeia fato → derivação → regra → folha → registro funciona)", async () => {
    const registros = await folhaRepositorioPg(ambiente.poolApp).listarRegistros(folhaId);
    expect(registros.map((r) => [r.rubrica, r.valor.paraString()])).toEqual([
      ["salario_base", "6200.00"],
      ["contribuicao_previdencia", "665.50"],
    ]);
  });

  it("reprodução: recalcular do zero a folha fechada dá o mesmo resultado, byte a byte", async () => {
    const servico = criarServicoFolha({ pool: ambiente.poolApp, configuracao: configuracaoAlrn(), cadastro: cadastroEmMemoria([VICTOR_ALVO]) });
    const persistidos = await folhaRepositorioPg(ambiente.poolApp).listarRegistros(folhaId);
    const reproduzido = await servico.reproduzir(folhaId);

    expect(reproduzido.erros).toEqual([]);
    expect(serializarRegistros(reproduzido.registros)).toBe(serializarRegistros(persistidos));
  });

  it("golden: o resultado bate com o arquivo commitado em golden/", async () => {
    const persistidos = await folhaRepositorioPg(ambiente.poolApp).listarRegistros(folhaId);
    const apelidos = new Map([...victor.apelidos, [folhaId, "folha:mensal@2026-07"], [VICTOR_HISTORIA_UUID, "historia:victor"]]);
    const atual = serializarRegistros(persistidos, apelidos);

    if (process.env["ATUALIZAR_GOLDEN"] === "1") {
      writeFileSync(ARQUIVO_GOLDEN, atual);
    }
    expect(existsSync(ARQUIVO_GOLDEN), `golden ausente: rode ATUALIZAR_GOLDEN=1, revise ${ARQUIVO_GOLDEN} e commite`).toBe(true);
    expect(atual).toBe(readFileSync(ARQUIVO_GOLDEN, "utf-8"));
  });

  it("extrato do salario_base do Victor mostra o cargo, o fato de origem e a versão da regra", async () => {
    const persistidos = await folhaRepositorioPg(ambiente.poolApp).listarRegistros(folhaId);
    const salario = persistidos.find((r) => r.rubrica === "salario_base")!;
    const extrato = renderizarExtrato(salario, { fatos: victor.fatos });

    expect(extrato).toContain("regra 'salario_base' v1");
    expect(extrato).toContain("derivação cargo = B8");
    // o fato de origem do B8: a promoção com efeito em fevereiro, registrada em julho, com amparo
    expect(extrato).toMatch(/fato 'promocao' \{"cargo":"B8"\} \(efeito 2026-02-15, registrado 2026-07-10T00:00:00\.000Z, amparo processo /);
  });
});
