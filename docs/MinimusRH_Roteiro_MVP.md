# MinimusRH — Roteiro de Implementação do MVP (v1.1)

> Documento irmão do **Fundação e Modelo Conceitual (v2.9)**. Aquele diz *o que* o sistema é; este diz *em que ordem construir e como saber que está certo*.
>
> **Objetivo do MVP:** calcular folhas reais em sombra do sistema legado e bater os resultados centavo a centavo — validando a fundação com dados de verdade antes de investir nos andares superiores.
>
> **v1.1** — especialização para a stack confirmada: Node.js (NestJS + React) + PostgreSQL + Rush (§2.5).

---

## 1. Estratégia geral

**Fatia vertical, não camadas horizontais.** O erro clássico com um documento conceitual bom na mão é construir módulo a módulo (todo o sistema de fatos, depois todo o catálogo, depois...) e só descobrir no mês seis se a fundação aguenta. Aqui, cada marco atravessa o sistema de ponta a ponta e **prova uma coisa nomeável**.

**O legado é o gabarito — mas não é infalível.** Cálculo em sombra: importar os dados de uma competência real, calcular com o MinimusRH, comparar com o contracheque que o legado produziu. Toda divergência é investigada e classificada em três destinos:

1. **Erro nosso** → corrigir regra/derivação/importação.
2. **Erro do legado** → documentar (isso *vai* acontecer — shadow testing historicamente revela bugs de legado; cada um encontrado é argumento a favor do projeto novo).
3. **Diferença de arredondamento** → descobrir empiricamente a política real do legado e declará-la nas rubricas (será a primeira e maior fonte de divergência; resolver cedo).

**O que fica explicitamente FORA do MVP** (adiado, não esquecido): parser da DSL (marcos 1–4 usam regras em código; ver §3.3), regras de consistência, RBAC completo (um usuário técnico basta), telas de operação (linha de comando/scripts/planilha de saída bastam), consolidação entre folhas, eSocial e satélites, pendências e receitas. O MVP prova a **fundação**; o resto é acréscimo sobre chão provado.

**A regra que vale desde o commit um:** o §4 do documento conceitual pode ser *relaxado* no MVP (catálogo de tipos em arquivo de configuração é aceitável; não precisa de telas de governança) — mas `if tipo == 'auxilio_saude'` dentro do motor **continua proibido desde o primeiro dia**. Relaxar infraestrutura é reversível; poluir o motor não sai nunca mais.

---

## 2. Decisões de engenharia pré-Marco 1

*(As recomendações abaixo valem para qualquer stack madura com banco relacional; especializar quando a stack for confirmada.)*

### 2.1 Persistência da linha de fatos — a decisão mais consequente

| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| **(A) Tabelas append-only em banco relacional**, conteúdo do fato em coluna JSON/JSONB | Simples; auditável com SQL puro; derivações viram queries; backup/operação que o time já domina; funciona em qualquer stack | Disciplina de "nunca UPDATE/DELETE" é convenção + permissões de banco, não imposição da ferramenta | **Recomendada para o MVP** |
| (B) Event store dedicado (ex.: EventStoreDB) | Imutabilidade imposta pela ferramenta; assinaturas nativas | Peça operacional nova para aprender, operar e monitorar; curva de aprendizado no pior momento | Não para o MVP; reavaliar se (A) mostrar limites |
| (C) ORM com entidades mutáveis + tabela de auditoria | Familiar | **Contradiz a fundação** — o estado mutável vira a verdade e o histórico vira anexo; é o modelo do legado com outra roupa | **Rejeitada** |

**Esboço do esquema (opção A):**

```
fato(
  id, historia_id (ou pessoa_id), tipo, versao_do_tipo,
  conteudo JSONB,
  data_efeito, data_registro,
  autor, amparo,
  substitui_fato_id NULL  -- correção referencia o corrigido
)
-- índices: (historia_id, tipo, data_efeito), (data_registro), (tipo, data_efeito)
-- permissões de banco: papel da aplicação SEM update/delete nesta tabela
```

Fatos financeiros (§5.4 do conceitual) na mesma filosofia: `registro_calculo(folha_id, historia_id, rubrica, versao_rubrica, valor, arvore_explicacao JSONB)` — append-only, escritos no fechamento.

### 2.2 Derivações: on-the-fly primeiro, materializar depois

MVP: derivar sob demanda (query/função que percorre fatos até a data de referência). **Medir** com volume real importado do legado. Só materializar snapshots se a medição doer — e aí como cache reconstruível, jamais como verdade primária (Decisão 2 do conceitual). Otimização prematura aqui é o caminho de volta para o estado mutável.

### 2.3 Regras em código, mas com o modelo certo desde já

No MVP não há parser da DSL. Cada regra é uma classe/função na linguagem host implementando o contrato conceitual:

- declara rubrica produzida, tipos de folha, guarda (`quando`);
- recebe **contexto** (derivações + rubricas por classificação) e devolve valor — **função pura**: proibido acessar banco, relógio ou qualquer coisa fora do contexto (imposto por revisão de código e pela assinatura da interface);
- é **versionada**: `versao` + `data_efeito` como atributos; o motor resolve a versão vigente na competência.

O que se ganha: quando a DSL parseada chegar (Marco 5), ela compila para *este mesmo contrato* — as regras em código do MVP e as regras em DSL convivem, e a migração é regra a regra, sem big bang.

### 2.4 Dinheiro

Tipo decimal exato da linguagem e do banco (`DECIMAL`/`NUMERIC`), **nunca float**, do primeiro commit ao último. Política de arredondamento como atributo da rubrica, aplicada pelo motor no resultado — e calibrada contra o legado no Marco 3. *(Ver §2.5.2 — na stack escolhida, este item é crítico.)*

### 2.5 Especialização: Node.js (NestJS + React) + PostgreSQL + Rush

#### 2.5.1 Rush como imposição da arquitetura

A regra do §4 do conceitual ("domínio entra pelo catálogo, nunca pelo código do core") vira **estrutura de build**, não disciplina. Layout de pacotes proposto:

```
packages/
  dominio            # tipos: Fato, Contexto, Dinheiro, contrato de Regra — ZERO dependências
  motor              # grafo, resolução de versões, execução — depende só de dominio
  regras-alrn        # as regras em código (§2.3) — depende SÓ de dominio
  persistencia       # adapters Postgres (fatos, registros) — depende de dominio
  importador-legado  # CLI de importação (Marco 3)
  harness            # CLI de comparação e reprodutibilidade (Marcos 0 e 3)
  api                # NestJS, casca fina sobre o motor
  web                # React — FORA do MVP (no máximo, visualizador de divergências pós-Marco 4)
```

O que isso compra: uma regra em `regras-alrn` **não consegue** importar repositório ou tocar o banco — o Rush recusa o build. Pureza garantida estruturalmente. E `motor` sem dependência de NestJS significa que o harness roda como CLI puro, sem subir servidor.

#### 2.5.2 Dinheiro em JavaScript — o maior perigo da stack

`number` do JS é float (`0.1 + 0.2 !== 0.3`); 10.000 contracheques somados em float divergem do legado por centavos fantasmas que parecem erro de regra. Pacote de defesa completo, obrigatório desde o commit um:

1. `NUMERIC` no Postgres para todo valor monetário.
2. O driver `pg` devolve `NUMERIC` como **string** — jamais passar por `parseFloat`/`Number`.
3. `decimal.js` (ou centavos em `bigint`) como representação em memória.
4. **Branded type** `Dinheiro` no pacote `dominio` — impossível misturar com `number` no sistema de tipos.
5. Regra de ESLint proibindo aritmética nativa sobre valores monetários em `dominio`, `motor` e `regras-alrn`.

É o §7.7 do conceitual traduzido para a realidade hostil do JS.

#### 2.5.3 Postgres: append-only imposto e consulta bitemporal idiomática

- Papel de banco da aplicação: `GRANT INSERT, SELECT` na tabela de fatos e **nada mais** (`REVOKE UPDATE, DELETE`); trigger de exceção como cinto e suspensório. Migrações rodam com papel separado.
- `conteudo` em `JSONB`; índices de expressão para chaves quentes se necessário.
- Consulta bitemporal ("por chave, o fato mais recente em efeito, conhecido até o corte") tem padrão idiomático eficiente: `DISTINCT ON (tipo) ... ORDER BY tipo, data_efeito DESC, data_registro DESC` com filtro `data_registro <= corte`, sobre índice `(historia_id, tipo, data_efeito DESC, data_registro DESC)`. As derivações do MVP saem disso sem materializar nada (§2.2).
- `timestamptz` para data de registro; `date` para efeito; competência como `(ano int, mes int)` ou `'YYYY-MM'` — nunca `Date` do JS trafegando semântica de competência.

#### 2.5.4 ORM com moderação

Para a **linha de fatos e registros de cálculo**: repositórios com SQL explícito ou query builder tipado (ex.: Kysely) — ORM de entidade mutável ali é convite para alguém "salvar" um fato editado. Para tabelas periféricas (configuração, controle de importação): o ORM que o time preferir (TypeORM/Prisma), sem cerimônia.

#### 2.5.5 Miscelânea da stack

- TypeScript `strict`; branded types também para `HistoriaId`, `Competencia`, etc.
- Testes com o runner da casa (Jest/Vitest); o teste de reprodutibilidade do Marco 0 como *golden test* — resultado serializado e comparado byte a byte.
- Marcos temporais das regras de consistência (pós-MVP) mapeiam naturalmente para jobs (ex.: BullMQ) — anotado para o futuro, fora do MVP.
- React/`web` só entra depois do Marco 4, começando pelo visualizador do relatório de divergências — a primeira tela nasce servindo à validação, não à operação.

#### 2.5.6 Onde o NestJS entra (e onde não) — estratégia de testes

| Tipo de teste | O que exige | Ferramenta | NestJS? |
|---|---|---|---|
| **Unitário** (regras, motor, derivações, grafo) | Nada além de TS puro — regra é função pura | Vitest/Jest direto, milissegundos | **Não** |
| **Integração** (persistência) | Postgres real (append-only por permissão, `DISTINCT ON`, NUMERIC-como-string não se mockam com honestidade) | Testcontainers / docker-compose de teste; repositório instanciado com pool do `pg` | **Não** |
| **E2E do MVP** | fatos importados → motor → folha fechada → **comparação com o legado** | O harness (CLI sobre `motor` + `persistencia`) | **Não** |
| E2E HTTP (supertest) | API com consumidor real | Módulo de teste do Nest | Sim — quando a API existir (Marco 3+) |

**Regras desta decisão:**

- O e2e que valida o projeto é o harness, não HTTP. Testar controllers antes de existir consumidor é testar a casca antes do miolo.
- Usar `Test.createTestingModule` para testar o motor tentaria decorá-lo com `@Injectable()` — acoplando o core ao framework, exatamente o que o layout de pacotes impede. O Nest hospeda o motor via `useFactory` **sem o motor saber**; a casca conhece o miolo, nunca o contrário.
- **Meio-termo aceitável:** criar o pacote `api` com scaffold do Nest no dia um não faz mal, desde que a regra de ouro seja verificada por lint: *nenhum import de `@nestjs/*` fora do pacote `api`*. O perigo nunca foi o Nest existir cedo; é o core nascer dentro dele.

---

## 3. Os marcos

### Marco 0 — Fundações técnicas (curto, mas inegociável)

Esquema de fatos e registros de cálculo; contrato de regra; motor mínimo (montar contexto → executar regras na ordem do grafo → produzir registros); e o **harness de reprodutibilidade** como teste automatizado permanente: *mesma folha + mesmo corte ⇒ mesmo resultado, centavo a centavo*. Este teste roda em toda mudança, para sempre — reprodutibilidade é a propriedade que regressões corroem em silêncio.

**Prova:** o esqueleto executa e o teste de reprodutibilidade está verde.

### Marco 1 — "O Victor recebe"

Meia dúzia de tipos de fato em configuração (posse, promoção, nascimento...); derivações `cargo` e `idade`; duas ou três regras puras (salário por cargo, um adicional simples); uma folha Mensal que **calcula, trava corte e fecha**; extrato de cálculo com árvore de explicação.

**Prova:** a cadeia inteira — fato → derivação → regra → folha → registro explicável — funciona de ponta a ponta.

### Marco 2 — "O Victor é promovido retroativamente" ⚠ TESTE DE FOGO

O fato com efeito em fevereiro registrado em julho. Recalcular as competências afetadas nas duas leituras do tempo ("como foi pago" × "como deveria ser") e apurar a diferença por subtração.

**Prova:** a bitemporalidade funciona *em código*, não só no papel. **Se este marco passar, a fundação está provada e todo o resto é acréscimo. Se algo no desenho estiver errado, aparece aqui — com semanas de investimento, não meses.** Não avançar ao Marco 3 com o Marco 2 manco.

### Marco 3 — "Sombra do legado, uma competência"

O coração do MVP, em três peças:

1. **Importador legado → fatos.** O desafio real do marco. O legado guarda *estado*, não fatos bitemporais; a tradução exige convenções documentadas — por exemplo: para dados históricos sem data de registro conhecida, `data_registro := data_efeito` (ou a data da importação), registrado como convenção no próprio documento. Importar um recorte: os servidores e os dados necessários para uma competência.
2. **O conjunto mínimo de regras da folha real.** Replicar (em código, §2.3) as regras que produzem as rubricas daquela competência — começando pelas de maior valor/frequência (salário, anuênio, previdência, IR, auxílio saúde via tabela por idade, terço se houver férias no recorte).
3. **Harness de comparação.** Contracheques do legado importados como gabarito; relatório de divergência **por servidor × rubrica × valor**; painel simples (planilha serve): % de batimento, divergências classificadas (erro nosso / erro do legado / arredondamento).

**Prova/meta:** batimento alto (≥95% dos valores) com **todas** as divergências restantes explicadas e classificadas. Divergência inexplicada é dívida — não passa.

### Marco 4 — "Três competências, batimento total"

Ampliar cobertura de regras até bater as competências escolhidas na íntegra (idealmente incluindo uma com proporcionalidade — servidor que entrou no meio do mês — e uma virada de faixa etária do auxílio saúde, para provar as derivações dependentes de calendário). Se o recorte permitir, incluir um 13º ou uma suplementar simples *sem* consolidação (a consolidação entre folhas fica fora do MVP).

**Prova:** o modelo cobre a folha real da ALRN, não um subconjunto de brinquedo. Aqui o MVP está **validado** e vira argumento: "calculamos N competências reais e batemos/achamos X erros no legado".

### Marco 5 — DSL parseada (pós-validação)

Parser da sintaxe do §7.6 do conceitual compilando para o contrato de regra do §2.3; migrar duas ou três regras de código para DSL e provar equivalência com o harness (mesmo resultado das versões em código); autocomplete e diff de impacto rudimentares.

**Prova:** o contador poderá escrever regras — e a arquitetura de "regras em código e em DSL convivendo" funciona.

### Marco 6+ — os andares superiores (fora do MVP)

Regras de consistência, RBAC completo, telas de operação, consolidação entre folhas, governança de catálogo com aprovação, eSocial e satélites — cada um sobre chão já provado, na ordem que a necessidade ditar.

---

## 4. Riscos e armadilhas mapeados

- **Dados legados sem bitemporalidade.** Inevitável; a resposta é convenção documentada na importação (§3, Marco 3, peça 1), nunca inventar datas de registro "plausíveis" silenciosamente.
- **Arredondamento.** Será a primeira enxurrada de divergências. Descobrir a política real do legado empiricamente (inclusive inconsistências internas dele) e declará-la por rubrica. Não caçar centavo por centavo antes de calibrar isso.
- **Legado errado.** Vai acontecer. Divergência ≠ erro nosso automaticamente; a classificação em três destinos (§1) é obrigatória e cada "erro do legado" documentado é ativo político do projeto.
- **Escopo creep de telas.** O MVP não tem interface de operação. Scripts e planilhas de saída. Toda energia de tela antes do Marco 4 é energia roubada da validação.
- **O atalho de sexta-feira.** `if tipo == '...'` no motor: proibido desde o commit um (§1).
- **Volume.** Importar um recorte pequeno primeiro (dezenas de servidores), mas rodar o Marco 4 com a competência completa — performance de derivação se mede com volume real (§2.2).

---

## 5. Critério de encerramento do MVP

O MVP está concluído e a fundação, provada, quando **todas** as afirmações abaixo forem verdadeiras:

1. Três competências reais calculadas com batimento total contra o legado, com divergências residuais 100% classificadas.
2. Um retroativo real (ou realista) apurado por subtração entre as duas leituras do tempo, com extrato explicável.
3. O teste de reprodutibilidade automatizado verde desde o Marco 0, sem exceções toleradas.
4. Nenhum `if` de domínio no motor (revisão de código confirma).
5. Ao menos duas regras rodando via DSL parseada com equivalência provada contra suas versões em código *(Marco 5 — pode ser destacado do critério se a decisão for validar antes e parsear depois)*.

---

## 6. Pendências para especializar este roteiro

- ~~**Stack confirmada**~~ — **resolvido** (§2.5): NestJS + React + PostgreSQL + Rush.
- **Recorte da primeira competência-sombra**: qual mês, quantos servidores, quais rubricas cobrem a maior parte do valor (análise de Pareto sobre o contracheque legado define a ordem das regras no Marco 3).
- **Acesso aos dados do legado**: forma de extração (dump, views, relatórios) e quem autoriza.
