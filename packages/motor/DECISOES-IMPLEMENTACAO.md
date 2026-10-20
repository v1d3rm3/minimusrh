# Decisões de implementação — pacote `motor`

Ambiguidades e lacunas encontradas entre `docs/MinimusRH_Playbook_Implementacao.md` (Módulo
2) e os documentos de design (`MinimusRH_Design_Dominio.md`, `MinimusRH_Fundacao_e_Modelo_v2.md`
§5) durante a implementação, no formato pedido: *contexto → opções → decisão → por quê*.
Revisão humana pendente (portão do playbook antes do Módulo 3).

---

## 1. `montarGrafo` recebe `rubricas` além de `regras`

**Contexto:** o playbook dá a assinatura `montarGrafo(regras: VersaoRegra[]): Grafo |
ErroCiclo`. Mas uma aresta por CLASSIFICAÇÃO ("uma regra que consome a classificação C
depende de TODAS as regras cujas rubricas produzidas têm C") exige saber quais
classificações cada rubrica produzida carrega — informação que só existe em
`VersaoRubrica.classificacoes`, não em `VersaoRegra`.

**Decisão:** `montarGrafo(regras: readonly VersaoRegra[], rubricas: ReadonlyMap<RubricaChave,
VersaoRubrica>): Grafo | ErroCiclo`.

**Por quê:** sem o mapa de rubricas resolvidas não há como resolver a aresta por
classificação — a assinatura do playbook era prosa de instrução, não TypeScript literal a
copiar. `resolucao.ts` já produz exatamente esse mapa (`ResolucaoTemporal.rubricasResolvidas`),
então a composição é natural: `calcular-folha.ts` chama `resolverParaExecucao` e passa o
resultado adiante para `montarGrafo`.

---

## 2. Rubrica produzida por mais de uma regra resolvida: lança exceção, não é `ErroCiclo`

**Contexto:** o playbook não cobre o caso de duas `VersaoRegra` diferentes com o mesmo
`produz` no conjunto de entrada de `montarGrafo` — só fala de ciclos.

**Decisão:** `grafo.ts` lança `ErroRubricaProduzidaPorMaisDeUmaRegra` (um `Error`), fora do
union `Grafo | ErroCiclo`. `resolucao.ts` NÃO valida isso (resolve cada regra
independentemente; se duas apontarem para a mesma rubrica, o mapa de rubricas resolvidas
simplesmente deduplica na segunda ocorrência).

**Por quê:** é erro de CONFIGURAÇÃO (publicação de regra ambígua — duas regras reivindicando
a mesma tupla `<valor, rubrica>`), não uma condição recuperável do fluxo de cálculo como um
ciclo (que pode legitimamente acontecer por má declaração de consumo e merece aparecer no
retorno para quem publica a regra). Configuração inválida deveria ser barrada na publicação
(fora do escopo do `motor`, que só executa); aqui vira exceção alta e ruidosa, não um
terceiro caso silencioso no tipo de retorno.

---

## 3. `resolucao.ts` não resolve derivações

**Contexto:** o playbook diz que `resolucao.ts` resolve "as versões vigentes de tudo" —
regras, rubricas e (por extensão) derivações. Mas `RegistroDeDerivacoes` (dominio) só expõe
`porChave(chave)`, sem `todos()` — não há como enumerar "todas as derivações" de antemão, ao
contrário de `Catalogo<K,T>` (que tem `todos()`).

**Decisão:** `resolucao.ts` resolve só regras e rubricas. Derivações são resolvidas SOB
DEMANDA, por chave, dentro de `contexto-impl.ts::derivacao()`, no momento em que uma regra
efetivamente lê `ctx.derivacao(chave)`.

**Por quê:** é a única leitura possível do contrato do dominio como está; e é também mais
correto architeturalmente — só paga o custo de resolver a versão vigente de uma derivação
quando ela é de fato consumida, e não exige que `motor` conheça de antemão o universo de
chaves de derivação em uso (que é vocabulário da instituição, Regra Global #3).

---

## 4. Regra vigente aponta para rubrica sem versão vigente: `ErroRubricaNaoResolvida` (lança)

**Contexto:** e se uma `VersaoRegra` resolvida (vigente para a competência/tipo de
folha/corte) tiver `produz` apontando para uma rubrica ausente do catálogo, ou presente mas
sem versão vigente na mesma data de referência? O playbook não cobre esse caso em
`resolucao.ts`.

**Decisão:** lança `ErroRubricaNaoResolvida`, em vez de devolver uma `ResolucaoTemporal`
parcial silenciosamente incompleta.

**Por quê:** regra vigente sem rubrica vigente correspondente é publicação inconsistente —
sinal de bug de configuração grave (não avisar e seguir em frente esconderia um cálculo
faltando uma rubrica inteira). Mesmo raciocínio da decisão 2: falhar alto, não silenciar.

---

## 5. "Guarda de escopo" dividida entre `resolucao.ts` e `calcular-folha.ts`

**Contexto:** o playbook diz que `resolucao.ts` "filtra regras por `aplicaSeAFolhas` e pela
guarda de escopo" — mas `EscopoRegra` (`global` | `individual` com `historiaId`) só faz
sentido por HISTÓRIA, e `resolucao.ts` resolve uma vez para a folha inteira, antes de saber
quais histórias participam.

**Decisão:** `resolucao.ts` filtra só por `aplicaSeAFolhas` (2ª dimensão da vigência, Design
§11 decisão 8). A guarda de escopo (`aplicavelAHistoria`) é aplicada em `calcular-folha.ts`,
por história, dentro do loop de execução do grafo.

**Por quê:** é a única divisão que faz sentido dado que `resolucao.ts` roda uma vez e
`EscopoRegra` é por história — mover a checagem para lá exigiria repetir toda a resolução
temporal por história, sem necessidade (a resolução temporal em si independe de escopo).

---

## 6. Seleção de histórias participantes sem conhecer `situacao_funcional`

**Contexto:** Fundacao §5.2 passo 1 cita `situacao_funcional = ativo` como exemplo de filtro
de participação — mas essa é uma DERIVAÇÃO da ALRN (Módulo 4), e a Regra Global #3 proíbe
`motor` de conhecer chaves de domínio institucionais.

**Decisão:** mecanismo genérico equivalente, só com os métodos estruturais de
`LinhaDoTempo`: uma história participa se `aberturaDaHistoria().dataEfeito <=
dataReferencia` e (`encerramentoDaHistoria()` ausente OU seu `dataEfeito >
dataReferencia`).

**Por quê:** `abertura`/`encerramento` são conceitos de PRIMEIRA CLASSE no contrato do
dominio (`LinhaDoTempo.aberturaDaHistoria()`/`encerramentoDaHistoria()`, `TipoFato.abreHistoria`/
`encerraHistoria`), não vocabulário institucional — usá-los não viola a Regra Global #3 e
produz o mesmo resultado prático do exemplo do conceitual sem acoplar `motor` a uma chave de
derivação específica da ALRN.

---

## 7. Contexto instrumentado é usado em PRODUÇÃO, não só em teste

**Contexto:** a instrução do Módulo 2 descreve `contexto-instrumentado.ts` como "o fiscal da
declaração de consumo... será usado nos testes de TODAS as regras" — soa como ferramenta só
de teste. Mas o bullet de `calcular-folha.ts` diz explicitamente: "montar `NoExplicacao` com
as fontes lidas (o contexto instrumentado fornece a matéria-prima da árvore)".

**Decisão:** `calcular-folha.ts` envolve o contexto de CADA execução de regra com
`instrumentar()` e usa `leituras` (não `violacoes()`) para montar `NoExplicacao`. A
fiscalização via `violacoes()` contra a `DeclaracaoConsumo` de cada regra concreta é
responsabilidade dos testes do Módulo 5 (regras da ALRN) — o motor só entrega o mecanismo
(testado em `contexto-instrumentado.test.ts`).

**Por quê:** as duas leituras da instrução não são incompatíveis — o MESMO decorator serve
aos dois propósitos (capturar leituras é o mecanismo comum; o que muda é se alguém chama
`violacoes()` sobre o log ou não). `calcular-folha.ts` não chama `violacoes()` porque não
teria uma `DeclaracaoConsumo` "correta" contra a qual comparar de forma útil em produção — a
fiscalização é uma checagem de TESTE (a regra mente ou não sobre o que lê), não uma trava de
runtime.

---

## 8. `NoExplicacao` só cita fontes `'derivacao'` e `'rubrica'`

> **Revista no Módulo 5 — ver #13.** A explicação passou a citar fatos (`'fato'`) e a usar
> sub-árvores (`'no'`) sem abrir a `LinhaDoTempo` para a regra.

**Contexto:** `FonteExplicacao` (dominio) tem 5 variantes: `'fato'`, `'derivacao'`,
`'rubrica'`, `'tabela'`, `'no'`. O motor só consegue popular duas delas a partir do que
`Contexto` expõe.

**Decisão:** `construirExplicacao` em `calcular-folha.ts` só produz fontes `'derivacao'` e
`'rubrica'`, extraídas do log de leituras do contexto instrumentado.

**Por quê:** `'fato'` exigiria o `FatoId` do fato vigente, mas `Contexto.vigente()`/`existe()`
devolvem só o `conteudo` — por design (Design §11 decisão 6: "Contexto sem acesso à
LinhaDoTempo crua"), a regra nunca vê o fato inteiro, então o motor também não tem como
citá-lo na árvore. `'tabela'` é insumo de regras CONCRETAS (tabela cargo→valor, tabela
progressiva do IR — Módulo 4), vocabulário que não existe no motor genérico. `'no'`
(recursão) fica disponível para regras que queiram compor sub-explicações manualmente, mas
o motor não gera aninhamento automático no MVP. Nenhuma dessas é invenção de tipo novo —
são variantes já existentes do union que o motor simplesmente não preenche.

---

## 9. Semântica do campo `Folha.corte` ao longo das transições

**Contexto:** o design do dominio só documenta que `corte` "trava ao entrar em conferência"
— nada sobre o que acontece nas demais transições (`aberta`, devolução, fechamento).

**Decisão (`ciclo-folha.ts::calcularCorte`):** entra em `em_conferencia` → `corte = instante`
da transição; é devolvida (`em_conferencia` → `aberta`) → `corte = undefined` (destrava);
qualquer outra transição (inclusive `em_conferencia` → `fechada`) preserva o corte como
estava.

**Por quê:** "travar" só faz sentido semântico ao entrar em conferência; devolver para
edição livre ("aberta") deveria destravar, senão o próximo ciclo de conferência herdaria um
corte velho sem re-travar explicitamente; fechar não deveria re-travar num instante novo,
porque a conferência já rodou o cálculo oficial sobre o corte anterior — mudar o corte no
fechamento tornaria o cálculo oficial diferente do que a equipe conferiu.

---

## 10. Exceções de `quando()`/`calcular()` são capturadas defensivamente

**Contexto:** o Design diz que `calcular()` é "FUNÇÃO PURA. Sem I/O, sem relógio, sem
estado" — em teoria não deveria lançar. O playbook não pede tratamento de exceção
explicitamente para `calcular-folha.ts`.

**Decisão:** cada execução de regra (por história) roda em `try/catch`; uma exceção vira
`{ tipo: 'excecao', historiaId, regra, mensagem }` em `erros`, e o cálculo segue para a
PRÓXIMA regra/história — uma regra com bug não derruba a folha inteira.

**Por quê:** "pura" é a promessa da regra, não uma garantia que o motor deveria assumir cega
e sem rede — regras concretas (Módulo 4+) são código escrito por humanos e podem ter bugs
(divisão por zero, acesso a campo ausente). Falhar toda a folha por uma regra quebrada é
pior do que reportar o erro e continuar; quem consome `ResultadoCalculo.erros` decide se
bloqueia o fechamento.

---

## 11. Teste de arquitetura em vez de regra de ESLint

**Contexto:** igual à decisão equivalente do pacote `dominio` — não há ESLint configurado no
monorepo ainda.

**Decisão:** `src/arquitetura.test.ts`, mesma técnica (grep interno via `readFileSync`,
termos montados por concatenação para não se autorreprovar), cobrindo agora também `pg` e
`@nestjs` (regra global 2 e 5 do playbook) e uma checagem textual de que `versaoVigente`
nunca é redefinido localmente (só importado de `@minimusrh/dominio`).

**Por quê:** consistência com a decisão já tomada e revisada no pacote `dominio`; critério de
aceite do Módulo 2 permite explicitamente essa alternativa.

---

## 12. `LeitorDeJanelas` recebe a `historiaId` (revisão no Módulo 5)

**Contexto:** o Módulo 5 implementou o `LeitorDeJanelas` real (`app-folha`). O contrato do
Módulo 2 era `agregado(consulta)`/`contagem(consulta)`, e `ConsultaJanela` (dominio) só traz
os quatro eixos de §5.4 (agregação, rubrica/classificação, competências, tipos de folha). Não
diz de QUAL história. Mas o leitor é injetado uma vez por folha, não por história. Sem a
história, "quanto esta pessoa recebeu nos últimos 12 meses" não tem resposta.

**Opções:** (a) um leitor por história, com `calcularFolha` recebendo uma fábrica; (b)
acrescentar `historiaId` à `ConsultaJanela` do dominio; (c) o motor passa `historiaId` ao
leitor, junto com a consulta.

**Decisão:** (c). A assinatura passa a ser `agregado(historiaId, consulta)` /
`contagem(historiaId, consulta)`. `criarContexto` passa `params.linha.historiaId`.

**Por quê:** (b) deixaria a regra escolher de quem ler, o que fura o isolamento de "a regra
enxerga só o contexto da história corrente". (a) muda a forma da entrada sem ganho real. (c)
é a menor mudança: a regra continua sem ver nem escolher a história, e o `Contexto` do
dominio fica intocado.

---

## 13. Proveniência: a explicação cita fatos via observador de leituras (revisão no Módulo 5)

**Contexto:** o critério do Módulo 5 pede que o extrato do `salario_base` do Victor "mostre
cargo, fato de origem e versão da regra". A #8 registrava que o motor não sabia citar
fatos, porque `Contexto` devolve só valores (Design §11 decisão 6).

**Opções:** (a) as derivações da ALRN devolverem o fato junto do valor (`{cargo, fatoId}`),
o que muda o contrato das regras e vaza proveniência para o domínio da instituição; (b) o
`app-folha` recomputar as derivações fora do motor para descobrir os fatos, o que duplica a
execução e permite divergir; (c) o motor observar o que cada derivação consulta na
`LinhaDoTempo`, já que é ele quem a entrega a `derivar()`.

**Decisão:** (c). `ParametrosContexto.observador?` (`ObservadorDeLeituras`) recebe:
- `derivacaoLida({chave, versao, valor, fatos})` a cada leitura de derivação. Os `fatos` são
  coletados por um decorator de `LinhaDoTempo` (`rastrearFatos`) que anota todo fato
  devolvido por `vigenteEm`, `todosDoTipo`, `aberturaDaHistoria` e `encerramentoDaHistoria`;
- `fatoLido(tipo, fatoId)` a cada `vigente`/`existe` da regra.

`calcularFolha` liga o observador e monta a explicação assim:
- derivação **sem** fatos consultados: fonte plana `'derivacao'`, como antes;
- derivação **com** fatos: sub-árvore `'no'` ("derivação 'cargo' v1") contendo a fonte
  `'derivacao'` e uma fonte `'fato'` por fato consultado;
- soma por classificação (`somaDasRubricasCom`): sub-árvore `'no'` ("soma das rubricas com
  'incide_previdencia'" = total) com uma fonte `'rubrica'` por parcela. Para isso o
  observador também recebe `classificacaoLida(classificacao, total, parcelas)`;
- fato lido direto pela regra: fonte `'fato'` no nível da regra;
- leituras repetidas da mesma chave na mesma regra (ex.: `quando` e `calcular` lendo
  `cargo`) são citadas **uma vez**.

Correção junto: o valor de uma derivação que devolve objeto (ex.: `dias_trabalhados` =
`{dias, diasNoMes}`) saía como `"[object Object]"` (`String(valor)`). Agora sai em JSON. O
golden test do Módulo 5 expôs o bug.

**Por quê:** a regra continua sem acesso à `LinhaDoTempo` e nenhum contrato do dominio muda.
A proveniência é um fato da execução, não da regra. A versão da derivação também passa a
constar, o que é necessário para reprodutibilidade (§1.4).

**Limitação assumida:** "consultado" não é o mesmo que "escolhido". A derivação `cargo` lê
os vigentes de `posse` **e** de `promocao` e fica com o mais recente, e os dois são citados.
`todosDoTipo` cita a lista inteira. Isso é honesto (todos foram insumo da decisão), mas o
extrato mostra mais fatos do que o "decisivo". Distinguir os dois exigiria que a derivação
declarasse a escolha, o que voltaria à opção (a).

