# MinimusRH — Instruções de Implementação por Módulo (playbook para Claude Code)

> Quarto documento da série. O **Conceitual v2.9** diz o quê; o **Roteiro v1.1** diz em que ordem; o **Design do Domínio v1.5** especifica o vocabulário; este contém **uma instrução pronta para Claude Code por módulo**, na sequência dos marcos, com portões de revisão humana entre elas.

---

## Como usar este playbook

1. **Uma sessão de Claude Code por módulo, na ordem.** Cada instrução assume que as anteriores foram concluídas e revisadas. Não pule a ordem: as dependências entre pacotes são reais.
2. **Antes de cada sessão:** garanta que `docs/` do repositório contém os três documentos da série + este. Cole a instrução do módulo (a seção inteira, do título ao "Critérios de aceite").
3. **Depois de cada sessão (portão humano):** revise (a) o `DECISOES-IMPLEMENTACAO.md` do pacote — cada entrada é uma lacuna real do design; (b) os testes listados como obrigatórios; (c) rode você mesmo `rush build && rush test`. Só então avance.
4. **Dois portões são especiais:** após o **Módulo 6 (Marco 2 — retroatividade)**, pare e valide com calma — é o teste de fogo da arquitetura; após o **Módulo 9 (Marco 4)**, o MVP está validado e o restante é opcional por prioridade.

### Regras globais (valem para TODOS os módulos — inclua-as em toda sessão)

```
REGRAS GLOBAIS DO PROJETO (inegociáveis em qualquer pacote):
1. `number` jamais representa dinheiro. Toda aritmética monetária via Dinheiro (dominio).
2. Nenhum `new Date()` sem argumento / `Date.now()` fora do pacote `api` (único lugar
   onde o relógio existe, e só para carimbar dataRegistro na entrada).
3. Nenhum `if`/`switch` sobre chave de domínio (tipo de fato, rubrica) dentro de
   motor/persistencia — domínio entra pelos catálogos (§4 do conceitual).
4. Fatos e registros de cálculo: append-only. Nenhum UPDATE/DELETE, em nenhuma camada.
5. Imports entre pacotes seguem o grafo do Rush declarado no Roteiro §2.5.1 —
   regras-alrn depende SÓ de dominio; motor não conhece NestJS nem pg.
6. Ambiguidade ou lacuna nos documentos: decida conservadoramente, implemente, e
   registre em DECISOES-IMPLEMENTACAO.md do pacote (contexto → opções → decisão →
   porquê). NUNCA invente silenciosamente.
7. Rode build + testes após cada etapa. Nunca acumule vermelho.
8. Anotações §N dos documentos preservadas em comentários nos pontos correspondentes.
```

### Mapa geral

| # | Módulo (pacote) | Marco do Roteiro | Depende de |
|---|---|---|---|
| 1 | `dominio` | 0 | — (instrução já existe: `PROMPT_Claude_Code_Dominio.md`) |
| 2 | `motor` | 0–1 | dominio |
| 3 | `persistencia` | 1 | dominio |
| 4 | `regras-alrn` | 1 | dominio |
| 5 | `app-folha` + golden test | 1 ("O Victor recebe") | motor, persistencia, regras-alrn |
| 6 | retroatividade | 2 (⚠ teste de fogo) | app-folha |
| 7 | `importador-legado` | 3 | persistencia, regras-alrn |
| 8 | `harness` (comparação) | 3 ("sombra") | app-folha, importador |
| 9 | ampliação de regras | 4 (batimento total) | harness |
| 10 | `dsl` | 5 | motor, regras-alrn |
| 11 | `api` (NestJS) | pós-validação | app-folha |
| 12+ | pós-MVP (consistência, RBAC, telas, satélites) | 6+ | — |

---

## Módulo 2 — `motor` (Marcos 0–1)

### Instrução para Claude Code

**Contexto:** você vai implementar o pacote `packages/motor` do MinimusRH — o núcleo de execução: grafo de dependências, resolução bitemporal de versões, montagem de contexto e cálculo de folha. Leia antes, nesta ordem: `docs/MinimusRH_Design_Dominio.md` (o vocabulário que você consome), `docs/MinimusRH_Fundacao_e_Modelo_v2.md` §5 e §7 (o comportamento que você implementa), `docs/MinimusRH_Roteiro_MVP.md` §2. O pacote `dominio` já existe — **use-o; não redefina nenhum tipo dele.**

**Escopo — implemente:**

1. **`grafo.ts`** — `montarGrafo(regras: VersaoRegra[]): Grafo | ErroCiclo`. Nós = rubricas; arestas derivadas de `DeclaracaoConsumo` (rubricas individuais E classificações — uma regra que consome a classificação C depende de TODAS as regras cujas rubricas produzidas têm C). Ordenação topológica; `ErroCiclo` cita o caminho completo do ciclo (`a → b → c → a`), pois essa mensagem irá para o publicador de regras.
2. **`resolucao.ts`** — dado o conjunto de regras/rubricas/derivações e um `(competencia, tipoFolha, corte)`, resolve as versões vigentes de tudo via `versaoVigente` do dominio (ÚNICA fonte de semântica temporal — não reimplemente) e filtra regras por `aplicaSeAFolhas` e pela guarda de escopo.
3. **`contexto-impl.ts`** — implementação de `Contexto` sobre: `LinhaDoTempo` (interface do dominio), `RegistroDeDerivacoes`, os valores de rubricas já calculadas na execução corrente, e um `LeitorDeJanelas` (interface local: `agregar(consulta: ConsultaJanela): Dinheiro` — implementada de verdade só no Módulo 5; aqui, aceite uma injetada).
4. **`contexto-instrumentado.ts`** — decorator de `Contexto` que registra toda leitura e expõe `violacoes(declarado: DeclaracaoConsumo): Violacao[]`. É o fiscal da declaração de consumo (Design §7) — será usado nos testes de TODAS as regras.
5. **`calcular-folha.ts`** — a função central, PURA: recebe `{ competencia, tipoFolha, corte, historias: LinhaDoTempo[], catalogos, regras, derivacoes, leitorJanelas }` e devolve `ResultadoCalculo { registros: RegistroCalculo[], naoAplicaveis, erros }`. Passos (conceitual §5.2): filtrar histórias participantes; por história: montar contexto, executar regras na ordem do grafo, avaliar `quando()` (falso ⇒ NÃO produz registro), `calcular()`, aplicar a política de arredondamento **da rubrica** ao resultado, montar `NoExplicacao` com as fontes lidas (o contexto instrumentado fornece a matéria-prima da árvore).
6. **`ciclo-folha.ts`** — `transitar(folha, para, autor, instante, amparo?): { folha, transicao } | ErroTransicao`, validando contra `TRANSICOES` do dominio. Puro: devolve a folha nova + o registro de transição; quem persiste é outra camada.

**NÃO implemente:** acesso a banco, NestJS, regras concretas, o `LeitorDeJanelas` real, retroatividade (Módulo 6).

**Testes obrigatórios (test-first no grafo e no cálculo):**
- Grafo: linear, diamante, ciclo direto, ciclo via classificação (A produz rubrica com C; B consome C; A consome rubrica de B), mensagem de ciclo com caminho completo.
- Consumo por classificação: regra "soma tudo com incide_previdencia" executa DEPOIS de todas as produtoras, comprovado por ordem de execução observável.
- `quando()` falso ⇒ nenhum registro (não um registro de zero).
- Arredondamento aplicado pelo motor conforme a política da versão vigente da rubrica.
- Contexto instrumentado: regra que lê fora do declarado ⇒ violação reportada.
- **Determinismo**: `calcularFolha` duas vezes com a mesma entrada ⇒ resultados idênticos (serialize e compare byte a byte) — este é o embrião do golden test do Marco 0.
- Ciclo de folha: tabela `TRANSICOES` coberta linha a linha via `transitar`.

**Critérios de aceite:** build strict limpo; testes verdes; zero imports de `pg`/`@nestjs`; `versaoVigente` do dominio é a única resolução temporal (grep por reimplementações); `DECISOES-IMPLEMENTACAO.md` presente.

---

## Módulo 3 — `persistencia` (Marco 1)

### Instrução para Claude Code

**Contexto:** implementar `packages/persistencia`: o esquema Postgres da linha de fatos e as implementações dos contratos de leitura do dominio. Leia: Design §2, §4, §8–9; Roteiro §2.1, §2.5.3–2.5.4. Dependências permitidas: `dominio`, `pg`, ferramenta de migração à sua escolha (registre a escolha), `testcontainers` (dev).

**Escopo — implemente:**

1. **Migrações SQL:** tabelas `fato` (Roteiro §2.1: conteudo JSONB, duas datas, autor JSONB, amparo com `identificacao_canonica` indexada, `substitui_fato_id`), `registro_calculo` (valor `NUMERIC(14,2)`, `explicacao` JSONB), `folha`, `transicao_folha`. Índices do Roteiro §2.5.3. **Duas roles:** `minimus_app` (INSERT+SELECT em fato/registro_calculo; sem UPDATE/DELETE) e `minimus_migracao`. Trigger `BEFORE UPDATE OR DELETE` nas duas tabelas append-only levantando exceção com mensagem citando o §2 da Fundação.
2. **`fato-repositorio.ts`** — `registrar(fato): FatoId` (única porta de escrita; valida conteúdo contra o schema da versão do tipo ANTES do insert — a "porta" do conceitual §3.4) e leituras.
3. **`linha-do-tempo-pg.ts`** — implementação de `LinhaDoTempo` com a query `DISTINCT ON` do Roteiro §2.5.3, filtrando `data_registro <= corte` e **excluindo fatos substituídos** (um fato referenciado por `substitui_fato_id` de outro fato dentro do corte não aparece em `vigenteEm`/`todosDoTipo`). Documente a semântica escolhida para cadeias de substituição (A←B←C) no DECISOES.
4. **`folha-repositorio.ts`** — persistir folha + transições; ao fechar, gravar os registros de cálculo em lote, na mesma transação da transição.
5. **Mapeamentos:** `NUMERIC` ⇄ `Dinheiro` SEMPRE via string (teste que falha se `parseFloat` aparecer); JSONB ⇄ tipos do dominio.

**NÃO implemente:** lógica de cálculo, decisões de negócio, NestJS.

**Testes obrigatórios (integração com Testcontainers — sem mocks de banco):**
- **Append-only de verdade:** com a role `minimus_app`, `UPDATE fato` e `DELETE FROM fato` FALHAM (teste que espera o erro).
- Bitemporal: cenário Victor (promoção efeito fev, registro jul) — `vigenteEm('cargo', abril)` com corte maio ⇒ B6; com corte agosto ⇒ B8.
- Substituição: fato corrigido some da leitura vigente após o corte incluir a correção; permanece com corte anterior.
- `NUMERIC` volta como string e vira `Dinheiro` exato (insira `'0.10'`, some 3x no banco vs no Dinheiro, compare).
- Round-trip completo de um `Fato` com amparo (canônica indexável) e de um `RegistroCalculo` com árvore de explicação.
- Fechamento transacional: falha no meio do lote de registros ⇒ transição não persiste.

**Critérios de aceite:** migrações idempotentes; testes de integração verdes em container limpo; grep de `parseFloat|toNumber` vazio; roles e trigger comprovados por teste; DECISOES presente (inclua a semântica de cadeia de substituição).

---

## Módulo 4 — `regras-alrn` (Marco 1)

### Instrução para Claude Code

**Contexto:** implementar `packages/regras-alrn`: os catálogos de configuração e as primeiras derivações e regras da ALRN, em código, no contrato do dominio. Leia: Design §3–§7; Conceitual §3.4–3.7, §7.5–7.6 (os exemplos de regra são a especificação). **Depende SÓ de `dominio`** — o Rush deve recusar qualquer outro import.

**Escopo — implemente:**

1. **Catálogos (arquivos de configuração tipados):** tipos de fato (`posse` [abre história], `exoneracao` [encerra], `nascimento` [pessoa], `promocao` {cargo}, `comprovacao_plano_saude` {operadora, mensalidade, periodo_fim}), rubricas com classificações e políticas de arredondamento (`salario_base` [incide_previdencia, compoe_teto, proporcionalizavel], `auxilio_saude` [nem incide, não proporcionalizável — confirme no DECISOES], `contribuicao_previdencia` [desconto]), tipos de folha (`mensal`), tipos de amparo (`processo` com máscara `999/9999` no formato declarativo do Design §2.1), chaves de derivação.
2. **Derivações (todas `versao: 1`):** `idade` (nascimento × dataReferencia), `cargo` (último fato de promoção/posse vigente), `situacao_funcional` (ativo entre abertura e encerramento), `dias_trabalhados` (calendário da competência × abertura/encerramento — a proporcionalidade do conceitual §2/Decisão 2).
3. **Registro:** implementação de `RegistroDeDerivacoes` + verificação de integridade chaves⇄implementações (teste).
4. **Regras (versão 1, código no contrato `VersaoRegra`):** `salario_base` (tabela cargo→valor como dado versionado consumido pela regra; proporcional por `dias_trabalhados` quando a rubrica é proporcionalizável — decida se o fator aplica na regra ou no motor e REGISTRE no DECISOES com a recomendação de levar a questão ao humano), `auxilio_saude` (guarda `existe('comprovacao_plano_saude')`; tabela de faixas etárias do conceitual §7.8), `contribuicao_previdencia` (base = soma da classificação `incide_previdencia`; tabela progressiva com alíquotas marginais — implemente `aplicarTabelaProgressiva` como utilitário puro testado à parte).
5. **Fixture "Victor":** uma `LinhaDoTempo` em memória (fatos de posse, nascimento, promoção) reutilizável pelos testes daqui e dos módulos 5–6.

**Testes obrigatórios:** cada derivação contra a fixture (incluindo `dias_trabalhados` com entrada dia 15 ⇒ fator 15/30 — documente a convenção 30 dias vs dias corridos no DECISOES); cada regra com o **contexto instrumentado do motor?** — NÃO: `regras-alrn` não depende de `motor`; use um contexto-fake local simples e deixe a fiscalização instrumentada para o Módulo 5; tabela progressiva com valores nas fronteiras de faixa; `quando()` do auxílio sem comprovação ⇒ não aplica.

**Critérios de aceite:** dependência única de dominio comprovada pelo build; catálogos validam contra os tipos do Design; integridade derivações⇄chaves testada; DECISOES com as convenções (proporcionalidade, 30 dias, arredondamentos por rubrica).

---

## Módulo 5 — `app-folha` + integração Marco 1 ("O Victor recebe")

### Instrução para Claude Code

**Contexto:** costurar motor + persistencia + regras-alrn no primeiro fluxo completo: abrir folha, calcular, travar corte, fechar, reproduzir. Criar `packages/app-folha` (serviço de aplicação, sem NestJS — classes puras orquestrando os pacotes) e o **golden test de reprodutibilidade** (Roteiro, Marco 0/1). Leia: Roteiro §3 (Marcos 0–1); Conceitual §5.2, §5.5.

**Escopo — implemente:**

1. **`servico-folha.ts`**: `abrir(competencia, tipo)`; `calcularSimulacao(folhaId, corteProvisorio)` (resultado marcado como simulação, não persistido como definitivo); `travarCorte(folhaId, corte, autor)`; `fechar(folhaId, autor)` — que recalcula com o corte travado, persiste registros + transição na mesma transação, e recusa fechar se o recálculo divergir da última simulação conferida? NÃO — mantenha simples: fechar = calcular com corte e persistir atomicamente (a conferência humana é pós-MVP). Use `ciclo-folha` do motor para transições.
2. **`leitor-janelas-pg.ts`** (aqui, não no motor): implementação real de `LeitorDeJanelas` sobre `registro_calculo` de folhas FECHADAS (conceitual §7.3: janela olha o passado selado). No Marco 1 pode retornar vazio para competências sem histórico — mas com a query real implementada e testada.
3. **Golden test de reprodutibilidade** (o teste mais importante do repositório, rodando no CI para sempre): semeia a fixture Victor no banco (Testcontainers), abre folha 07/2026, trava corte, fecha; serializa o resultado completo (registros ordenados, valores como string, árvores de explicação) num arquivo golden; roda o cálculo de novo do zero e compara byte a byte. Qualquer divergência = falha.
4. **Extrato legível:** função que renderiza a árvore `NoExplicacao` de um registro em texto indentado (será a ferramenta de depuração dos Marcos 3–4).

**Testes obrigatórios:** o golden test; fechamento persiste registros + transição atomicamente; folha fechada recusa `transitar` para qualquer estado; regras validadas com o **contexto instrumentado** do motor contra suas `DeclaracaoConsumo` (a fiscalização adiada do Módulo 4 acontece aqui, para cada regra da ALRN); extrato do `salario_base` do Victor mostra cargo, fato de origem e versão da regra.

**Critérios de aceite:** `rush build && rush test` verdes no repositório INTEIRO; golden file commitado; um script `demo:victor` que roda o fluxo e imprime o contracheque com extrato — rode-o e cole a saída no PR.

**PORTÃO HUMANO:** revisar o extrato impresso linha a linha antes do Módulo 6.

---

## Módulo 6 — Retroatividade (Marco 2 — ⚠ TESTE DE FOGO)

### Instrução para Claude Code

**Contexto:** implementar a apuração de diferenças retroativas — a prova de fogo da arquitetura (Roteiro, Marco 2; Conceitual §5.3). Se o desenho estiver certo, este módulo é PEQUENO: duas execuções da `calcularFolha` já existente + uma subtração. Se você se pegar escrevendo lógica nova de cálculo, PARE e registre no DECISOES — é sinal de furo no desenho, e o humano precisa saber.

**Escopo — implemente (em `app-folha`):**

1. **`apurar-diferencas.ts`**: `apurar(competencia, tipoFolha)` → localiza a folha FECHADA da competência; executa "como foi pago" = `calcularFolha` com o corte selado da folha (deve bater byte a byte com os registros persistidos — ASSERTION interna: se não bater, exceção "reprodutibilidade violada"); executa "como deveria ser" = mesma chamada com corte agora; diff por história × rubrica: `DiferencaApurada { historiaId, rubrica, valorPago, valorDevido, diferenca, explicacaoNova }`.
2. **Detecção de alcance:** dado um fato ou versão recém-registrado, listar as competências fechadas alcançadas (efeito ≤ competência < registro). No MVP, função chamada manualmente pelo script.
3. **Script `demo:retroativo`**: parte do estado do Módulo 5 fechado; registra a promoção retroativa do Victor (efeito 15/02, registro hoje, com amparo `processo 123/2026`); apura fevereiro–junho; imprime a tabela de diferenças com explicação.

**Testes obrigatórios:** cenário Victor completo — diferenças exatamente iguais a (salário B8 − salário B6) proporcionais aos períodos, centavo a centavo; a assertion de reprodutibilidade (corrompa um registro persistido no teste e verifique a exceção); fato retroativo que NÃO muda valor (promoção para o mesmo cargo) ⇒ zero diferenças; competência não alcançada ⇒ fora da lista.

**Critérios de aceite:** o módulo é pequeno (se `apurar-diferencas.ts` passou de ~200 linhas, justifique no DECISOES); demo roda e imprime; NENHUMA lógica de cálculo nova.

**PORTÃO HUMANO OBRIGATÓRIO:** valide o demo manualmente. Se este marco passou limpo, a fundação está provada em código — registre a data no README do repositório. Só então autorize o Módulo 7.

---

## Módulo 7 — `importador-legado` (Marco 3)

### Instrução para Claude Code

**Contexto:** CLI que traduz dados do sistema legado em fatos bitemporais. Leia: Roteiro §3 (Marco 3, peça 1) e §4 (armadilha da bitemporalidade ausente). O formato de entrada real será definido pelo humano; implemente o pipeline com **fonte plugável** e uma fonte CSV de referência.

**Escopo — implemente (`packages/importador-legado`):**

1. **Contrato `FonteLegado`**: itera registros crus tipados (servidores, vínculos, eventos funcionais, contracheques-gabarito). Implementação `FonteCsv` com layout documentado em `docs/layout-importacao.md` (você escreve).
2. **Tradutores** registro cru → fatos, com as CONVENÇÕES EXPLÍCITAS do Roteiro: `data_registro := data_efeito` quando desconhecida (constante nomeada `CONVENCAO_REGISTRO_DESCONHECIDO`, referenciada no DECISOES); autor `{ tipo: 'importacao', lote }`; amparos pela porta `Amparo.legado()`; validação de conteúdo contra o catálogo com relatório de rejeições (registro rejeitado NÃO derruba o lote — vai para o relatório).
3. **Idempotência de lote:** reimportar o mesmo lote não duplica fatos (chave natural documentada no DECISOES).
4. **Gabarito:** contracheques legados importados para tabela própria `gabarito_legado` (fora da linha de fatos — é material de comparação, não fato do domínio).
5. **Relatório de importação:** totais, rejeições com motivo, amostra de fatos gerados por tipo.

**Testes obrigatórios:** tradução de cada tipo de registro contra CSVs de fixture; idempotência (importa 2x ⇒ mesmos fatos); rejeição parcial não derruba lote; convenção de data aplicada e visível no fato gerado.

**Critérios de aceite:** CLI `importar --fonte csv --dir ...` funcional; layout documentado; relatório legível; DECISOES com as convenções.

---

## Módulo 8 — `harness` de comparação (Marco 3 — "sombra")

### Instrução para Claude Code

**Contexto:** a ferramenta que compara o cálculo do MinimusRH com o gabarito do legado, servidor × rubrica × valor. Leia: Roteiro §3 (Marco 3, peça 3) e §4 (arredondamento; legado errado). É uma CLI sobre `app-folha` + a tabela `gabarito_legado`.

**Escopo — implemente (`packages/harness`):**

1. **Mapeamento de rubricas** legado⇄MinimusRH em arquivo de configuração (códigos do legado → chaves nossas), com relatório de rubricas não mapeadas dos dois lados.
2. **`comparar --competencia 2026-03`**: calcula a folha (simulação com corte = data da importação), cruza com o gabarito, produz `divergencias-2026-03.csv` (historia, rubrica, valorLegado, valorNosso, diferenca) + resumo (% de valores batendo, soma das diferenças, top divergências).
3. **Classificação persistente:** `classificacoes-2026-03.yml` onde o humano marca cada divergência como `nosso | legado | arredondamento | aberta` com nota; o resumo seguinte agrega por classe e **falha se existir `aberta`** (Roteiro: "divergência inexplicada é dívida — não passa").
4. **Modo diff de arredondamento:** para divergências ≤ R$ 0,02, sugerir automaticamente a classe `arredondamento` (sugerir, não classificar — o humano confirma).

**Testes obrigatórios:** batimento perfeito ⇒ 100% e exit 0; divergência aberta ⇒ exit ≠ 0; mapeamento incompleto reportado; agregação por classificação correta.

**Critérios de aceite:** rodar ponta a ponta com fixtures (importa CSV de gabarito → compara → classifica → resumo); saídas legíveis em planilha.

---

## Módulo 9 — Ampliação de regras (Marco 4 — batimento total)

### Instrução para Claude Code (sessões iterativas — uma por lote de regras)

**Contexto:** este módulo é um CICLO, não uma entrega única: análise de Pareto sobre o gabarito → implementar as próximas regras de maior valor → comparar → classificar → repetir, até o batimento total de 3 competências (Roteiro, Marco 4). O humano escolhe o lote de cada sessão.

**Em cada sessão:** (1) rode o harness e liste as rubricas do gabarito ainda sem regra, ordenadas por valor total; (2) implemente as regras/derivações do lote indicado pelo humano, no padrão do Módulo 4 (catálogo primeiro, contexto instrumentado, DECISOES para cada convenção descoberta); (3) rode a comparação e apresente o delta de batimento; (4) NUNCA "ajuste" uma regra para bater com o legado sem entender o porquê — se o legado parecer errado, classifique `legado` com a evidência (extrato nosso + memória de cálculo) e siga.

**Candidatos já especificados no conceitual** (§7.5–7.8, §8.4): terço de férias (classificação `compoe_terco`), desconto de auxílio não comprovado (fato de dívida + derivação `saldo_divida_auxilio` + regra dos 15% sobre `liquido_pre_amortizaveis` — atenção ao ciclo documentado), IR (tabela progressiva com dependentes como fatos), consignados (fatos de concessão).

**Critério de encerramento do módulo = critério do MVP (Roteiro §5, itens 1–4):** 3 competências com batimento total e divergências 100% classificadas; retroativo real demonstrado; golden test verde; zero `if` de domínio no motor.

**PORTÃO HUMANO:** MVP validado. Comemore, documente os erros de legado encontrados, e priorize o restante.

---

## Módulo 10 — `dsl` (Marco 5)

### Instrução para Claude Code

**Contexto:** parser e compilador da DSL de cálculo (Conceitual §7.6–7.8) para o contrato `VersaoRegra` do dominio. As regras em código e em DSL devem CONVIVER — a migração é regra a regra. Leia o §7 do conceitual INTEIRO antes de começar; a sintaxe lá é normativa.

**Escopo — implemente (`packages/dsl`):**

1. **Lexer + parser** da sintaxe do §7.6 (palavras-chave em português: `regra`, `produz rubrica`, `aplica-se a folhas:`, `quando`, `seja`, `resultado`, `se/então/senão`, literais `R$ 1.234,56` e `15%`), com erros de sintaxe em português citando linha/coluna e sugestão.
2. **AST tipada** + **verificador**: tipos (`dinheiro`×`percentual`×`numero` conforme §7.7 — `dinheiro + texto` é erro de COMPILAÇÃO), identificadores validados contra os catálogos (derivações, rubricas, classificações, tipos de fato), catálogo fechado de funções (§7.8: `menor`, `maior`, `soma`, `media`, `contagem`, `arredondar`, `proporcional`, `busca em tabela ... por ...`, `aplica tabela_progressiva ... sobre ...`).
3. **Extração de `DeclaracaoConsumo` por análise estática do AST** — o corpo É a declaração (§7.6); aqui a extração manual do MVP e a análise por parse convergem, como previsto no Design §7.
4. **Compilador** AST → `VersaoRegra` (closure pura que lê só o `Contexto`).
5. **Formato de tabelas** (§7.8) como dado versionado + `busca em tabela` e `tabela_progressiva` ligadas a ele.
6. **Prova de equivalência:** reescreva em DSL 3 regras existentes em código (sugestão: auxílio saúde, previdência, terço) e um teste que executa ambas as versões sobre as fixtures e sobre uma competência real do harness, exigindo igualdade byte a byte dos registros.

**NÃO implemente:** editor, autocomplete, diff de impacto (ferramental fica para depois; anote os pontos de extensão).

**Testes obrigatórios:** parser (casos válidos = os 4 exemplos do §7.6/§7.8 literalmente; inválidos: tipo errado, identificador inexistente, função fora do catálogo, ciclo detectável só após extração de consumo); extração de consumo confere com a leitura instrumentada em execução; equivalência código⇄DSL.

**Critérios de aceite:** os exemplos do conceitual compilam SEM ALTERAÇÃO; mensagens de erro em português compreensíveis por não-programador (cole 3 exemplos no PR); equivalência verde.

---

## Módulo 11 — `api` (NestJS)

### Instrução para Claude Code

**Contexto:** a casca HTTP fina sobre `app-folha` (Roteiro §2.5.6). REGRA DE OURO: nenhum import de `@nestjs/*` fora deste pacote; o motor entra via `useFactory` sem saber que o Nest existe. É AQUI (e só aqui) que o relógio existe: `dataRegistro` dos fatos novos é carimbada na entrada.

**Escopo:** endpoints mínimos — `POST /fatos` (valida pela porta do repositório; carimba registro; devolve o fato criado), `POST /folhas` + `POST /folhas/:id/calcular|corte|fechar`, `GET /folhas/:id/registros` e `GET /registros/:id/extrato` (a árvore renderizada), `POST /retroativos/apurar`. Um usuário técnico fixo (RBAC é pós-MVP). Validação de payloads com mensagens claras; erros do domínio (transição ilegal, ciclo, validação de schema) mapeados para HTTP com o texto original preservado.

**Testes obrigatórios:** e2e com supertest + Testcontainers cobrindo o fluxo Victor completo por HTTP (semear fatos → abrir → fechar → extrato → promoção retroativa → apuração); teste de arquitetura: grep de `@nestjs` fora de `packages/api` vazio; relógio: dois POSTs do mesmo fato ⇒ `dataRegistro` distintos e crescentes.

**Critérios de aceite:** OpenAPI gerado; fluxo demo executável via `curl` documentado no README.

---

## Módulos 12+ — Pós-MVP (ordem sugerida; instruções a detalhar quando chegar a hora)

Cada um destes merece instrução própria escrita no momento, com o aprendizado dos módulos anteriores — aqui apenas o escopo e as âncoras:

- **12. Consolidação entre folhas** (Conceitual §5.4): `LeitorDeJanelas` completo com os quatro eixos; grafo entre tipos de folha deduzido; fechamento exigindo dependências; teto incremental. Pré-requisito: tipos `suplementar`/`decimo_terceiro` nos catálogos.
- **13. Regras de consistência** (Conceitual §8): gatilhos por registro e por marco temporal (BullMQ), condição reutilizando o verificador da DSL, modos automático/pendência, grafo anti-cascata, idempotência por (versão × gatilhos).
- **14. RBAC** (Conceitual §6): atribuições como fatos; verbos fixos; restrições declarativas; aplicado na `api`.
- **15. Telas** (`web`, React): começar pelo visualizador de divergências do harness; depois registro de fato genérico por schema; depois folha/extrato.
- **16. Governança de catálogo** (Conceitual §9): catálogos para o banco; evolução aditiva verificada; relatório de impacto (reusa a extração de consumo da DSL).
- **17. Satélites** (contrato do Conceitual/discussão de módulos): exportação, eSocial, retorno bancário como fatos.

---

## Lembretes finais para o humano no circuito

- **Um módulo por sessão; revisão entre sessões.** O custo de revisar 8 DECISOES pequenos é muito menor que o de auditar um repositório inteiro gerado de uma vez.
- **Os DECISOES são o produto tanto quanto o código:** cada entrada é uma pergunta que os documentos de design ainda não respondiam — leve as relevantes de volta para os documentos da série (como fizemos durante todo o projeto).
- **O golden test e o teste bitemporal são o coração.** Se um dia alguém propuser "desligar temporariamente" qualquer um dos dois, a resposta está no §1 da Fundação.
