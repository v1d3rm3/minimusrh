# Decisões de implementação — pacote `app-folha`

Ambiguidades e lacunas encontradas entre `docs/MinimusRH_Playbook_Implementacao.md` (Módulo
5) e os documentos de design (Roteiro §3 Marcos 0–1; Fundação §5.2, §5.4, §5.5, §7.3)
durante a implementação, no formato *contexto → opções → decisão → por quê*.
Revisão humana pendente (portão do playbook antes do Módulo 6).

---

## 1. Serviço genérico; a ALRN entra por `configuracaoAlrn()`

**Contexto:** o playbook diz que `app-folha` depende de `motor`, `persistencia` e
`regras-alrn`. A Regra Global #3 proíbe `if`/`switch` sobre chave de domínio no core.

**Decisão:** `criarServicoFolha` recebe uma `ConfiguracaoInstituicao` (catálogos de tipos de
fato, tipos de folha, rubricas, regras e derivações). Só `configuracaoAlrn()` importa
`regras-alrn`. O serviço não menciona rubrica, tipo de fato nem regra da ALRN.

**Por quê:** é o mesmo princípio do §4 da Fundação ("domínio entra pelo catálogo"), aplicado
um andar acima. Também permite que os testes troquem uma regra (ex.: uma `salario_base` que
estoura o NUMERIC, para provar o rollback) sem tocar na ALRN.

---

## 2. `CadastroDeHistorias`: porta para o vínculo pessoa↔história

**Contexto:** `persistencia` DECISOES #8 sinalizou que nenhuma tabela modela o vínculo
pessoa↔história, e `linhaDoTempoPg` exige os dois ids. O serviço precisa saber **quais**
histórias calcular.

**Opções:** (a) criar uma tabela `historia(id, pessoa_id)`; (b) inferir as histórias a
partir dos fatos de abertura, mas fato de história não carrega a pessoa; (c) uma porta
injetada.

**Decisão:** (c). `CadastroDeHistorias { listar(): Promise<AlvoHistoria[]> }`, com
`cadastroEmMemoria` para testes e demo.

**Por quê:** inventar o esquema de identidade da pessoa é decidir demais (mesma postura da
#8 de `persistencia`). A porta é o ponto exato onde um futuro pacote de identidade, ou o
importador do Marco 3, se pluga. **A confirmar com o humano:** onde esse vínculo deve morar.

---

## 3. `LeitorDeJanelas` real: horizonte declarado, média por competência

**Contexto:** `LeitorDeJanelas` é síncrono (motor puro), e `ConsultaJanela` traz os quatro
eixos de §5.4. Os documentos não definem (i) quanto pré-carregar, (ii) o divisor da
`media`, nem (iii) o papel de `agregacao: 'contagem'` em `agregado()`.

**Decisão:**
- **Horizonte:** a pré-carga cobre exatamente as competências das janelas **declaradas**
  pelas regras resolvidas (`DeclaracaoConsumo.janelas`). Uma consulta que não bate com
  nenhuma declarada é **recusada** com erro, que vira `ErroCalculoFolha` e bloqueia o
  fechamento. Sem janela declarada (o caso da ALRN hoje), nenhuma query é feita.
- **`media`** = soma ÷ **número de competências da janela** (últimas 12 ⇒ ÷12, mesmo que só
  existam 3 meses fechados). Não é ÷ número de registros.
- **`contagem()`** conta registros, qualquer que seja a `agregacao` da consulta.
  `agregado()` com `agregacao: 'contagem'` é erro: a pergunta é numérica, não monetária.
- **Classificação** é lida da **versão da rubrica com que o registro foi selado**
  (`versao_rubrica`), não da versão vigente hoje. Mudar a classificação de uma rubrica não
  reescreve o passado.
- `ano_civil` = janeiro até a competência corrente, inclusive. `{ultimas: N}` inclui a
  corrente (`Competencia.ultimas` do dominio).

**Por quê:** recusar o não declarado faz a declaração ser a fonte de verdade, como a
análise estática da DSL (Módulo 10) fará. Média por competência é a leitura conservadora
para médias de 13º/férias ("média das últimas 12"): meses sem pagamento contam como zero.
**A confirmar com o humano:** se a ALRN calcula médias sobre meses efetivamente pagos, o
divisor muda. Isso vai aparecer quando a primeira regra com janela for escrita.

---

## 4. Reprodutibilidade da janela: corte + selo `folhasConsumidas`

**Contexto:** Fundação §5.4 peça 3: "a folha fechada sela quais folhas fechadas consumiu" e
rejeita "consome o que estiver fechado na hora".

**Decisão:**
- Entram na janela só folhas `fechada` com transição para `fechada` de instante **≤ corte**
  da folha calculada. A própria folha nunca entra.
- No fechamento, `folhasConsumidas` = as folhas cujos registros **efetivamente alimentaram**
  alguma resposta (não todas as que estavam no horizonte), ordenadas. O selo é gravado na
  mesma transação dos registros.
- `reproduzir` restringe a leitura ao selo. Uma folha fechada sem selo (fechada fora do
  serviço) é tratada como selo vazio, que é a leitura mais restritiva.

**Por quê:** fechada é terminal, então "fechadas até o corte" é um conjunto que nunca muda.
O selo é a segunda trava, e documenta o que de fato pesou no cálculo.

**Limitação assumida:** o teto incremental de §5.4 ("todas as já fechadas + a que estou
calculando") e a exigência de dependências fechadas no fechamento são o Módulo 12. Aqui só
existe a leitura.

---

## 5. História sem fato de abertura conhecido até o corte não participa

**Contexto:** `linhaDoTempoPg.aberturaDaHistoria()` lança se não há abertura até o corte, e
`motor::calcularFolha` a chama fora do `try` por regra. Uma história cadastrada cuja posse
só foi registrada depois do corte derrubaria a folha inteira.

**Decisão:** o serviço testa `aberturaDaHistoria()` ao carregar e descarta a história se ela
lançar.

**Por quê:** pela leitura bitemporal, a história ainda não existia para quem sabia até o
corte. É o mesmo resultado que o `participa()` do motor daria se conhecesse a abertura.

---

## 6. Golden test: serialização canônica, apelidos e duas provas

**Contexto:** "serializa o resultado completo num arquivo golden; roda o cálculo de novo do
zero e compara byte a byte". Dois obstáculos: o JSONB do Postgres **reordena as chaves** da
explicação, e os ids de folha e fato são UUIDs cunhados a cada semeadura, de modo que um
arquivo commitado com ids reais nunca bateria.

**Decisão:** `serializarRegistros` ordena os registros por (história, rubrica), ordena as
chaves recursivamente e escreve valores monetários como string. O teste faz **duas provas**:
1. **Reprodução:** o que foi persistido == `reproduzir()`, com ids reais e nenhuma troca;
2. **Golden:** o mesmo resultado, com ids gerados trocados por apelidos estáveis
   (`fato:promocao@2026-02-15`, `folha:mensal@2026-07`), == `golden/victor-2026-07-mensal.json`.

Para regravar o golden de propósito: `ATUALIZAR_GOLDEN=1 rushx test`. Sem a variável, um
golden ausente é falha.

**Por quê:** (1) prova a propriedade (mesmo corte ⇒ mesmo resultado) e (2) prova que o
resultado não mudou entre commits. Os apelidos só trocam strings que são **exatamente** um
id conhecido, então nenhum conteúdo é mascarado.

**Atenção:** os valores do golden derivam das tabelas **inventadas** de `regras-alrn` (#6
salário, #8 previdência). Quando as tabelas reais chegarem, o golden muda. Isso é uma
mudança consciente e revisada, nunca um "atualizar para passar".

---

## 7. Instantes canonizados: corrigido na porta do dominio

**Contexto:** descoberto pelo próprio teste. O Postgres devolve `timestamptz` como
`2026-08-01T00:00:00.000Z`, e o chamador pode passar `2026-08-01T00:00:00Z` ou um offset.
`DataRegistro` é comparada como **texto** no dominio, e a ordem de texto contradiz a ordem
real (`"…00Z" > "…00.000Z"`; `"01:00+02:00" > "00:00…Z"` mesmo sendo anterior). Uma versão
de regra publicada no instante do corte valia na simulação e sumia no fechamento.

**Decisão:** a correção mora na porta única `dataRegistro()` do dominio (dominio DECISOES
#11), que agora devolve sempre a forma canônica do Postgres. Aqui, `canonizarInstante`
reaplica a porta a todo instante que entra no serviço (corte provisório, corte travado e
instante de fechamento), para cobrir valores que chegaram por cast. A folha devolvida pelo
serviço é idêntica à relida do banco (testado).

**Teste de regressão:** "fronteira do corte" em `servico-folha.integracao.test.ts`, com as
duas grafias problemáticas. Ele foi verificado **falhando** com as duas correções desfeitas e
passando com elas.

---

## 8. Escolhas conservadoras no ciclo da folha

- **Simulação só em folha `aberta`.** Em `em_conferencia` o corte já está travado e o cálculo
  oficial é o do fechamento. Simular com outro corte ali confundiria as duas coisas.
- **Fechar com erro de cálculo é recusado** (`ErroFechamentoComErros`) e nada é persistido.
  Folha fechada é terminal: fechar com uma rubrica faltando seria pagar errado sem volta.
- **Instante de fechamento anterior ao corte é recusado:** fechar não pode ser anterior ao
  conhecimento que a folha usa.
- **A transição é validada antes do cálculo**, por `motor::transitar`. Nenhuma tabela de
  estados é duplicada aqui (teste de arquitetura). Para simular e reproduzir, que não são
  transições, há a checagem `exigirEstado`.
- Conforme o playbook, **fechar não confere com a última simulação** (a conferência humana é
  pós-MVP).

---

## 9. Mudanças em pacotes já fechados

Registradas também nos DECISOES de cada pacote:
- **motor #12:** `LeitorDeJanelas.agregado/contagem` recebem a `historiaId`.
- **motor #13:** observador de leituras. A explicação passa a citar os fatos consultados
  pelas derivações e pela regra, a soma por classificação com as parcelas, e a versão da
  derivação. O valor de derivação objeto passa a sair como JSON (antes saía
  `[object Object]`, bug exposto pelo golden).
- **persistencia #10:** exporta `DIRETORIO_MIGRACOES` e o mapeamento de `registro_calculo`;
  `FolhaRepositorio.listarRegistros`.

---

## 10. Demo e suporte de teste compilados junto

**Contexto:** `demo:victor` precisa de um Postgres. O único jeito sem infraestrutura é
Testcontainers, que é devDependency.

**Decisão:** `src/demo/victor.ts` e `src/testes/*` vão para `dist/` (como em `persistencia`),
mas ficam fora de `exports` e da cobertura. O teste de arquitetura proíbe `testcontainers`
fora dessas duas pastas. O script é `rushx demo:victor` (exige build e Docker).

**Por quê:** o critério de aceite pede um script que rode o fluxo real. Subir o mesmo
ambiente dos testes garante que o demo mostra exatamente o que o golden prova.
