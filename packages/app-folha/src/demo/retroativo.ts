import { dataRegistro } from "@minimusrh/dominio";
import type { Dinheiro } from "@minimusrh/dominio";
import { criarApuradorDeDiferencas } from "../apurar-diferencas.js";
import { folhasAlcancadas, listarFolhasFechadas } from "../alcance-retroativo.js";
import { renderizarExplicacao } from "../extrato.js";
import { subirAmbiente } from "../testes/ambiente-integracao.js";
import { MESMO_CARGO_ALVO, MENSAL, montarCenarioRetroativo } from "../testes/cenario-retroativo.js";
import { VICTOR_HISTORIA_UUID } from "../testes/semear-victor.js";

// demo/retroativo.ts — `rushx demo:retroativo` (critério de aceite do Módulo 6, Marco 2):
// fecha 01–06/2026 pagando B6, registra a promoção do Victor (efeito 15/02, registro 10/07,
// processo 123/2026), fecha 07/2026 (o estado do Módulo 5), detecta as competências
// alcançadas e apura as diferenças com o corte de agora. O PORTÃO HUMANO OBRIGATÓRIO do
// playbook é validar esta saída à mão.

// Sem relógio no core: o "agora" é uma constante (depois da salario_base V2, 22/10/2026).
const AGORA = dataRegistro("2026-10-23T12:00:00Z");

const NOMES = new Map<string, string>([
  [VICTOR_HISTORIA_UUID, "Victor"],
  [MESMO_CARGO_ALVO.historiaId, "mesmo cargo"],
]);

function coluna(valor: Dinheiro): string {
  return valor.paraString().padStart(10, " ");
}

const ambiente = await subirAmbiente();
try {
  const cenario = await montarCenarioRetroativo(ambiente.poolApp);
  const apurador = criarApuradorDeDiferencas({ pool: ambiente.poolApp, servico: cenario.servico });
  const p = cenario.promocao;

  console.log(`Promoção registrada: ${JSON.stringify(p.conteudo)}, efeito ${p.dataEfeito}, registro ${p.dataRegistro}, amparo ${p.amparo?.tipo} ${p.amparo?.identificacaoCanonica}`);
  console.log(`Corte da apuração ("agora"): ${AGORA}`);
  console.log("");

  const fechadas = await listarFolhasFechadas(ambiente.poolApp);
  const alcancadas = folhasAlcancadas(fechadas, p);
  console.log("Folhas fechadas (competência — corte selado — alcançada?):");
  for (const f of [...fechadas].sort((a, b) => a.competencia.toString().localeCompare(b.competencia.toString()))) {
    const sim = alcancadas.some((a) => a.id === f.id);
    console.log(`  ${f.competencia.toString()} ${f.tipo.padEnd(8, " ")} ${f.corte}  ${sim ? "SIM" : "não"}`);
  }
  console.log("");

  console.log("Diferenças apuradas (devido − pago):");
  console.log(`  ${"comp.".padEnd(8, " ")} ${"história".padEnd(12, " ")} ${"rubrica".padEnd(26, " ")} ${"pago".padStart(10, " ")} ${"devido".padStart(10, " ")} ${"diferença".padStart(10, " ")}`);
  const explicacoes: string[] = [];
  let diferencasMesmoCargo = 0;
  for (const folha of alcancadas) {
    const apuracao = await apurador.apurar(folha.competencia, MENSAL, AGORA);
    if (apuracao.diferencas.length === 0) console.log(`  ${folha.competencia.toString()}  (nenhuma diferença)`);
    for (const d of apuracao.diferencas) {
      if (d.historiaId === MESMO_CARGO_ALVO.historiaId) diferencasMesmoCargo += 1;
      console.log(
        `  ${folha.competencia.toString().padEnd(8, " ")} ${(NOMES.get(d.historiaId) ?? d.historiaId).padEnd(12, " ")} ${d.rubrica.padEnd(26, " ")} ${coluna(d.valorPago)} ${coluna(d.valorDevido)} ${coluna(d.diferenca)}`,
      );
      // a primeira competência alcançada traz a explicação de cada diferença.
      if (folha.id === alcancadas[0]!.id && d.explicacaoNova !== undefined) {
        explicacoes.push(`Explicação do devido — ${folha.competencia.toString()}, ${NOMES.get(d.historiaId)}, ${d.rubrica} = ${d.valorDevido.paraString()}:`);
        explicacoes.push(renderizarExplicacao(d.explicacaoNova, { fatos: cenario.fatos }, 1), "");
      }
    }
  }
  console.log("");
  console.log(`História 'mesmo cargo' (promoção B6 → B6): ${diferencasMesmoCargo} diferença(s).`);
  console.log("");
  console.log(explicacoes.join("\n"));
} finally {
  await ambiente.encerrar();
}
