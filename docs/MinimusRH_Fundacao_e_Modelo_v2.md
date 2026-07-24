# MinimusRH — Fundação e Modelo Conceitual (v2.9)

> Documento consolidado a partir da construção conjunta das ideias, partindo do básico. Substitui e reorganiza o rascunho original ("Sistema Financeiro e de Gestão de Pessoas Configurável"). Ao final, há um registro do que foi **eliminado** do rascunho original e por quê — para preservar o raciocínio, não só as conclusões.
>
> **v2.1** — acrescenta: tipos de folha (folhas paralelas na mesma competência), o catálogo de tipos de fato como peça central, e a separação formal de escopos (fato × derivação × regra × conveniência).
>
> **v2.2** — acrescenta: consolidação entre folhas (§5.4) — fechamento produz fatos financeiros, consumo declarado em quatro eixos, grafo de fechamento deduzido automaticamente. Flexível no *quê*, rígido no *como*.
>
> **v2.3** — calibra e fecha a consolidação: teto incremental sobre todas as folhas do mês, ordem de fechamento como decisão com efeito financeiro, decisões de negócio (margem consignável, médias) formalmente adiáveis como parâmetros de regra.
>
> **v2.4** — ciclo de vida da folha (§5.5): quatro estados, corte de conhecimento, sem reabertura, transições como fatos, pagamento fora da máquina.
>
> **v2.5** — RBAC configurável (§6): verbos fixos no core, papéis/escopos/segregação como configuração da instituição, atribuição de papel como fato bitemporal, modo Deus como permissão auditável.
>
> **v2.6** — DSL de cálculo (§7): linguagem deliberadamente fraca (pura, sem tempo, sem laço), quatro formas de ler o contexto, tabelas + expressões, separação entre DSL de cálculo e regras de consistência. Validada contra três casos reais da ALRN (auxílio saúde, licença-prêmio, terço de férias).
>
> **v2.7** — regras de consistência (§8): gatilhos por registro de fato e por marco temporal, condição na linguagem da DSL, efeito em modo automático ou pendência, grafo anti-cascata, idempotência, correção sem apagamento silencioso.
>
> **v2.8** — sintaxe concreta da DSL (§7.6–7.8): português como língua, `quando` como guarda de aplicabilidade, `seja` como nome imutável, tipo `dinheiro` exato com arredondamento por política de rubrica, catálogo fechado de funções, tabelas versionadas como formato irmão, ferramental (autocomplete, simulação, diff de impacto).
>
> **v2.9** — governança dos catálogos (§9): governança única para os cinco catálogos, evolução aditiva de schema, relatório de impacto na publicação, antídotos à duplicação semântica, aprovação por padrão via RBAC, depreciação sem morte de dependentes.

---

## 1. O propósito, na frase mais curta possível

> **Dado um conjunto de pessoas e o que aconteceu com elas ao longo do tempo, calcular corretamente quanto cada uma deve receber num período — e conseguir provar como chegou nesse número.**

Essa frase carrega três compromissos que orientam todas as decisões seguintes:

1. **"O que aconteceu ao longo do tempo"** — o sistema é, na essência, um registro de fatos temporais. A folha é uma *consequência* dos fatos, não a entidade central.
2. **"Calcular corretamente num período"** — o cálculo é uma função: entram fatos + regras, saem valores. Mesma entrada, mesma saída, sempre (reprodutibilidade).
3. **"Provar como chegou"** — auditoria não é um módulo; é uma propriedade do desenho.

---

## 2. A fundação: três decisões

Todo o restante do sistema é consequência destas três decisões. Elas não são negociáveis sem derrubar o edifício.

### Decisão 1 — Fatos imutáveis com duas datas

A unidade básica do sistema é o **fato**: algo que aconteceu com alguém. Todo fato responde a quatro perguntas:

| Pergunta | Campo |
|---|---|
| Com quem aconteceu? | Referência à pessoa (ou à história/vínculo) |
| O que aconteceu? | Tipo + conteúdo (ex.: "promovido a", valor "TEC_LEGISLATIVO_B8") |
| Desde quando vale? | **Data de efeito** |
| Quando ficou sabendo, e quem registrou? | **Data de registro** + autor |

As duas datas são distintas e **ambas obrigatórias** (bitemporalidade). O cenário que justifica:

> Em 10 de julho chega um processo concedendo progressão ao Victor para B8, **com efeito retroativo a 15 de fevereiro**.

Com uma data só, o sistema é forçado a mentir: ou registra 15/02 (mas em fevereiro ninguém sabia disso — e as folhas de março a junho foram calculadas *corretamente* sem essa informação), ou registra 10/07 (mas o direito existe desde fevereiro). Com as duas datas, o sistema responde às duas perguntas que a auditoria fará:

- **"O que sabíamos em abril?"** → cargo B6. A folha de abril pagou B6 e estava **certa** com a informação da época.
- **"O que vale para abril, com o que sabemos hoje?"** → cargo B8. Por isso existe uma diferença a pagar.

**Corolário — fatos nunca são apagados nem editados.** Erro de registro se corrige com um *fato novo* que substitui o anterior, com sua própria data de registro e autor. O erro permanece no histórico — exatamente o que "provar como chegou nesse número" exige. O "modo Deus" do rascunho original sobrevive, mas transformado: ele não edita o passado, ele **adiciona fatos com autoridade especial**, rastreados como quaisquer outros.

Campo adicional relevante: **amparo** — o processo, portaria ou resolução que sustenta o fato (ex.: concessões individuais). Ouro em auditoria.

### Decisão 2 — Estado sempre derivado, nunca armazenado como verdade primária

Perguntas como "qual o cargo do Victor em 20/04?" não são respondidas por registros guardados, mas por **derivação**: percorre-se a linha do tempo de fatos até a data de referência e vale o último fato que se pronunciou sobre aquela chave.

Regra geral: **para cada chave, em cada instante, vale o fato mais recente (em efeito) que se pronunciou sobre ela.**

Consequências imediatas:

- **Vigências manuais (DataInicio/DataFim) desaparecem.** O fim da vigência de um valor é, automaticamente, o início do próximo fato sobre a mesma chave. Menos uma coisa para o usuário errar.
- **Derivações que mudam sozinhas funcionam sozinhas.** A idade do servidor muda todo ano sem que ninguém registre nada — porque idade nunca foi fato armazenado; é derivação do fato "nascimento" contra a data de referência da folha. Quando o servidor muda de faixa etária, o valor do auxílio saúde muda na folha certa, sem intervenção humana.
- **Dias trabalhados na competência** é outra derivação da mesma família: o motor olha os fatos (história aberta dia 15? licença sem remuneração no meio?) contra o calendário da competência e deriva `dias_trabalhados` (ou o fator de proporcionalidade). Resolve a pendência de proporcionalidade do rascunho original sem mecanismo novo.
- **Avos do décimo terceiro** idem: meses trabalhados no ano derivados dos fatos contra o calendário (`avos = 8/12`), sem registro manual.

### Decisão 3 — Regras (e rubricas) versionadas como fatos

As regras de cálculo também têm história: "a partir de 01/01/2024 vale a tabela Y" é um **fato sobre a regra**, com data de efeito e data de registro. Ninguém edita a versão antiga; **publica-se uma versão nova**. O mesmo vale para as classificações de rubricas (uma lei pode tornar incidente uma verba que não incidia) — e para o próprio **catálogo de tipos de fato** (§3.4).

Consequência central: quando o motor calcula uma folha, ele cruza **duas linhas do tempo na mesma data de referência** — os fatos do servidor como valem naquela competência e as versões das regras como valem naquela competência. Um recálculo da folha de março de 2023 usa os fatos de março de 2023 **e as regras de março de 2023**. Sem isso, recálculos retroativos pagariam valores de hoje para períodos de ontem — erro clássico de apontamento de tribunal de contas.

---

## 3. O modelo de domínio

### 3.1 Pessoa

Quem é: dados civis, identificadores. Fatos podem existir sobre a Pessoa antes de qualquer vínculo (ex.: nascimento — insumo da derivação de idade).

Identificadores (mantidos do rascunho original):

- **Identificador do sistema** — formato configurável por instituição (sequencial, com bloqueio de ranges para convivência com legado, etc.).
- **Identificador administrativo** — geração plugável: manual (usuário autorizado informa) ou incremental.
- **Identificador legado** — campo para identificadores de sistemas antigos quando não forem reaproveitados.

### 3.2 História

Um **capítulo da linha do tempo**: período ininterrupto em que a pessoa está a serviço do órgão. A História não é um container que se enche de atributos — é o trecho **delimitado por fatos especiais**:

- **Fato de abertura**: posse, admissão.
- **Fato de encerramento**: exoneração, aposentadoria.

Uma pessoa pode ter várias Histórias (saiu, prestou outro concurso, voltou). Isso importa: contagens como anuênio ocorrem *dentro do capítulo*.

### 3.3 Fatos

Tudo o que acontece dentro (ou fora, no caso de fatos de Pessoa) de um capítulo, com a anatomia da Decisão 1. Exemplos:

- "Tomou posse em 01/03" (abertura de História)
- "Promovido a TEC_LEGISLATIVO_B8, efeito 15/02, registrado 10/07 por fulano, processo nº X"
- "Apresentou comprovante de plano de saúde, mensalidade R$ 480, válido para o período tal"
- "Concedido incentivo ao estudo de 15%, a partir de 01/08, processo nº Y" (concessão individual — ver §3.8)
- "Exonerado em 30/09" (encerramento de História)

Todo fato registrado pertence a um **tipo cadastrado no catálogo** — a peça a seguir.

### 3.4 Catálogo de tipos de fato

O catálogo é o **dicionário de acontecimentos possíveis** da instituição — mantido pela própria instituição (configuração), não por programadores (código). É a fronteira formal entre o genérico (core) e o específico (domínio da ALRN). Cada entrada do catálogo define um tipo de fato respondendo a três perguntas:

**1. Como esse fato se chama e sobre o que ele fala?**
Chave única com nomenclatura controlada (`comprovacao_plano_saude`, `promocao`, `posse` — sem espaços, acentos ou maiúsculas), descrição legível, e o alvo: fato sobre **Pessoa** (nascimento) ou sobre **História** (promoção).

**2. Qual o conteúdo — o que o usuário preenche?**
Um pequeno **schema** com os campos do conteúdo, tipos e validações. Exemplo para `comprovacao_plano_saude`:

| Campo | Tipo | Validação |
|---|---|---|
| `operadora` | texto | obrigatório |
| `mensalidade` | valor monetário | obrigatório, > 0 |
| `periodo_fim` | data | obrigatório |

A tela de registro é **montada a partir do schema** e o preenchimento é validado contra ele. Por isso uma tela genérica de "registrar fato" funciona desde o dia um, sem conhecer nenhum tipo específico.

**3. Quais as condições para o fato ser aceito?**
Exige amparo (nº de processo)? Quem pode registrar (permissões)? Há validação de **estado derivado** (ex.: exoneração só é aceita se `situacao_funcional = ativo` na data)? Este bloco transforma o catálogo de dicionário passivo em guardião de consistência.

**O que NÃO está no catálogo:** valores, tabelas, faixas, cálculos. O catálogo define *o que se registra*; quanto isso vale em dinheiro é assunto das regras. Os campos de **efeito, registro, autor e amparo** também não aparecem no schema — são a anatomia fixa de todo fato, garantida pelo core; o schema define só o conteúdo variável.

**O catálogo também tem história.** Se uma resolução passar a exigir CNPJ da operadora, publica-se uma versão nova do tipo com o campo adicional. Fatos antigos permanecem válidos e legíveis: cada fato guarda referência à versão do tipo sob a qual nasceu. Nunca se migra fato antigo para schema novo — o passado permanece como era.

**O catálogo é o antídoto contra a anarquia.** Sem ele, o modelo de fatos livres degeneraria (`cargo` vs. `Cargo`, tipos inventados por operadores, regras que não encontram o que procuram). Com ele: só se registra fato de tipo cadastrado, com conteúdo validado. A flexibilidade fica onde deve (a instituição define seus tipos) e a disciplina também (definido o tipo, todos o usam igual).

*Linhagem:* o catálogo é o herdeiro de duas peças do rascunho original — a tabela de validação de chaves de atributo e os campos metadados (Coluna1, Coluna2...) — fazendo o serviço das duas com schema explícito, validação e versionamento.

### 3.5 Atributos (derivações)

**Atributo é uma pergunta, não uma coisa.** "Cargo", "lotação", "situação funcional", "idade", "dias trabalhados na competência", "avos" — todos são **estados derivados** dos fatos numa data de referência. O conflito do rascunho original entre as duas definições de Atributo (`{rotulo, valor}` vs. `{chave, valor}`, cardinalidades divergentes) se dissolve: a regra é uma só e natural — para cada chave, em cada instante, vale o fato mais recente sobre ela.

### 3.6 Rubricas

Categorização dos valores da folha. Cada rubrica declara:

- **Nome** e **natureza**: vantagem, desconto ou informativa (mantido do rascunho).
- **Classificações**: *incide previdência? incide IR? compõe base de férias? entra no líquido? é proporcionalizável?* — a informação de "quem entra na base" mora **na rubrica**, não nas regras que calculam bases.
- **Versionamento**: classificações mudam com o tempo (Decisão 3).

Exemplo concreto (ALRN): `salario_base` incide previdência; `auxilio_saude` não incide. A regra da previdência não conhece rubricas individualmente — soma "todas as marcadas com *incide previdência*". Quando uma gratificação nova for criada, ninguém precisa lembrar de mexer na regra da previdência: basta classificar a rubrica corretamente no ato da criação. Elimina uma fonte clássica de erro de folha (listas espalhadas e desatualizadas).

A marcação **proporcionalizável** declara na rubrica — visível e versionado, em vez de enterrado em scripts — se ela sofre o fator de dias trabalhados (salário sim; auxílio saúde talvez integral).

### 3.7 Regras

Uma regra declara **quatro** coisas:

1. **O que produz**: sua rubrica de saída — mantendo a tupla `<valor, rubrica>` do rascunho original. Toda regra produz exatamente uma rubrica.
2. **O que consome**: derivações (`cargo`, `idade`, `dias_trabalhados`, fatos de concessão) e/ou valores de outras rubricas — individualmente ou **por classificação** (ex.: "todas as que incidem previdência").
3. **A quais tipos de folha se aplica** (§3.10): a vigência da regra tem duas dimensões — **tempo e finalidade**. A regra do salário base vale "a partir de janeiro, *para folhas mensais*"; a do 13º vale para folhas do tipo Décimo Terceiro. Uma regra pode servir a mais de um tipo (pensão alimentícia incide na mensal *e* no 13º; consignado talvez só na mensal).
4. **A lógica**: o corpo do cálculo, na DSL (a detalhar em etapa futura).

Regras são **versionadas** (Decisão 3). "Regra depreciada" = versão com fim de efeito.

**Escopo:** o normal é a regra ser global — vale para quem tiver os fatos/derivações que ela consome. Regra restrita a uma única história é caso **raro e legítimo** (ex.: decisão judicial com fórmula exótica), tratado como raro.

### 3.8 Concessões individuais são fatos, não regras

Confirmado contra a realidade da ALRN: a esmagadora maioria dos "casos individuais" (percentual de incentivo ao estudo, pensão alimentícia, consignados) são **valores/percentuais próprios de uma pessoa** — ou seja, **fatos concedidos**, com efeito, registro, autor e amparo. A *lógica* é sempre uma regra global: "quem tem fato vigente de incentivo ao estudo recebe X% sobre tal base". Quem não tem o fato, a regra simplesmente não produz rubrica.

Isso encolhe drasticamente a operação: em vez de criar/gerenciar regras por pessoa, o dia a dia é **registrar fatos** — que é exatamente o que o setor de pessoal já faz no papel.

### 3.9 Operações customizadas viram receitas

A "operação de exoneração" do rascunho original, com pré-requisitos e passos, vira algo mais simples: **uma receita que valida o estado derivado e insere um ou mais fatos de uma vez**.

- Validação: "só aceita fato de exoneração se o estado derivado na data for `situacao_funcional = ativo`".
- Efeito: insere o fato de encerramento (e eventuais fatos acessórios).

Sem maquinaria de identificação individual de regras/atributos para remoção — pendência do rascunho que deixa de existir.

### 3.10 Folha e tipos de folha

A Folha é o **encontro das duas linhas do tempo numa competência** (mês/ano): fatos como valem na competência × versões de regras/rubricas como valem na competência — **filtrado pelo tipo da folha**.

Existe um catálogo pequeno de **tipos de folha** — Mensal, Suplementar, Décimo Terceiro, e o que mais a instituição precisar. É configurável, mas muda raramente. Na mesma competência podem coexistir várias folhas de tipos diferentes, **trabalhadas em paralelo** (realidade da ALRN: a suplementar é conferida enquanto a mensal está aberta). Como cada folha é um encontro independente das mesmas linhas do tempo imutáveis, uma não contamina a outra.

- Por padrão, a folha **não seleciona regras**: "Folha Mensal de agosto" nasce com tudo que está **vigente para o tipo Mensal** em agosto; "13º de 2026" nasce com as regras do tipo Décimo Terceiro. Ninguém monta lista de regras todo mês — o problema que o "Grupo de Regras" do rascunho tentava resolver, agora resolvido por declaração na própria regra (mesma família da decisão das classificações de rubrica: a informação mora em quem é classificado, não em listas externas).
- **Folha finalizada é imutável e reproduzível**: dado o conhecimento da época (fatos + versões de regras com data de registro ≤ fechamento), o recálculo devolve o mesmo resultado, centavo a centavo.

### 3.11 Registros de Cálculo

A saída do cálculo: valor, rubrica, história — **e a explicação**. Cada registro é raiz de uma árvore explicável: a contribuição de R$ 1.240 veio da base de R$ 11.300, que somou estas cinco rubricas, cada uma produzida por tal *versão* de tal regra sobre tais fatos. É o "provar como chegou nesse número" materializado.

### 3.12 Eventos

Mantidos do rascunho como mecanismo de integração: operações relevantes (novo servidor, encerramento de História, fechamento de folha) publicam eventos para quem estiver escutando (ex.: eSocial). Observação estrutural: com fatos imutáveis, a própria linha de fatos já *é* um log de eventos — a publicação para consumidores externos torna-se uma projeção natural dessa linha, e a auditoria não depende de um mecanismo paralelo.

---

## 4. Separação de escopos: a higiene do modelo

O core conhece exatamente estes conceitos, e esta lista **não cresce nunca**: **Fato, História, Derivação, Rubrica, Regra, Folha** (+ os catálogos que os configuram). Auxílio saúde, promoção, cessão, auxílio creche — nada disso entra no *modelo*; entra como *dado que obedece ao modelo*, via catálogo.

### As quatro naturezas

> **Fato** — aquilo que chega de fora: alguém informa, tem autor, tem amparo, poderia estar num processo de papel. *"O mundo mudou."*
>
> **Derivação** — o que se calcula a partir de fatos, sem ninguém informar nada. *"Consequência automática."*
>
> **Regra** — a transformação de fatos e derivações em dinheiro. *"Como se calcula."*
>
> **Receita / tela** — o que facilita registrar fatos. *"Conveniência de operação."*

### O teste prático

Para qualquer novidade que aparecer:

- *Precisa que alguém registre, com data e responsável?* → **Fato** (novo tipo no catálogo).
- *Decorre sozinho de coisas já registradas?* → **Derivação**.
- *É conta?* → **Regra**.
- *É só tornar o registro mais fácil?* → **Camada de conveniência** (tela específica, receita).

### Por que não "tudo vira regra"

Se o comprovante do plano de saúde virasse edição na regra, misturaríamos duas naturezas: **o que o mundo informou** e **como se calcula**. Cada comprovante geraria versão nova de regra; o histórico de versões viraria mistura de legislação com atualização cadastral de centenas de pessoas; e a pergunta de auditoria "quando essa tabela mudou?" ficaria soterrada em ruído. Fatos de auxílio saúde não são "adicionais para facilitar" — são o **lugar correto do dado**. A facilitação mora um andar acima: a tela específica que conhece os campos, valida o comprovante e, no fim, faz uma coisa só — **insere um fato**. Se essa tela for deletada um dia, nenhum dado se perde e nenhum cálculo quebra: ela nunca foi dona de nada, só uma porta de entrada.

### Regra de arquitetura (inegociável)

> **Domínio entra pelo catálogo, nunca pelo código do core.**
>
> O dia em que existir uma tabela `auxilio_saude` ou um `if tipo == 'auxilio_saude'` dentro do motor, a poluição começou. Esse tipo de erosão acontece por atalho bem-intencionado numa sexta-feira — por isso fica escrito aqui.

---

## 5. O motor de cálculo

### 5.1 Ordem de execução pelo grafo de rubricas

As dependências são **entre rubricas, não entre regras**. Cada regra declara o que produz e o que consome; o motor monta o grafo e a ordem de execução *decorre* dele:

1. Regras que dependem só de derivações (salário, anuênio, auxílios);
2. Regras que dependem das anteriores (bases, previdência, IR);
3. Regras que fecham (ex.: `total_liquido`).

A distinção "globais primeiro, individuais depois" do rascunho deixa de ser mecanismo e vira consequência natural do grafo.

**Brindes do grafo:**

- **Ciclos detectados na publicação da regra** — com mensagem clara, e não no fechamento da folha às 18h do dia de pagamento.
- **Extrato explicável em árvore** (§3.11).

### 5.2 Passos do cálculo de uma competência

1. **Seleção de histórias**: derivar o estado de cada história na data de referência e filtrar as que participam (ex.: `situacao_funcional = ativo`).
2. **Montagem do contexto**: derivações por história (cargo, idade, dias trabalhados, avos, fatos de concessão vigentes).
3. **Resolução das versões**: para cada regra e rubrica, a versão vigente na competência **e aplicável ao tipo da folha**.
4. **Execução na ordem do grafo**, produzindo Registros de Cálculo com suas árvores de explicação.

### 5.3 Retroatividade: uma subtração, não um módulo

O que hoje é "calculado manualmente" (planilha paralela, valor digitado de volta que a auditoria não explica) vira operação nativa do motor. Cenário: em julho sai resolução mudando a tabela do auxílio saúde **com efeito a partir de março**.

No sistema, isso é **um único ato**: publicar nova versão da regra com data de efeito 01/03 (data de registro: hoje). O motor então:

1. Detecta versões de regra (ou fatos novos) cujo efeito alcança **folhas já finalizadas**;
2. Para cada competência afetada, roda o mesmo cálculo duas vezes:
   - **Como foi pago** — fatos e regras *como conhecidos na época* (a folha finalizada, reproduzível);
   - **Como deveria ser** — fatos e regras *como valem hoje para aquela data*;
3. A **diferença** entre as duas é o retroativo — servidor por servidor, rubrica por rubrica, centavo por centavo, com explicação completa (tabela X vs. tabela Y, versão tal, publicada por fulano em tal data).

**Princípio fixado:** a folha paga **não é alterada**. A diferença apurada vira **lançamentos novos em folha corrente ou suplementar**, com referência explícita à competência de origem ("diferença de auxílio saúde, competência 03/2026"). Motivos: contábil (o pagamento sai no mês em que sai) e tributário (diferenças de competências anteriores podem ter tratamento próprio de IR/previdência — que, sendo regra de cálculo, também é versionável).

O mesmo mecanismo cobre o retroativo por **fato** (a promoção do Victor com efeito em fevereiro, registrada em julho): nenhuma diferença estrutural entre "regra mudou retroativamente" e "fato chegou atrasado".

### 5.4 Consolidação entre folhas (folhas que enxergam outras folhas)

Casos reais que exigem que uma folha veja o resultado de outras: abate-teto (soma do que a pessoa recebeu no mês em todas as folhas), margem consignável (líquido de referência), médias de rubricas variáveis (13º, férias). O desenho segue a fundação — nenhum mecanismo estruturalmente novo:

**Peça 1 — Fechar uma folha é produzir fatos financeiros.** No fechamento, os Registros de Cálculo passam a valer como fatos: "na competência 07/2026, na folha Mensal, a história X recebeu R$ 11.300 na rubrica Y". Eles já têm a anatomia completa — efeito (a competência), registro (o fechamento), autor (quem fechou), imutabilidade (folha fechada não muda). O problema "folha enxerga folha" se reduz ao já resolvido: **regra consome fato**.

**Peça 2 — Consumo declarado em quatro eixos (flexível no *quê*).** Em vez de pares fixos predefinidos ("Suplementar consome Mensal"), cada regra declara seu consumo de fatos financeiros de forma genérica:

| Eixo | Opções |
|---|---|
| **Tipos de folha** | um, vários, ou todos ("qualquer folha da competência") |
| **Janela de competências** | corrente, anterior, últimas N, ano civil |
| **Rubricas** | individualmente ou por classificação |
| **Agregação** | soma, média, máximo |

Exemplos: abate-teto = *soma, todas as folhas, competência corrente, classificação "compõe teto"*; margem consignável = *líquido, competência anterior, folhas mensais*; médias do 13º = *média, últimas 12 competências, rubricas variáveis*. O benefício imprevisto de 2028 se declara nos mesmos quatro eixos, sem tocar no core. Médias sobre janelas não são caso especial — nascem do mecanismo.

**Peça 3 — Reprodutibilidade garantida pelo motor (rígido no *como*).** A alternativa implícita ("consome o que estiver fechado na hora") foi **rejeitada**: faria o resultado depender da hora em que se apertou o botão, quebrando o compromisso de fundação. Em vez disso:

- O **grafo de dependências entre tipos de folha é deduzido automaticamente** das declarações das regras — ninguém o mantém à mão. É o grafo de rubricas, um andar acima.
- O **fechamento exige as dependências fechadas**: a Suplementar só fecha a regra de teto se a Mensal da competência estiver fechada; senão, recusa com mensagem clara, antes de qualquer número sair. A ordem de fechamento deixa de ser procedimento de memória e vira consequência verificada.
- **Ciclos entre tipos de folha** são detectados na publicação da regra, nunca no dia de pagamento.
- A folha fechada **sela quais folhas fechadas consumiu** — recalculá-la daqui a dois anos usa exatamente os mesmos fatos financeiros de então.
- **Simulação é permitida e marcada**: dá para trabalhar a Suplementar com a Mensal aberta, calculando com valores provisórios claramente identificados como simulação. Só o fechamento oficial espera.

**Caso de borda — a folha consumida estava errada.** A Suplementar que consumiu uma Mensal depois corrigida estava *certa para a época* (princípio de sempre). A correção da Mensal entra como diferença em folha futura; se alterar o teto, a diferença do abate sai da mesma subtração entre duas leituras (§5.3). Nenhum caso especial.

O paralelismo entre folhas sobrevive: folhas independentes continuam 100% paralelas; onde há dependência declarada, o paralelismo vale para tudo menos o fechamento oficial — que não é limitação do sistema, é a realidade do teto: não existe abate correto sem saber o que a Mensal pagou.

**Calibração com a ALRN (fecha o desenho):**

- **Abate-teto considera todas as folhas do mês** — e isso revela uma interpretação canônica necessária. Se a regra do teto existisse em todas as folhas exigindo as demais fechadas, haveria ciclo perfeito e ninguém fecharia nunca. A resolução: **o teto é incremental**. A declaração "todas as folhas da competência corrente" se interpreta como *"todas as já fechadas + a que estou calculando"*. A Mensal fecha primeiro aplicando o teto sobre si; a Suplementar soma o que a Mensal pagou mais o que ela própria paga e abate o excedente nela. Sem ciclo, determinístico, reproduzível. **Consequência: a ordem de fechamento determina onde o abate cai** (quem fecha por último absorve o corte) — a ordem deixa de ser logística e vira decisão com efeito financeiro, que deve ser explícita e registrada, nunca acidente de quem clicou antes.
- **Margem consignável (referência: mês corrente vs. anterior) — decisão adiada, e o adiamento é seguro.** Não é decisão de estrutura: é o eixo "janela" da declaração da regra, escolhido quando a regra for escrita, mudável por versão nova. Alerta técnico registrado: margem sobre o *líquido do mês corrente* gera ciclo (líquido depende do consignado que depende da margem que depende do líquido) — a detecção de ciclo na publicação recusará essa variante, forçando uma das saídas legítimas: mês anterior, ou base corrente pré-consignado (via classificação de rubrica).
- **Médias no 13º — desconhecido hoje, e não bloqueia nada.** Se necessário um dia, a declaração já existe (`média, últimas 12, rubricas variáveis`); se nunca, nada foi construído à toa. Teste passado de que arquitetura e negócio ficaram separados: as perguntas sem resposta não param o desenho.

### 5.5 Ciclo de vida da folha (fechamento)

Princípio norteador: **fechar não é travar o mundo — é fixar um corte de conhecimento.** Fatos nunca param de entrar; o fechamento define até onde *esta folha* enxerga. Máquina de quatro estados:

| Estado | O que significa | O que pode |
|---|---|---|
| **Aberta** | Trabalho diário | Cálculos ilimitados, todos **simulações**, cada um registrando o instante de conhecimento usado |
| **Em conferência** | **Data de corte travada** (fatos e versões com registro ≤ corte) | Cálculo oficial produzido sobre o corte; conferência sobre resultado que não muda embaixo da equipe |
| **Fechada** | Terminal e imutável | Produz fatos financeiros (§5.4); entra no grafo de consolidação; alimenta pagamento |
| **Cancelada** | Terminal, para folha criada por engano e nunca fechada | Registrada e auditável — não é apagamento |

**Transições:** Aberta → Em conferência (trava corte) → Fechada. Em conferência → Aberta (ampliar corte — permitido, registrado). Aberta → Cancelada. Fechada não transita para lugar nenhum.

**Fatos fora do corte.** Em conferência, fatos novos continuam sendo registrados no sistema — só não entram nesta folha. O sistema exibe o placar: *"há N fatos com efeito nesta competência fora do corte"*. A equipe decide conscientemente: voltar e ampliar o corte, ou seguir e deixar que virem diferença (§5.3). Nunca surpresa silenciosa.

**O ato de fechar** cobra tudo que o desenho acumulou: dependências declaradas fechadas (§5.4), selo das folhas consumidas, registro de quem fechou, quando e com que amparo — porque a ordem de fechamento tem efeito financeiro (onde o abate do teto cai) e **fechar é um fato**, com a anatomia de sempre.

**Decisões de aço:**

1. **Não existe "reabrir folha fechada". Nunca.** O botão "reabrir" dos sistemas legados é o assassino da auditoria (reabre, ajusta, refecha — e o pago não bate mais com o mostrado). Aqui ele nem faz sentido conceitual: folha fechada é fato histórico, e fatos não se editam. A pressão vai aparecer ("é só um servidor, é rapidinho"); a resposta é sempre a mesma: registre o fato correto, a diferença sai em folha futura com rastro completo.
2. **Toda transição é um fato sobre a folha** — autor, instante, amparo. O ciclo de vida da folha é tão auditável quanto a vida do servidor.
3. **Pagamento fica fora da máquina.** "Fechada" encerra o cálculo; pagamento é integração bancária (módulo satélite). A confirmação do banco entra como **fato sobre a folha** ("paga em tal data, lote tal"), não como estado do ciclo. Core mínimo; problema de arquivo bancário não contamina a máquina de cálculo.

**Reprodutibilidade operacionalizada:** recalcular uma folha fechada anos depois = mesma competência + mesmo tipo + **mesma data de corte** + mesmas folhas consumidas → mesmo resultado, centavo a centavo. O corte é a chave que torna o compromisso da fundação executável.

**Em aberto (governança, não estrutura):** ~~segregação de papéis no fechamento~~ — **resolvido no §6**: segregação é restrição declarativa do RBAC configurável, ligada por instituição.

---

## 6. Permissões: RBAC configurável sobre a fundação

Permissões variam de instituição para instituição — portanto são **configuração, não código**, seguindo a mesma disciplina de tudo o mais. Mas RBAC em folha de pagamento tem uma exigência que RBAC comum ignora: a auditoria não pergunta só *"quem pode"* — pergunta *"quem podia, na época"*. O desenho responde às duas com a maquinaria que já existe.

### Os verbos são fixos; o resto é configuração

O core define um vocabulário pequeno e imutável de ações: **registrar fato, publicar versão** (de regra, rubrica, tipo de fato, tipo de folha), **transitar folha, executar receita, consultar, exportar**. Esse vocabulário é código e não cresce.

Acima dele, tudo é da instituição:

- **Papéis** = pacotes nomeados de permissões, definidos pela instituição ("Operador de Cadastro", "Contador", "Gestor de Folha", "Auditor" — ou os nomes que fizerem sentido). Nenhum papel é hardcoded.
- **Escopo** = cada permissão pode ser restringida pelos eixos que já existem no modelo: por **tipo de fato** ("registra `comprovacao_plano_saude`, não `promocao`"), por **tipo de folha** ("fecha Mensal, não fecha 13º"), por **transição** ("trava corte, mas não fecha").
- **Definições de papéis são versionadas** (Decisão 3): o papel "Contador" de 2024 pode ganhar permissões em 2026 — as duas versões coexistem na linha do tempo.

### Atribuição de papel é um fato

*"Fulana passou a exercer o papel Gestor de Folha em 01/03, portaria nº X"* — efeito, registro, autor, **amparo**, imutável, corrigível só por fato novo. Consequência: quando o tribunal de contas perguntar *"com que autoridade fulano fechou a folha de março de 2023?"*, a resposta é uma **derivação** — atribuições vigentes na data × definição do papel vigente na data, com a portaria que amparava. Cargos mudam, pessoas saem, chefias trocam; "quem podia o quê, quando" continua respondível para sempre.

### Segregação de funções é restrição declarativa

Em vez de embutir política no código, a instituição declara restrições sobre as transições e publicações:

- *"Fechar exige autor diferente de quem travou o corte"*
- *"Publicar versão de regra exige aprovação de um segundo Contador"*

Cada instituição liga as restrições que quiser; o motor apenas verifica no ato. Segregação é política, e política é configuração. (Resolve a pendência de homologação do §5.5: a variante com homologação é só uma restrição declarada a mais.)

### O modo Deus encontra seu lugar definitivo

É mais uma permissão do vocabulário — registrar fatos com autoridade especial — atribuível, escopável e rastreada como qualquer outra. O "superusuário fora do sistema" deixa de existir; existe um papel raro, **dentro** do sistema, auditável como todos.

---

## 7. A DSL de cálculo

### 7.1 Filosofia: uma linguagem deliberadamente fraca

Uma DSL de folha não é uma linguagem de propósito geral encolhida — é o oposto. Ela existe para que um contador escreva a lógica de um adicional **sem poder** fazer as coisas que quebram um sistema de folha: ler o banco direto, guardar estado entre execuções, produzir resultado diferente rodando duas vezes, ou consultar "agora". A primeira decisão é por **subtração**: a linguagem é fraca de propósito. Não é Turing-completa nem precisa ser. A fraqueza é a *feature* central.

Quatro propriedades garantidas **por construção**, não por disciplina do autor:

- **É função pura.** Recebe um contexto, devolve um valor. Mesmo contexto, mesmo valor, sempre. Não há verbo para causar efeito colateral. Reprodutibilidade vira garantia mecânica, não promessa.
- **Não conhece o tempo.** A regra nunca diz "hoje". Toda referência temporal é a *data de referência da folha*, que chega no contexto. Por isso recalcular março de 2023 funciona. Um `dataAtual()` é impossível, não apenas desencorajado.
- **Enxerga só o contexto.** Não há verbo "buscar" genérico; cada coisa legível é uma porta nomeada que o motor abriu de propósito. Regra que precisa do que o contexto não oferece declara a dependência — ou não é válida.
- **Declara o que consome, de forma analisável sem executar.** O grafo de rubricas e a detecção de ciclos exigem saber o que a regra lê *antes* de rodá-la. Dependências são explícitas e estáticas, nunca escondidas dentro de um `if`.

### 7.2 Dois animais distintos (não misturar)

| | DSL de cálculo | Regras de consistência |
|---|---|---|
| Lê | contexto | entrada de fatos |
| Produz | um valor + rubrica | novos fatos |
| Natureza | função pura | reação a combinações de fatos |
| Exemplos | terço de férias, valor do auxílio, desconto do mês | não-comprovação → dívida; férias na janela proibida → devolução |

São parentes das **receitas/validações** do catálogo (§3.9) — elaboradas em detalhe no §8. Misturar as duas famílias é o erro clássico que estraga DSLs de folha: a linguagem de cálculo permanece pura justamente porque não reage a fatos nem os produz.

### 7.3 As quatro formas de ler o contexto (e nenhum laço)

A linguagem de cálculo lê o contexto de exatamente quatro formas, aplica **condicionais e aritmética**, e produz **um valor + sua rubrica**:

1. **Derivações de instante** — `idade`, `cargo`, `dias_trabalhados`, saldo de dívida (estado num ponto do tempo).
2. **Rubricas por classificação, na folha corrente** — `soma das que compõem terço de férias`.
3. **Fatos financeiros agregados sobre janela** — `contagem/soma/média(rubrica ou classificação, janela de competências, tipos de folha)`. É o **mesmo mecanismo dos quatro eixos** da consolidação (§5.4): a DSL ganha acesso de leitura a uma capacidade que o motor já tinha; não é construção nova. A janela olha **fatos financeiros já selados** (folhas fechadas do passado), nunca o presente móvel — o que a amarra à ordem de fechamento e preserva reprodutibilidade.
4. **Conteúdo de fato** — a `mensalidade` do plano, o percentual de uma concessão.

**Por que nenhum laço.** "Conte sobre uma janela" tentaria um `para cada mês`. Laço abre porta para estado, parada arbitrária, dependência de ordem — e mata a análise estática. Em vez disso, a janela **não é percorrida pela regra; é entregue agregada pelo contexto** (forma 3). Sem laço, sem variável mutável, sem estado, sem relógio.

### 7.4 Tabelas + expressões (sem blocos, por ora)

Os casos reais da ALRN (§10) mostram que a camada de cálculo precisa de dois formatos, não mais:

- **Tabelas versionadas** para o comum: faixa → valor (ex.: valor do auxílio saúde por faixa etária). Nem é expressão; é configuração pura.
- **Expressões puras** para o resto: condicionais e aritmética sobre as quatro leituras (terço, desconto do mês, licença-prêmio).

Blocos/visual ficam como possível roupagem futura sobre a camada de expressões — não necessários agora.

### 7.5 O padrão que a fundação impõe: complexidade vira fato, não código

Os três casos reais da ALRN pareciam exigir uma linguagem poderosa; a fundação absorveu a complexidade e deixou a DSL simples:

- **Memória entre meses** (desconto do auxílio amortizado ao longo de várias folhas, limitado a 15% do líquido) → **não é laço nem estado na linguagem**. A não-comprovação é um **fato**; o saldo devedor é uma **derivação** (fato original − descontos já lançados em folhas fechadas); a regra mensal fica pura: *desconte o menor entre o saldo e 15% do líquido*. Quando o saldo zera, a regra para de produzir rubrica sozinha. **Sempre que uma regra parecer precisar de memória, a memória pertence aos fatos.**
- **Olhar o futuro** (licença-prêmio exige não tirar férias nos 3 meses seguintes) → **nenhuma regra olha adiante**. Paga-se quando o direito se concretiza; se o futuro violar a condição, o próprio fato futuro (férias na janela) dispara a devolução — via desconto amortizável, o mesmo mecanismo. É uma regra de consistência (§7.2), não de cálculo.
- **"Um terço de todas as vantagens"** → uma linha, graças à decisão de §3.6 (a informação mora na rubrica): *terço = soma das rubricas classificadas 'compõe terço' ÷ 3*. Rubrica nova entra ou fica de fora conforme sua classificação — impossível esquecer de atualizar.

**Ciclo escondido registrado:** o desconto do auxílio é 15% do líquido, mas entra no líquido (mesmo padrão do consignado). Base = "líquido antes de descontos amortizáveis" (classificação de rubrica); a detecção de ciclo na publicação barra a variante impossível.

### 7.6 Sintaxe concreta

**A linguagem fala português** — quem a lê é contador, e a regra publicada deve ser documento que a auditoria lê sem intérprete.

**Estrutura de uma regra:** cabeçalho declarativo + corpo de expressão única.

```
regra terco_ferias
  produz rubrica 'terco_ferias'
  aplica-se a folhas: mensal
  quando primeiro_periodo_ferias_da_competencia

  seja base = soma(rubricas com 'compoe_terco')
  resultado base / 3
```

```
regra desconto_auxilio_nao_comprovado
  produz rubrica 'desconto_auxilio_saude'
  aplica-se a folhas: mensal
  quando saldo_divida_auxilio > 0

  seja limite = 15% de rubrica('liquido_pre_amortizaveis')
  resultado menor(saldo_divida_auxilio, limite)
```

```
regra previdencia
  produz rubrica 'contribuicao_previdencia'
  aplica-se a folhas: mensal, decimo_terceiro

  seja base = soma(rubricas com 'incide_previdencia')
  resultado aplica tabela_progressiva('previdencia_vigente') sobre base
```

**Elementos e suas consequências:**

- **`quando` é guarda de aplicabilidade** — se falha, a regra *não produz rubrica* (nada de linhas de R$ 0,00 no contracheque). "Não se aplica" ≠ "vale zero", e a linguagem distingue.
- **`seja` cria nomes, nunca variáveis** — atribuição única, sem reatribuição. Existe para legibilidade (nomear passos), não para estado. O corpo permanece uma expressão só, lida de cima a baixo.
- **As quatro leituras têm sintaxe fixa:** derivações são nomes simples validados contra catálogo (`idade`, `saldo_divida_auxilio`); conteúdo de fato via `vigente('incentivo_estudo').percentual` e `existe('tipo')`; rubricas via `rubrica('x')` ou `rubricas com 'classificacao'`; janelas anexam cláusulas à agregação — `soma(rubricas com 'variavel', ultimos 12 meses, folhas: mensal)`.
- **O corpo é a declaração de consumo.** Como toda leitura tem forma sintática própria, o motor extrai dependências por parse, sem executar — não há declaração separada (que dessincronizaria). Grafo, ciclos e validação contra catálogos saem daí, na publicação.

### 7.7 Tipos, dinheiro e arredondamento

- **`dinheiro`** é tipo próprio: decimal exato, jamais ponto flutuante (10.000 contracheques não podem divergir por centavos fantasmas). Literais: `R$ 250,00`.
- **`percentual`** (`15%`), `numero`, `texto`, `data`, `logico`. Combinações tipadas: percentual × dinheiro = dinheiro; dinheiro + texto = **erro na publicação**.
- **Arredondamento é política declarada na rubrica** (meio-para-cima, truncar...), aplicada pelo motor ao resultado final. Dentro da expressão, `arredondar(x)` explícito quando necessário. Nada arredonda implicitamente no meio da conta.

### 7.8 Catálogo de funções, tabelas e ferramental

**Catálogo de funções fechado e pequeno:** `menor`, `maior`, `soma`, `media`, `contagem`, `arredondar`, `proporcional` (aplica o fator de dias), `busca em tabela ... por ...`, `aplica tabela_progressiva ... sobre ...` (alíquotas marginais — previdência/IR sem escadinhas de `se`). A lista cresce por versão do **sistema**, nunca por instituição — cada função é uma promessa de pureza que o motor honra.

**Tabelas são formato irmão, não cidadão de segunda:** versionadas como regras, com `aplica-se a folhas`, editadas em interface de tabela (mudar faixa = mudar célula + publicar versão; sem código):

```
tabela auxilio_saude_por_idade
  entrada: idade
  0  a 29    →  R$ 250,00
  30 a 39    →  R$ 320,00
  40 a 49    →  R$ 410,00
  50 ou mais →  R$ 520,00
```

Consumo: `resultado busca em tabela('auxilio_saude_por_idade') por idade`, com guarda `quando existe('comprovacao_plano_saude')`. Tabela progressiva = variação do formato com semântica marginal.

**Ferramental ancorado na estrutura:**

- **Autocomplete pelos catálogos** — digitou `rubricas com '`, as classificações existentes aparecem; impossível referenciar o inexistente sem aviso imediato.
- **Simulação** com servidor de exemplo antes de publicar.
- **Diff de impacto** — "esta versão altera o contracheque de 340 servidores; antes/depois" — publicação de regra como ato informado, não ato de fé.

**Teste de aceitação da sintaxe** (pendente, mais valioso que refinamento teórico): imprimir os quatro exemplos e pôr diante de alguém da folha da ALRN — *"você entende o que isso calcula?"*. Onde a pessoa tropeçar, ali se mexe.

---

## 8. Regras de consistência

O terceiro animal do sistema: regras que **reagem a fatos e produzem fatos**. A pergunta perigosa que o desenho responde: *um sistema que produz fatos sozinho ainda é auditável?* — Sim, desde que a reação seja tão disciplinada quanto tudo o mais.

### 8.1 Lugar no ciclo de vida do fato

Três peças tocam fatos, sem sobreposição:

| Momento | Peça | Papel |
|---|---|---|
| **Antes** | Validações do catálogo (§3.4) | Barram na entrada ("exoneração exige ativo") |
| **No ato** | Receitas (§3.9) | Conveniência humana para inserir fatos |
| **Depois** | **Regras de consistência** | Fatos aceitos, em combinação, disparam consequências |

### 8.2 Anatomia: gatilho → condição → efeito

**Gatilho** — exatamente dois tipos, nenhum a mais:

- **Registro de fato** de tipos declarados ("quando entrar fato de `ferias`..."). Cobre o retroativo automaticamente: férias de fevereiro registradas em julho disparam a regra em julho (registro) avaliando fevereiro (efeito) — bitemporalidade trabalhando.
- **Marco temporal** ("em 31/01 de cada ano..."). Existe porque **ausência não dispara nada por registro**: a não-comprovação do auxílio saúde não é fato que alguém digita — é a passagem do prazo sem comprovantes suficientes. Só um marco de calendário consegue olhar uma ausência.

**Condição** — escrita **na mesma linguagem de expressões da DSL de cálculo** (§7), com as mesmas quatro formas de leitura, mais uma quinta porta: o conteúdo do fato gatilho. "Houve licença-prêmio nos últimos 3 meses?" é a forma 3 (agregação sobre janela) que já existia. Nenhuma linguagem nova: pureza, análise estática e vocabulário herdados. A diferença entre os dois animais está no *quando rodam* e no *que produzem* — nunca na linguagem da lógica.

**Efeito** — produzir fatos de tipos catalogados, em um de dois **modos declarados por regra**:

- **Automática**: produz o fato diretamente, com autoria de sistema — "produzido pela regra R, versão N, disparada pelos fatos X e Y". Os gatilhos *são* o amparo; "quem registrou?" continua respondível.
- **Pendência**: a regra não lança o fato financeiro; produz uma *pendência nomeada* para um humano ("violação da janela de licença-prêmio; devolução sugerida de R$ X; confirmar?"). A confirmação humana registra o fato, com autor de carne e osso e amparo (o processo administrativo). Pendência ignorada não some — fica visível, envelhecendo, cobrável. O RBAC (§6) governa quem confirma.

**Recomendação de fábrica:** efeitos financeiros nascem em modo pendência; automação plena é opt-in consciente da instituição. Dinheiro que sai de contracheque merece um humano no circuito até que se prove o contrário.

### 8.3 Proteções estruturais

- **Grafo anti-cascata.** Reações produzem fatos que podem disparar outras reações. Regra A produz tipo X; B dispara com X; se B produzir o que dispara A — ciclo, detectado **na publicação**. Terceira aparição da mesma maquinaria de grafo (rubricas §5.1, tipos de folha §5.4, reações). Cascatas finitas são permitidas e úteis; loops são impossíveis por construção.
- **Idempotência.** O fato produzido referencia seus gatilhos; o motor garante uma única reação por (versão da regra × conjunto de gatilhos). Reprocessamentos e reentregas não duplicam dívidas.
- **Correção de gatilho não apaga consequência.** Se o fato de férias for corrigido ("registrado errado"), a devolução **não evapora** — fatos não evaporam. O sistema levanta pendência: "gatilho corrigido; consequência pode estar obsoleta". Compensação é ato explícito (humano ou reação declarada para o tipo corretivo). Conservador de propósito: dinheiro nunca se move por efeito colateral silencioso.
- **Publicação retroativa é escolha declarada.** Regra nova varre o passado ou vale só daqui pra frente? A regra declara. Se varre, reações sobre fatos antigos nascem preferencialmente como pendências — trezentas violações históricas descobertas hoje são assunto para gente, não para lote automático.
- **Versionamento** (Decisão 3): regras de consistência são versionadas como tudo o mais; o fato produzido referencia a versão que o produziu.

### 8.4 O circuito completo (caso licença-prêmio + auxílio saúde)

A reação entrega o bastão para a maquinaria que já existia, cada família no seu papel:

> Marco temporal 31/01 → condição (comprovantes < pago no ano) → **pendência** → confirmação humana → **fato de dívida** → saldo devedor como **derivação** → desconto mensal como **regra pura de cálculo** (menor entre saldo e 15% do líquido pré-amortizáveis) → cessa sozinho ao zerar.
>
> Registro de `ferias` → condição (licença-prêmio paga na janela de 3 meses, via agregação) → **pendência de devolução** → confirmação com processo → fato de dívida → mesma esteira de amortização.

---

## 9. Governança dos catálogos

O catálogo é a fronteira onde a instituição pode se machucar sozinha. A governança combina peças que já existem — versionamento (Decisão 3), análise estática de dependências (§7.6), RBAC (§6) — mais **uma** decisão técnica dura.

### 9.1 Alcance: não é um catálogo, são cinco

Tipos de fato (§3.4), classificações de rubrica (§3.6), tipos de folha (§3.10), papéis do RBAC (§6) e o catálogo de chaves de derivação. Todos são configuração que define o vocabulário do sistema; todos versionados. A governança é **uma só** para os cinco — mesmos verbos (criar, versionar, depreciar), mesmas proteções. Remover uma classificação que três regras consomem é tão perigoso quanto remover um campo de tipo de fato.

### 9.2 A decisão dura: evolução de schema é aditiva, e ponto

O problema: fatos antigos nunca migram (vivem sob a versão do tipo em que nasceram — §3.4), mas regras e derivações **leem campos** desses fatos. Versão nova que remove ou renomeia campo quebra regras contra fatos de certas épocas — possivelmente de forma silenciosa e parcial.

A regra, com décadas de estrada nos formatos de dados sérios:

> **Campos nunca são removidos nem renomeados — apenas adicionados ou depreciados.**

- Campo novo entra **opcional ou com valor padrão** para versões antigas (regra que o lê funciona sobre fato de qualquer época).
- "Renomear" = adicionar o novo + depreciar o velho.
- Campo depreciado sai dos formulários novos, mas **permanece legível para sempre**.

Com essa única regra, "essa mudança quebra o passado?" tem resposta permanente: **não, por construção.**

### 9.3 Relatório de impacto na publicação — de graça

O motor já extrai dependências das regras por parse (§7.6): ele sabe quem lê cada campo de cada tipo. Publicar versão de tipo exibe: *"lido por 4 regras de cálculo, 2 derivações, 1 regra de consistência; mudança aditiva ✔"* — ou **barra na hora** a tentativa não-aditiva, apontando exatamente quem quebraria. É o diff de impacto da DSL apontado para o catálogo. Nenhuma maquinaria nova.

### 9.4 O assassino silencioso: duplicação semântica

O erro que nenhum schema pega: criar `progressao` quando já existe `promocao` — dois tipos para o mesmo acontecimento, metade dos servidores em cada, regras enxergando só metade. Antídotos:

- **Busca obrigatória antes do cadastro** no fluxo de criação ("tipos existentes parecidos: `promocao` — é isso?").
- **Aprovação humana**, que existe em parte para a pergunta que máquina não responde: *isso já existe com outro nome?*

### 9.5 Quem aprova, com que amparo, e a morte dos tipos

- **RBAC já resolve o quem**: criar/versionar tipos = verbo "publicar versão" (§6), escopável por catálogo; exigência de aprovação = restrição declarativa ("criar tipo de fato exige segundo aprovador com papel X").
- **Recomendação de fábrica**: mudança de catálogo **nasce exigindo aprovação** — é rara, é estrutural, e um segundo par de olhos custa nada perto de um tipo duplicado.
- **Amparo em mudança de tipo**: `auxilio_creche` nasce apontando a resolução que criou o benefício. O catálogo conta a história de *por que* o vocabulário mudou.
- **Depreciação**: tipo depreciado não aceita fatos novos, permanece legível para sempre; depreciar algo que regras vigentes consomem é barrado pelo relatório de impacto. **Nada morre com dependentes vivos.**

---

## 10. Casos de teste da fundação (validados na conversa)

**Progressão retroativa (Victor, B6→B8).** Fato com efeito 15/02 e registro 10/07. Folhas de março–junho permanecem corretas *para a época*; diferenças apuradas por subtração entre as duas leituras do tempo. ✔

**Auxílio saúde (ALRN).** Comprovação do plano = fato de tipo catalogado (renovável; ausência de fato vigente = direito cessa). Idade = derivação do nascimento contra a data de referência — mudança de faixa etária ajusta o valor sozinha, na folha certa. Mudanças históricas da tabela = versões da regra. ✔

**Regra alterada "dali pra frente" com retroativo manual (prática atual da ALRN).** Vira publicação de versão com efeito retroativo + apuração automática de diferenças (§5.3). ✔

**Base de previdência (salário entra, auxílio saúde não).** Classificação na rubrica; regra soma por classificação; verba nova não exige mexer na regra da previdência. ✔

**Servidor que entra dia 15.** `dias_trabalhados` como derivação; rubricas marcadas como proporcionalizáveis ou não. ✔

**Exoneração.** Receita: valida `situacao_funcional = ativo` e insere fato de encerramento. ✔

**Concessões individuais (incentivo ao estudo 15%, pensão, consignado).** Fatos com amparo, consumidos por regras globais; regra individual de verdade reservada ao caso raro (decisão judicial com fórmula própria). ✔

**Folhas paralelas na mesma competência (ALRN: Mensal + Suplementar + 13º).** Tipos de folha; regras declaram a quais tipos se aplicam; cada folha nasce com o vigente do seu tipo; paralelismo sem interferência, pois cada folha é leitura independente das mesmas linhas do tempo imutáveis. Avos do 13º = derivação. ✔

**Surgimento de benefício novo (ex.: auxílio creche).** Cadastra-se o tipo de fato no catálogo (schema + validações), cria-se a rubrica classificada, escreve-se a regra. **Zero linha de código no core.** ✔

**Consolidação entre folhas (abate-teto, margem consignável, médias do 13º).** Fechamento produz fatos financeiros; regras declaram consumo em quatro eixos (tipos de folha × janela de competências × rubricas × agregação); teto incremental sobre todas as folhas do mês (calibrado com a ALRN); ordem de fechamento explícita e com efeito financeiro; simulação com valores provisórios permitida e marcada. ✔

**Ciclo de vida da folha.** Corte de conhecimento travado em conferência (alvo parado para conferir); fatos fora do corte com placar visível e destino consciente (ampliar corte ou virar diferença); folha fechada sem reabertura — correção sempre por diferença em folha futura; pagamento como fato externo. ✔

**Permissões que variam por instituição.** Verbos fixos no core; papéis, escopos e restrições de segregação como configuração; atribuição de papel como fato bitemporal com amparo — "com que autoridade fulano fechou a folha de 03/2023?" respondível por derivação, para sempre. ✔

**Auxílio saúde completo (ALRN).** Valor por faixa etária = tabela versionada sobre a derivação `idade`. Não-comprovação = fato; saldo devedor = derivação; desconto mensal = regra pura (menor entre saldo e 15% do líquido pré-amortizáveis), que cessa sozinha ao zerar o saldo. Ciclo do líquido barrado por classificação de rubrica. ✔

**Licença-prêmio (ALRN: 3 meses após 5 anos, veda férias nos 3 meses seguintes).** Direito = derivação sobre a história; a vedação futura não trava o pagamento — férias na janela é fato futuro que dispara devolução (regra de consistência) via desconto amortizável. Nenhuma regra olha o futuro. ✔

**Terço de férias (ALRN: 1/3 de todas as vantagens, no primeiro período da competência).** Uma expressão: soma das rubricas classificadas "compõe terço" ÷ 3; gatilho no primeiro período de férias derivado dos fatos. A classificação em rubrica torna impossível esquecer de incluir vantagem nova. ✔

**Agregação temporal sem laço.** "Contar/somar sobre janela de meses" (confirmado necessário na ALRN) = leitura agregada entregue pelo contexto (quatro eixos, §5.4/§7.3), analisável estaticamente, sobre folhas fechadas — não laço na linguagem. ✔

**Reações auditáveis (ausência de comprovação; férias na janela da licença-prêmio).** Ausência detectada por marco temporal (não por registro); consequência financeira nasce como pendência confirmada por humano com processo; fato produzido carrega regra+versão+gatilhos como amparo; cascatas com ciclo barradas na publicação; correção de gatilho gera pendência de revisão, nunca apagamento silencioso. ✔

**Evolução de tipo sem quebrar o passado (ex.: exigência de CNPJ no comprovante).** Campo novo opcional/com padrão; fatos antigos legíveis sob sua versão; regras funcionam sobre qualquer época; tentativa de remoção/renomeação barrada na publicação com relatório de quem quebraria. ✔

---

## 11. O que foi eliminado do rascunho original — e por quê

| Peça original | Destino | Por quê |
|---|---|---|
| Atributo vs. Atributo de História (duas definições conflitantes) | **Dissolvido** | Atributo é derivação de fatos, não entidade; a regra "por chave, vale o fato mais recente" resolve terminologia e cardinalidade de uma vez |
| Vigências manuais (DataInicio/DataFim) na relação história–atributo | **Eliminado** | Vigência decorre da sucessão de fatos; fim de um valor = início do próximo |
| Operações customizadas (pré-requisitos, passos, criar/alterar/remover regras e atributos) | **Reduzido a receitas** | Validar estado derivado + inserir fatos cobre os casos (exoneração etc.) sem maquinaria de identificação individual |
| Regras individuais como categoria central | **Reduzido a caso raro** | ~95% dos casos são fatos concedidos consumidos por regras globais (validado contra a realidade da ALRN) |
| Grupo de Regras / rótulo de folha / template de regras (três mecanismos sobrepostos) | **Substituído por tipos de folha** | A regra declara (versionadamente) a quais tipos de folha se aplica; a folha nasce com o vigente do seu tipo, sem seleção mensal. A informação mora em quem é classificado, não em listas externas |
| Regras depreciadas como flag especial | **Absorvido pelo versionamento** | Depreciar = publicar fim de efeito |
| Campos Metadados (Coluna1, Coluna2 + tabela refletida) e tabela de chaves de atributo | **Substituídos pelo catálogo de tipos de fato** | Mesmo serviço, com schema explícito, validação, permissões e versionamento — um único mecanismo de extensão (§3.4) |
| "Modo Deus" como edição fora das restrições | **Transformado** | Não edita o passado; adiciona fatos com autoridade especial, rastreados |
| Retroativo manual | **Substituído** | Subtração entre duas leituras do tempo (§5.3) |
| Exportação de dados embutida no core | **Mantido fora do core** (como o rascunho já apontava) | Módulo externo, coerente com o core mínimo |

### Mantidos do rascunho (com ajustes)

Core mínimo + módulos externos; rastreabilidade como princípio de primeira classe; tupla `<valor, rubrica>` como saída de regra; rubrica ativa/informativa (agora com classificações e versionamento); identificadores flexíveis de Pessoa; eventos para integração (eSocial); DSL para contadores com servidor de exemplo e autocomplete; templates de resposta em campos de texto (módulo satélite, fora do core).

---

## 12. O sistema numa respirada

> **Fatos imutáveis com duas datas** sobre pessoas e histórias, sempre de **tipos catalogados**; **rubricas classificadas e regras versionadas** do outro lado, cada regra declarando seus **tipos de folha**; **derivações** (atributos, idade, dias trabalhados, avos) como ponte; a **folha** como o encontro das duas linhas do tempo numa competência e num tipo, executada na ordem do **grafo de rubricas**, produzindo **registros de cálculo explicáveis** — e o **retroativo** como diferença entre duas leituras do mesmo passado.

Três decisões de fundação, um catálogo como fronteira, e todo o resto é consequência. Núcleo pequeno o bastante para ser o MinimusRH, sólido o bastante para tribunal de contas.

---

## 13. Próximos andares (a construir)

1. ~~**Consolidação entre folhas**~~ — **fechado** (§5.4): fatos financeiros no fechamento, quatro eixos de consumo, teto incremental com ordem de fechamento explícita, margem consignável adiada com segurança (parâmetro de regra, protegido pela detecção de ciclo), médias como declaração disponível.
2. ~~**DSL de cálculo**~~ — **fechado** (§7): filosofia da subtração, quatro leituras sem laço, sintaxe concreta em português (§7.6), tipos com `dinheiro` exato e arredondamento por política de rubrica (§7.7), catálogo fechado de funções, tabelas como formato irmão e ferramental (autocomplete, simulação, diff de impacto) (§7.8). *Pendência de validação, não de desenho:* o teste de leitura com alguém da folha da ALRN.
3. ~~**Regras de consistência**~~ — **fechado** (§8): gatilho (registro de fato ou marco temporal) → condição (mesma linguagem da DSL) → efeito (fato automático ou pendência com confirmação humana); grafo anti-cascata, idempotência, correção de gatilho sem apagamento de consequência, retroatividade de publicação declarada.
4. ~~**Governança do catálogo**~~ — **fechado** (§9): governança única para os cinco catálogos; evolução aditiva de schema (campos nunca removidos/renomeados — adicionados ou depreciados); relatório de impacto na publicação via análise estática já existente; busca obrigatória + aprovação contra duplicação semântica; aprovação por padrão via restrições do RBAC; amparo em mudanças; nada morre com dependentes vivos.
5. ~~**Fechamento de folha**~~ — **fechado** (§5.5): máquina de quatro estados (Aberta, Em conferência, Fechada, Cancelada), data de corte como snapshot de conhecimento, sem reabertura jamais, transições como fatos, pagamento fora da máquina. Segregação de papéis resolvida via RBAC (§6).
6. **Telas e fluxos de operação** — o dia a dia de quem registra fatos (tela genérica por schema + telas especializadas como conveniência), publica versões de regras, fecha folhas e apura retroativos.
7. **Módulos satélites** — exportação configurável, eSocial sobre a linha de fatos, templates de resposta em campos de texto.
