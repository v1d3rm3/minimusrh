import { Competencia, dataRegistro } from "@minimusrh/dominio";
import type { Autor, TipoFolhaChave } from "@minimusrh/dominio";
import { folhaRepositorioPg } from "@minimusrh/persistencia";
import { cadastroEmMemoria, configuracaoAlrn } from "../configuracao.js";
import { renderizarContracheque } from "../extrato.js";
import { criarServicoFolha } from "../servico-folha.js";
import { subirAmbiente } from "../testes/ambiente-integracao.js";
import { semearVictor, VICTOR_ALVO } from "../testes/semear-victor.js";

// demo/victor.ts — `rushx demo:victor` (critério de aceite do Módulo 5): o fluxo do Marco 1
// de ponta a ponta num Postgres efêmero (exige Docker) e o contracheque do Victor com o
// extrato de cálculo. O PORTÃO HUMANO do playbook é revisar esta saída linha a linha.

const AUTOR: Autor = { tipo: "humano", usuarioId: "demo" };
const COMPETENCIA = Competencia.de(2026, 7);
const CORTE = dataRegistro("2026-08-01T00:00:00Z");
const FECHAMENTO = dataRegistro("2026-08-02T12:00:00Z");

const ambiente = await subirAmbiente();
try {
  const victor = await semearVictor(ambiente.poolApp);
  const configuracao = configuracaoAlrn();
  const servico = criarServicoFolha({ pool: ambiente.poolApp, configuracao, cadastro: cadastroEmMemoria([VICTOR_ALVO]) });

  const folhaId = await servico.abrir(COMPETENCIA, "mensal" as TipoFolhaChave);
  await servico.travarCorte(folhaId, CORTE, AUTOR);
  const { folha } = await servico.fechar(folhaId, AUTOR, FECHAMENTO);
  const registros = await folhaRepositorioPg(ambiente.poolApp).listarRegistros(folhaId);

  console.log(`Folha ${folha.tipo} ${folha.competencia.toString()} — ${folha.estado}, corte ${folha.corte}, id ${folha.id}`);
  console.log("");
  console.log(renderizarContracheque(VICTOR_ALVO.historiaId, registros, configuracao.rubricas, { fatos: victor.fatos }));
} finally {
  await ambiente.encerrar();
}
