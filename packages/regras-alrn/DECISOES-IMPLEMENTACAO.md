# Decisões de implementação — pacote `regras-alrn`

Ambiguidades e lacunas encontradas entre `docs/MinimusRH_Playbook_Implementacao.md` (Módulo
4) e os documentos de design (`MinimusRH_Design_Dominio.md`,
`MinimusRH_Fundacao_e_Modelo_v2.md`) durante a implementação, no formato pedido: *contexto →
opções → decisão → por quê*. Revisão humana pendente (portão do playbook antes do Módulo 5).

---

## 1. Tipo local `TipoFolha` — o domínio não define nenhum

**Contexto:** o playbook pede um catálogo de "tipos de folha (mensal)", mas
`@minimusrh/dominio` só exporta a chave branded `TipoFolhaChave` — não existe
`TipoFolha`/`VersaoTipoFolha`/`CatalogoTiposDeFolha` em lugar nenhum do pacote (mesma lacuna
já registrada na decisão #6 de `packages/dominio/DECISOES-IMPLEMENTACAO.md`).

**Decisão:** `catalogo-tipos-folha.ts` define localmente `interface TipoFolha { chave, nome
}` e `CatalogoTiposDeFolha = Catalogo<TipoFolhaChave, TipoFolha>`, com um único item
(`mensal`).

**Por quê:** inventar uma forma mais rica (versionamento, vigência) sem nenhuma pista do
design seria adivinhação — a forma mínima `{chave, nome}` é o suficiente para nomear o tipo
de folha nas regras (`aplicaSeAFolhas`) sem comprometer nada que o domínio venha a definir
depois.

---

## 2. Proporcionalidade aplicada na regra `salario_base`, não no motor

**Contexto:** o playbook pede explicitamente para decidir "se o fator [de
`dias_trabalhados`] aplica na regra ou no motor" e registrar a recomendação de levar a
questão ao humano. O `motor` (Módulo 2, já implementado e revisado) só aplica a política de
`arredondamento` da rubrica ao resultado de `calcular()` — não existe nenhum ponto de
extensão para aplicar um fator de proporcionalidade genérico com base em
`VersaoRubrica.proporcionalizavel`.

**Decisão:** `regra-salario-base.ts::calcular()` lê a derivação `dias_trabalhados` e escala
o valor manualmente (`proporcional()`, via `Dinheiro.dividirPor` + soma repetida — nunca
ponto flutuante).

**Por quê:** aplicar no motor exigiria reabrir um módulo já fechado e revisado, fora do
escopo deste módulo (que depende só de `dominio`). **Recomendação para o humano:** hoje
`VersaoRubrica.proporcionalizavel` é só metadado — nada o aplica mecanicamente. Toda futura
regra proporcionalizável precisará repetir essa lógica manualmente até existir um mecanismo
genérico (o `proporcional(...)` da futura DSL, Design §7.8, é o candidato natural). Vale
decidir, antes do Módulo 10, se esse mecanismo deveria migrar para o motor.

---

## 3. Convenção de `dias_trabalhados`: mês comercial de 30 dias fixos

**Contexto:** o único dado numérico concreto do playbook para esta derivação é "entrada dia
15 ⇒ fator 15/30" — nenhum documento especifica se a base é o calendário real do mês (28-31
dias) ou um "mês comercial" de 30 dias fixos, nem se o dia do fato de entrada/saída conta
como trabalhado.

**Decisão:** `diasNoMes` é sempre `30`, independente do mês real. O dia do fato de entrada
NÃO conta como trabalhado (`dias = diasNoMes - diaEntrada` quando a entrada ocorre nesta
competência); o dia do fato de saída CONTA (`dias = diaSaida` quando a saída ocorre nesta
competência).

**Por quê:** é a única leitura que reproduz exatamente "dia 15 ⇒ 15/30" do playbook. **Efeito
colateral a confirmar com o humano:** com essa convenção, uma posse no dia 1 do mês produz
29/30 (não mês cheio) — parece contraintuitivo e merece confirmação antes do Módulo 5 usar
isso em produção.

---

## 4. `auxilio_saude`: sem classificações, não proporcionalizável

**Contexto:** o playbook pede para "confirmar no DECISOES" que `auxilio_saude` não incide em
nada nem é proporcionalizável.

**Decisão:** `classificacoes: new Set()` (não incide previdência, não compõe teto) e
`proporcionalizavel: false`.

**Por quê:** Fundação §3.6 usa exatamente esse par (`salario_base` incide previdência,
`auxilio_saude` não) como exemplo do próprio mecanismo de classificação; nenhum documento
sugere que o auxílio-saúde seja proporcional a dias trabalhados (ao contrário do salário).

---

## 5. Arredondamento `meio_para_cima` nas três rubricas

**Contexto:** nenhum documento indica qual `PoliticaArredondamento` usar para
`salario_base`, `auxilio_saude` ou `contribuicao_previdencia`.

**Decisão:** as três usam `'meio_para_cima'`.

**Por quê:** é a política mais comum em folha de pagamento brasileira e a mais previsível
para conferência humana; decisão conservadora e uniforme, documentada para fácil revisão
posterior por rubrica.

---

## 6. Tabela cargo→salário com valores INVENTADOS

**Contexto:** nenhum documento define uma tabela real de salários por cargo — só os nomes de
cargo do cenário Victor (B6, B8).

**Decisão:** `regra-salario-base.ts` embute `TABELA_SALARIO_POR_CARGO_V1` com valores
inventados (B5–B8, R$4.600–R$6.200).

**Por quê:** é dado de configuração que a instituição forneceria na vida real; sem ele não há
como testar a regra. **Marcado explicitamente como placeholder** — não usar em produção sem
substituir pela tabela real da ALRN.

---

## 7. Tabela de faixa etária do auxílio-saúde reaproveitada do conceitual §7.8

**Contexto:** ao contrário da tabela salarial, esta tabela TEM um exemplo concreto no
documento (`Fundação §7.8`): `0–29 → R$250`, `30–39 → R$320`, `40–49 → R$410`, `50+ →
R$520`.

**Decisão:** `regra-auxilio-saude.ts` usa esses valores literalmente, não inventa novos.

**Por quê:** quando o documento já fornece um exemplo concreto, reaproveitá-lo é mais fiel à
especificação do que inventar — ao contrário da tabela salarial (decisão #6), aqui não há
lacuna a preencher.

---

## 8. Tabela progressiva de previdência com alíquotas INVENTADAS

**Contexto:** a Fundação (§7.6/§7.8) só mostra a SINTAXE (`aplica
tabela_progressiva('previdencia_vigente') sobre base`) — nenhum documento tem uma tabela
numérica real de alíquotas marginais de previdência ou IR.

**Decisão:** `regra-contribuicao-previdencia.ts` usa uma tabela de 4 faixas inventada (7,5% /
9% / 12% / 14%, cortes em R$1.500/R$3.000/R$4.500) só para exercitar `aplicarTabelaProgressiva`.

**Por quê:** sem uma tabela concreta não há como testar o utilitário nem a regra. **Marcado
explicitamente como placeholder** — precisa de confirmação humana e da tabela real antes de
qualquer uso em produção (Módulo 9, ampliação de regras, é o lugar natural para substituí-la
pelo batimento contra o legado).

---

## 9. `aplicarTabelaProgressiva` só com a API pública de `Dinheiro`/`Percentual`

**Contexto:** o cálculo marginal por faixa precisa comparar/subtrair/multiplicar valores
monetários sem introduzir ponto flutuante (Regra Global #1).

**Decisão:** implementado só com `menorEntre`, `subtrair`, `ehNegativo`, `ehZero`, `vezes`,
`somar` — nunca acessa `decimal.js` diretamente (não é dependência declarada deste pacote) e
nunca usa `number` bruto para representar uma fração de dinheiro.

**Por quê:** manter o encapsulamento de `Dinheiro`/`Percentual` (o domínio nunca expõe a
biblioteca decimal por trás) e a regra global de nunca tocar dinheiro com aritmética de
`number`.

---

## 10. Máscara do amparo `processo`: regex do Design §2.1, não a notação `999/9999` do playbook

**Contexto:** o playbook descreve a máscara como `999/9999` (notação informal); o Design
Domínio §2.1 já traz um exemplo COMPLETO e literal de `VersaoTipoAmparo` para exatamente esse
caso (`mascara: '^(\\d{1,4})\\/(\\d{4})$'`, `grupos`, `formatoCanonico: '{numero}/{ano}'`,
`exemplo: '123/2026'`).

**Decisão:** copiado o exemplo do Design §2.1 literalmente.

**Por quê:** as duas notações descrevem o mesmo formato; o Design já fornece a forma exata
que o catálogo precisa (regex-fonte + grupos + canonicalização), então não há lacuna a
preencher aqui — só transcrição.

---

## 11. Fixture Victor exportada por `index.ts`, não em `src/testes/`

**Contexto:** `packages/persistencia` guarda seu suporte de teste (`ambiente-integracao.ts`,
`fixtures.ts`) em `src/testes/`, fora do `package.json` `exports` — funciona lá porque só é
usado por testes DENTRO do mesmo pacote. Mas o playbook pede que a fixture Victor seja
"reutilizável pelos testes daqui e dos módulos 5–6" — pacotes DIFERENTES (`app-folha`).

**Decisão:** `fixture-victor.ts` e `linha-do-tempo-em-memoria.ts` moram em `src/` (não em
`src/testes/`) e são reexportados por `index.ts`. Só `contexto-fake.ts` (decisão #12) e
`fabrica-fato.ts` (fábrica interna de `Fato` só usada pelos testes deste pacote) ficam em
`src/testes/`.

**Por quê:** imports entre pacotes do workspace respeitam o `exports` do `package.json` —
sem isso, `app-folha` não conseguiria importar a fixture Victor deste pacote.

---

## 12. Contexto-fake local em `src/testes/` para testar as regras sem depender do motor

**Contexto:** o próprio playbook antecipa a pergunta e responde: "cada regra com o contexto
instrumentado do motor? NÃO: `regras-alrn` não depende de `motor`; use um contexto-fake
local simples".

**Decisão:** `src/testes/contexto-fake.ts` implementa `Contexto` diretamente (mapas
configuráveis por teste), sem nenhuma dependência de `@minimusrh/motor`. A fiscalização via
contexto INSTRUMENTADO (declaração de consumo batendo com leitura real) fica para os testes
do Módulo 5, que já tem acesso ao motor.

**Por quê:** instrução explícita do playbook; qualquer outra abordagem quebraria a regra
"depende só de dominio".

---

## 13. Teste de arquitetura reaproveitando o padrão dos pacotes irmãos

**Contexto:** igual à decisão equivalente de `dominio`/`motor` — não há ESLint configurado no
monorepo.

**Decisão:** `src/arquitetura.test.ts`, mesma técnica de `dominio`/`motor` (grep interno via
`readFileSync`, termos montados por concatenação), com dois termos adicionais específicos
deste módulo: `@minimusrh/motor` e `@minimusrh/persistencia` — reforçando em texto a
dependência única de `dominio` que o Rush já garante estruturalmente.

**Por quê:** consistência com a decisão já tomada e revisada nos pacotes anteriores;
critério de aceite do Módulo 4 pede explicitamente "dependência única de dominio comprovada
pelo build" — o teste de arquitetura é a segunda camada de garantia, mais legível que o
grafo de dependências do Rush para quem revisa o PR.
