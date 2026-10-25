# Decisões de implementação — pacote `importador-legado`

Ambiguidades e lacunas encontradas entre `docs/MinimusRH_Playbook_Implementacao.md` (Módulo 7)
e os documentos de design (Roteiro §3 Marco 3, peça 1; §4, "dados legados sem
bitemporalidade") durante a implementação, no formato *contexto → opções → decisão → por quê*.
O layout de entrada está em `docs/layout-importacao.md`. Revisão humana pendente (portão do
Módulo 7).

---

## 1. `CONVENCAO_REGISTRO_DESCONHECIDO`: registro := efeito, à meia-noite UTC

**Contexto:** o legado guarda estado, não quando soube de cada coisa. O Roteiro admite duas
convenções ("`data_registro := data_efeito` (ou a data da importação)"), e o playbook fixa a
primeira e pede uma constante nomeada.

**Opções:** (a) `data_efeito`; (b) a data da importação; (c) recusar fato sem data de registro.

**Decisão:** (a). `convencoes.ts::CONVENCAO_REGISTRO_DESCONHECIDO.aplicar(efeito)` =
`<efeito>T00:00:00Z`. Quando a fonte traz a data (coluna `data_registro` de `eventos.csv`), ela
é usada e a convenção não se aplica. A convenção fica visível de três formas: a `dataRegistro`
do fato gravado é exatamente a meia-noite do efeito; o autor é o lote de importação; e o
relatório conta quantos fatos novos usaram a convenção (`FatoTraduzido.registroPorConvencao`).

**Por quê:** é o que o playbook pede. Também é a única das duas que não precisa de relógio:
"data da importação" exigiria `agora`, e o relógio só existe na `api` (Regra Global #2). Além
disso, reimportar daria outra data e quebraria a idempotência.

**Consequência a notar (para o humano):** um fato importado com a convenção é "sabido desde
sempre", então **nunca** alcança retroativamente uma folha fechada (`alcance-retroativo.ts`
do app-folha: efeito ≤ competência < registro). Isso está certo para a carga inicial, porque
não há folha fechada no MinimusRH antes dela. Para **lotes incrementais** depois que houver
folhas fechadas, não está: um vínculo que ganhou `data_fim` entra com registro no passado e não
aciona a apuração retroativa. `vinculos.csv` não tem coluna de data de registro. Se a carga
incremental for usada em produção, é preciso acrescentar essas colunas ou recusar a
convenção para lotes posteriores ao primeiro fechamento.

---

## 2. Idempotência por chave natural, numa tabela própria (`fato_importado`)

**Contexto:** "reimportar o mesmo lote não duplica fatos (chave natural documentada no
DECISOES)". `fato` é append-only, e o `id` é cunhado por `persistencia` (persistencia
DECISOES #7).

**Opções:** (a) `id` do fato derivado da chave natural e `ON CONFLICT (id) DO NOTHING`, o que
exigiria que `registrar` aceitasse o `id` de fora, contra a DECISOES #7; (b) procurar um fato
igual na tabela `fato` antes de gravar, comparando JSONB; (c) uma tabela
`fato_importado(chave_natural PK, fato_id, assinatura, lote)`.

**Decisão:** (c), na migração `0008` de `persistencia`. As chaves:

| Origem | Chave natural |
|---|---|
| nascimento | `servidor:<id_servidor>:nascimento` |
| abertura do vínculo | `vinculo:<id_vinculo>:abertura` |
| encerramento do vínculo | `vinculo:<id_vinculo>:encerramento` |
| evento | `evento:<id_evento>` |
| linha de gabarito | `contracheque:<id_vinculo>:<competencia>:<tipo_folha>:<rubrica>` (chave única de `gabarito_legado`) |

Regras:
- A chave **não inclui o lote**. Reimportar os mesmos dados com outro nome de lote também não
  duplica. O lote fica registrado como o primeiro que gravou.
- A **assinatura** é o SHA-256 do fato canônico (JSON com chaves ordenadas), **sem o autor**,
  porque o autor carrega o lote. Mesma chave com a mesma assinatura: no-op, contado como "já
  importado". Mesma chave com outra assinatura: **conflito**, a unidade é rejeitada e nada dela
  é gravado. A importação **não** corrige: corrigir pede um fato de substituição
  (`substituiFatoId`), que é decisão humana, fora do escopo.
- A mesma chave repetida **dentro do lote** é rejeitada, apontando a primeira ocorrência, mesmo
  com conteúdo igual. Uma linha duplicada no legado é sinal a investigar, não algo para engolir.
- Chave nova num vínculo já importado (ex.: o vínculo ganhou `data_fim`) entra normalmente.
  É o estado do legado que andou (ver a consequência da #1).

**Por quê:** (a) fere uma decisão já revisada; (b) depende de comparar JSONB e não distingue
"igual" de "o legado mudou". (c) é explícita, auditável (de que lote veio cada fato) e não toca
na tabela `fato`.

---

## 3. Identidade: UUID v5 derivado do identificador legado + tabelas de mapa

**Contexto:** as colunas de pessoa e história são `uuid`, e o legado tem matrículas. O
`app-folha` (DECISOES #2) e `persistencia` (DECISOES #8) deixaram em aberto onde mora o vínculo
pessoa↔história e indicaram o importador como um dos pontos de encaixe.

**Decisão:**
- `identidade.ts`: `pessoaId = uuidV5("servidor:" + id_servidor)` e
  `historiaId = uuidV5("vinculo:" + id_vinculo)`, num namespace fixo (`NAMESPACE_LEGADO`).
- Tabelas `servidor_legado(id_servidor_legado PK, pessoa_id)` e
  `vinculo_legado(id_vinculo_legado PK, historia_id, id_servidor_legado → servidor_legado,
  pessoa_id)`, append-only.
- `listarVinculosImportados(pool)` devolve os pares `{pessoaId, historiaId}` com os ids do
  legado: é o que o harness (Módulo 8) vai entregar ao `CadastroDeHistorias`.
- Um vínculo já gravado para outro servidor é conflito.

**Por quê:** o id derivado torna a reimportação idempotente sem consultar o banco, e um evento
aponta para a história certa antes de o vínculo ser gravado. O mapa em tabela é o vínculo
pessoa↔história que faltava, mas **só para dados importados**. Continua não existindo um
cadastro de identidade geral: isso fica para um módulo próprio, e não foi inventado aqui.
Mudar `NAMESPACE_LEGADO` muda todos os ids, por isso ele é uma constante exportada e testada
contra o vetor do UUID v5.

---

## 4. Erro de estrutura é fatal; erro de linha é rejeição

**Contexto:** "registro rejeitado NÃO derruba o lote". Mas há erros que não são de um registro.

**Decisão:**
- **Fatal** (aborta antes de gravar qualquer coisa): arquivo ausente, cabeçalho sem coluna
  obrigatória, coluna desconhecida ou repetida, aspas não fechadas. O pipeline lê a fonte
  **inteira** antes da primeira escrita, para que um erro desses no último arquivo não deixe
  meio lote gravado.
- **Ilegível** (`RegistroIlegivel`, rejeição): linha com número errado de colunas, coluna
  obrigatória vazia, amparo pela metade.
- **Rejeitado** pelo tradutor ou pelo destino: o resto (ver `docs/layout-importacao.md`).
- Os quatro arquivos são obrigatórios. Um arquivo só com o cabeçalho é um conjunto vazio.

**Por quê:** um cabeçalho errado indica que o layout inteiro está errado. Seguir em frente
rejeitaria todas as linhas, ou pior, leria colunas trocadas. Uma coluna desconhecida pode ser
um erro de digitação de uma coluna opcional, e ignorá-la apagaria o dado sem aviso. Exigir os
quatro arquivos evita que um arquivo esquecido passe por "não havia nada".

---

## 5. Versão do tipo de fato: a vigente no efeito; antes da primeira, a primeira

**Contexto:** `Fato.versaoDoTipo` é obrigatório. O catálogo da ALRN tem só a V1, com efeito em
2026-01-01, e as posses importadas são de anos antes. `versaoVigente` não acha versão para
2020.

**Opções:** (a) rejeitar fato anterior à primeira versão; (b) usar sempre a versão mais nova;
(c) a vigente no efeito, com o catálogo mais recente, e, se o fato for anterior a todas, a
primeira versão.

**Decisão:** (c), `tradutores.ts::escolherVersaoDoTipo`. O critério de "catálogo mais
recente" é o mesmo do `amparo.ts` do dominio (corte = maior `dataRegistro` entre as versões).

**Por quê:** (a) tornaria a importação de histórico impossível com o catálogo de hoje. (b)
validaria um fato de 2010 contra um schema que pode ter nascido depois dele. (c) segue o
mesmo princípio da vigência (o schema de quando o fato aconteceu) e trata a data da V1 como o
que ela é: a data em que o catálogo foi publicado, não a data em que posses passaram a existir.

---

## 6. Atomicidade por unidade (registro do legado) e `ExecutorSql` em `persistencia`

**Contexto:** um vínculo vira identidade + abertura + encerramento. Gravar só parte (a
identidade sem a posse, por exemplo) deixaria uma história sem abertura, que o cálculo ignora
em silêncio (app-folha DECISOES #5).

**Decisão:** cada registro do legado é uma **unidade** (`UnidadeImportacao`), gravada numa
única transação por `destino-pg.ts`. Um conflito em qualquer peça desfaz a unidade inteira.
Para o fato entrar na mesma transação pela porta única de escrita, `fatoRepositorioPg` passou a
aceitar `Pool | PoolClient` (`ExecutorSql`, persistencia DECISOES #11). Importações
concorrentes da mesma chave se serializam por `pg_advisory_xact_lock(hashtext(chave))`.

**Por quê:** é o mesmo "tudo ou nada" do fechamento de folha. O fato continua passando por
`registrar`, que valida o conteúdo de novo antes do INSERT. O importador valida antes, para
dar o motivo da rejeição, e a porta valida depois, por garantia (`arquitetura.test.ts` proíbe
`INSERT INTO fato` direto neste pacote).

---

## 7. Ordem de dependência e integridade referencial

**Decisão:** o pipeline ordena por tipo (servidores, vínculos, eventos, contracheques),
preservando a ordem da fonte dentro de cada tipo. Um vínculo exige o servidor, e um evento ou
contracheque exige o vínculo, **aceito neste lote ou gravado num lote anterior**. Se o
servidor foi rejeitado, os vínculos dele também são, com o motivo
"servidor 'X' não está neste lote nem em lote anterior".

**Por quê:** com os ids derivados (#3), seria possível gravar um evento para um vínculo que não
existe, e ele nunca seria calculado. A cascata de rejeição deixa explícito no relatório o que
ficou de fora e por quê.

---

## 8. Estado do legado → tipos de fato, por configuração

**Contexto:** servidores e vínculos são estado, não eventos. Algum tipo de fato precisa ser
escolhido para "nascimento", "início do vínculo" e "fim do vínculo".

**Decisão:** `ConfiguracaoImportacao.tipos = { nascimento, abertura, encerramento }`, e só
`configuracaoAlrn()` conhece as chaves (`nascimento`, `posse`, `exoneracao`).
`validarConfiguracao` confere os papéis **pelo catálogo**: o nascimento tem alvo pessoa, a
abertura `abreHistoria`, o encerramento `encerraHistoria`. Os eventos já chegam com a chave do
tipo de fato e:
- só alvejam a história;
- não podem ser de tipo que abre ou encerra história, porque abertura e encerramento vêm de
  `vinculos.csv`. Isso evita duas posses para a mesma história.

O conteúdo do fato vem das colunas `campo.<nome>`, convertido pelo tipo do campo no schema.
`data_fim` é o **último dia de exercício**, coerente com `dias_trabalhados` (regras-alrn
DECISOES #3: o dia de saída conta).

**Por quê:** é o mesmo princípio do app-folha DECISOES #1, "domínio entra pelo catálogo". O
importador não tem `if` sobre chave de tipo de fato. O `switch` sobre `TipoCampo` é sobre
vocabulário fechado da plataforma, o mesmo argumento de `persistencia/validacao-conteudo.ts`.

---

## 9. CSV próprio, sem dependência; formatos estritos

**Decisão:** leitor de CSV mínimo em `csv.ts` (separador `;`, aspas RFC 4180, BOM, CRLF).
Datas em ISO (`AAAA-MM-DD`). Dinheiro com ponto decimal e até 2 casas no contracheque: o
`Dinheiro.de` do dominio aceitaria `1e3` e `0x10`, por isso o formato é conferido por regex
antes. Campo `numero` só aceita inteiro. Espaços aparados em todas as células, menos no
`amparo`.

**Por quê:** o layout é nosso e pequeno. Uma dependência de CSV traria opções (detecção de
separador, tipos inferidos) que só abririam espaço para ambiguidade. Os formatos do legado
real (data `DD/MM/AAAA`, vírgula decimal) são trabalho da fonte do legado real, quando ela for
definida. A fonte é plugável justamente para isso.

---

## 10. Amparo pela porta do legado, mas com tipo do catálogo

**Decisão:** `Amparo.legado(tipo, comoInformado)`, como o playbook pede: a grafia (`Proc.
123/2026`) não é validada contra a máscara e fica preservada. O **tipo** de amparo, porém,
precisa existir no catálogo de amparos, senão o evento é rejeitado.

**Por quê:** o tipo é chave de catálogo (`amparo_tipo` é indexável e agrupa documentos), e um
tipo inventado na importação seria uma chave que ninguém publicou. **A notar:** `Amparo.legado`
usa `trim()` como identificação canônica (dominio DECISOES #8), então `Proc. 123/2026` e
`123/2026` **não** se agrupam como o mesmo documento. Se o agrupamento importar para dados
legados, é preciso uma normalização própria do legado.

---

## 11. Gabarito: tabela própria, códigos do legado crus

**Decisão:** `gabarito_legado(chave_natural UNIQUE, id_vinculo_legado → vinculo_legado,
historia_id, competencia, tipo_folha_legado, rubrica_legado, descricao, valor NUMERIC(14,2),
lote)`, append-only. O código de rubrica e o de tipo de folha ficam como estão no legado. O
valor fica com o sinal do legado. Mesma chave com valor ou descrição diferente é conflito.

**Por quê:** o playbook põe o gabarito "fora da linha de fatos — é material de comparação". O
mapeamento de rubricas legado⇄MinimusRH é item 1 do Módulo 8 (harness). Traduzir aqui
anteciparia uma decisão que é de lá. **A notar:** a chave supõe **uma linha por rubrica por
contracheque**. Se o legado tiver duas linhas da mesma rubrica no mesmo mês (ex.: parcelas),
a segunda é rejeitada como repetida, e o layout precisará de uma coluna de sequência.

---

## 12. CLI: conexão pelo ambiente, sem migração, códigos de saída

**Decisão:** `importar --fonte csv --dir <diretório> --lote <id>`. A conexão vem das
variáveis `PG*`, lidas pelo próprio `pg`, com o papel `minimus_app` (sem UPDATE/DELETE). A CLI
**não** roda migrações: o schema precisa estar migrado. Lote: `[A-Za-z0-9][A-Za-z0-9._-]{0,63}`,
obrigatório (não há "data da importação" automática, #1). Saída `0` sem rejeições, `2` com
rejeições, `1` para erro de uso ou fatal. As fontes ficam num registro por nome (`FONTES`), onde
a fonte real vai entrar.

**Por quê:** a importação roda como a aplicação, não como dona do schema, que é o mesmo
princípio de privilégio mínimo do Roteiro §2.5.3. O código `2` deixa um script que chama a
CLI saber que houve rejeições sem precisar ler o texto.

---

## 13. Dados civis não importados

**Contexto:** o legado tem nome, CPF etc. O catálogo de tipos de fato da ALRN não tem tipo para
dados civis.

**Decisão:** o layout de referência não tem essas colunas, e uma coluna desconhecida é erro
fatal (#4). Só o nascimento (que é tipo de fato) é importado do servidor.

**Por quê:** importar exige um tipo de fato no catálogo, e criar um aqui seria inventar
configuração institucional. Se nome ou CPF forem necessários (para o harness identificar
pessoas, por exemplo), o caminho é publicar o tipo em `regras-alrn` e acrescentar a coluna.
