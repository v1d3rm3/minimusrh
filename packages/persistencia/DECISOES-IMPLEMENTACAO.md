# Decisões de implementação — pacote `persistencia`

Ambiguidades e lacunas encontradas entre `docs/MinimusRH_Playbook_Implementacao.md`
(Módulo 3) e os documentos de design (`MinimusRH_Design_Dominio.md`,
`MinimusRH_Roteiro_MVP.md` §2.1/§2.5) durante a implementação, no formato pedido:
*contexto → opções → decisão → por quê*. Revisão humana pendente (portão do playbook
antes do Módulo 4).

---

## 1. `validarConteudo` não existe em `dominio` — implementada aqui

**Contexto:** `Fato.conteudo` é descrito em `dominio/src/fato.ts` como "validado contra o
schema da versão do tipo" e o playbook (item 2 do Módulo 3) pede que
`fato-repositorio.ts::registrar` valide o conteúdo "ANTES do insert" — mas nenhuma função
de validação existe em `dominio` (nem em `catalogo-fatos.ts`, que só define a *forma* do
schema, `CampoSchema[]`).

**Decisão:** implementada em `src/validacao-conteudo.ts::validarConteudo`, chamada por
`fato-repositorio.ts::registrar` antes de qualquer I/O. Resolve o `TipoFato`/`VersaoTipoFato`
pela combinação `(tipo, versaoDoTipo)` do próprio fato (não por `versaoVigente` — o fato já
sabe sob qual versão nasceu, Design §3.4), confere `alvo.escopo` contra `TipoFato.alvo`,
`exigeAmparo`, e valida `conteudo` campo a campo contra `CampoSchema[]`: chaves ausentes
obrigatórias (exceto `depreciado: true`, que fica opcional independente de `obrigatorio` —
§9.2) falham; chaves não catalogadas no schema também falham (allow-list estrito); o shape
de cada campo é mapeado por `TipoCampo` reusando os construtores do dominio (`dataEfeito`,
`Dinheiro.de`, `Percentual.de`) — nunca reimplementando parsing.

**Por quê:** é uma porta de escrita — não pode ficar sem validação até `regras-alrn`
(Módulo 4) existir. O `switch` sobre `TipoCampo` em `validarValorDoCampo` NÃO viola a Regra
Global #3 (nenhum `if`/`switch` sobre chave de domínio): `TipoCampo` é vocabulário FECHADO
da plataforma (6 tipos primitivos, nunca crescem por instituição), o mesmo estatuto de
`TipoGrupo` em `dominio/src/normalizacao-amparo.ts`, que já faz exatamente esse tipo de
switch dentro do próprio `dominio`.

---

## 2. Migração em duas fases + escolha do `node-pg-migrate`

**Contexto:** o Roteiro §2.5.3 exige duas roles (`minimus_app` sem UPDATE/DELETE,
`minimus_migracao` dona das tabelas) e o playbook pede "ferramenta de migração à sua
escolha (registre a escolha)". `minimus_migracao` precisa existir ANTES de rodar as
migrações de schema (para ser dona das tabelas que cria) — um problema de ordem que a
ferramenta de migração sozinha não resolve.

**Opções consideradas:** (a) `node-pg-migrate` — madura, TS nativo via `jiti`, API
programática (`runner(...)`) ideal para rodar contra um container efêmero, tracking de
migrações aplicadas "de graça" (idempotência); (b) runner caseiro lendo `.sql` numerados —
zero dependência externa, mas reinventar tracking/lock/transação é escopo por si só, fora
do que o Módulo 3 pede; (c) `postgres-migrations`/`umzug` — manutenção mais esporádica ou
desenhados para outro caso de uso (ORMs).

**Decisão:** `node-pg-migrate` (v9), com migrações em DUAS pastas/fases:
`migrations/bootstrap/` (roda autenticada como o superusuário do ambiente — cria as duas
roles, idempotente via `DO $$ ... IF NOT EXISTS`) e `migrations/schema/` (roda como
`minimus_migracao` — as 4 tabelas + índices + triggers + grants). Cada fase tem sua
própria tabela de tracking (`pgmigrations_bootstrap` / `pgmigrations`) porque rodam sob
roles diferentes. Corpo de cada migração é SQL explícito via `pgm.sql(...)` — nunca o
table-builder da lib — respeitando "SQL explícito, ORM com moderação" (Roteiro §2.5.4).
Senhas das duas roles vêm de `MINIMUS_MIGRACAO_SENHA`/`MINIMUS_APP_SENHA` com defaults
determinísticos de desenvolvimento/teste (`minimus_migracao_dev`/`minimus_app_dev`) —
gestão real de segredos (rotação, cofre) é assunto de infraestrutura/deploy, fora do
escopo deste módulo.

**Por quê:** resolve de graça o problema de idempotência (critério de aceite explícito) e
de execução repetível contra um Postgres que nasce e morre a cada suíte de teste, sem
inventar um mini-sistema de migração à parte.

---

## 3. `AlvoFato` e `Amparo` decompostos em colunas, não em JSONB único

**Contexto:** o esboço do Roteiro §2.1 sugere uma única coluna `historia_id (ou
pessoa_id)`, e trata `amparo` como um bloco. Mas `AlvoFato` é uma união com DUAS formas de
identidade (`pessoaId`/`historiaId`) que precisam de índices próprios (Roteiro §2.5.3 pede
`(historia_id, tipo, data_efeito, data_registro)`), e o playbook pede
`identificacao_canonica` do amparo **indexada** — o que exigiria índice de expressão sobre
JSONB se o amparo fosse um blob.

**Decisão:** `fato` ganha `alvo_escopo` + `alvo_pessoa_id`/`alvo_historia_id` (nulináveis,
com `CHECK` de consistência) e `amparo_tipo`/`amparo_identificacao_canonica`/
`amparo_como_informado`/`amparo_validado_contra_versao` (idem). `autor` continua um único
JSONB (a união dos 3 tipos de autor não precisa de índice próprio nem tem campo indexável
isolado).

**Por quê:** coluna própria é mais direto que índice de expressão, e é o que o texto do
playbook sugere ao citar "amparo com identificacao_canonica indexada" como um atributo, não
um blob opaco.

---

## 4. `folha` e `transicao_folha` não recebem a trigger append-only

**Contexto:** o playbook pede a trigger `BEFORE UPDATE OR DELETE` "nas duas tabelas
append-only" — mas `folha` é, por design (§3.10/§5.5, e o próprio
`motor::ciclo-folha::transitar`, que produz uma `Folha` com `estado`/`corte` MUTADOS), uma
tabela de ESTADO ATUAL, atualizada a cada transição.

**Decisão:** a trigger de bloqueio (`bloquear_alteracao_append_only`) só é aplicada em
`fato` e `registro_calculo`. `folha` recebe `UPDATE` normalmente (via
`folha-repositorio.ts::persistirTransicao`). `transicao_folha` é, na prática, só-INSERT
(uma linha por transição, nunca reescrita), mas NÃO recebe uma trigger dedicada — o texto
do playbook restringe literalmente "as duas tabelas append-only", que são `fato` e
`registro_calculo`. `minimus_app` recebe apenas `SELECT, INSERT` em `transicao_folha`
mesmo assim, por princípio de menor privilégio.

**Por quê:** aplicar a trigger em `folha` quebraria o próprio fluxo de transição de
estado que o Módulo 2 (`motor`) já decidiu; e estender a trigger a `transicao_folha` seria
ir além do que o critério de aceite pede, sem necessidade prática (nenhum código deste
pacote jamais atualiza/apaga uma linha de `transicao_folha`).

---

## 5. Semântica de cadeia de substituição A←B←C: exclusão par-a-par

**Contexto:** o playbook pede que "um fato referenciado por `substitui_fato_id` de outro
fato dentro do corte não apareça em `vigenteEm`/`todosDoTipo`" e pede que a semântica de
cadeias (A corrigido por B, corrigido por C) seja documentada.

**Decisão:** a pré-carga de `linha-do-tempo-pg.ts` usa exclusão par-a-par via `NOT EXISTS`:
```sql
WHERE ... AND NOT EXISTS (
  SELECT 1 FROM fato sub
  WHERE sub.substitui_fato_id = f.id AND sub.data_registro <= $corte
)
```
Isso resolve cadeias transitivamente SEM CTE recursiva: com corte conhecendo só A, A
aparece (nada o substitui ainda); conhecendo A+B, A é excluído (B o substitui) e B aparece;
conhecendo A+B+C, A e B são excluídos e só C aparece. Cada corte enxerga exatamente a
"ponta" da cadeia conhecida até ele, porque cada elo intermediário sempre tem, dentro do
próprio corte, seu substituto imediato conhecido.

Reforço de integridade adicionado (não pedido literalmente, mas necessário para a
exclusão par-a-par ser correta em qualquer ordem de registro): a trigger `BEFORE INSERT`
`validar_substituicao_fato` exige que um fato substituto tenha `data_registro >=` a do
substituído e preserve o mesmo `tipo` — sem isso, um substituto com `data_registro`
artificialmente anterior poderia aparecer "conhecido" antes do original em algum corte
intermediário, quebrando a garantia acima.

**Por quê:** é a implementação mais simples que satisfaz o requisito, e evita reimplementar
com WITH RECURSIVE algo que a exclusão par-a-par já resolve sozinha, dada a pré-condição
de integridade imposta pela trigger.

---

## 6. Reidratação de `Amparo`: `Object.create`/`Object.assign`, não `Amparo.legado`

**Contexto:** `dominio/src/amparo.ts` só expõe duas portas de construção: `Amparo.criar`
(recalcula a canônica a partir de entrada crua + catálogo) e `Amparo.legado` (idem, sem
catálogo, `identificacaoCanonica = entrada.trim()`). Nenhuma serve para reconstruir um
`Amparo` JÁ persistido sem recomputar a canônica — usar `Amparo.legado(tipo,
comoInformado)` ao LER de volta um fato recalcularia `identificacaoCanonica` a partir de
`comoInformado`, podendo divergir da canônica realmente gravada (ex.: normalização que
remove zeros à esquerda) e quebrando o round-trip.

**Decisão:** `mapeamento-fato.ts::reidratarAmparo` reconstrói a instância via
`Object.assign(Object.create(Amparo.prototype), dados)`. Isso é seguro porque `Amparo` só
tem o CONSTRUTOR privado (apagado em tempo de compilação — TypeScript não impõe `private`
em runtime); a classe não declara nenhum campo `#privado` de verdade, só propriedades
`readonly` públicas + o método `mesmoDocumentoQue` (herdado via prototype, portanto
presente no objeto reconstruído). Confirmado que TypeScript aceita a atribuição
estruturalmente (testado isoladamente com `tsc --strict` antes de adotar o padrão).

**Por quê:** a alternativa seria adicionar uma terceira porta (`Amparo.reidratar(...)`) ao
pacote `dominio` — mas isso está fora do escopo do Módulo 3 (o `dominio` já foi revisado e
fechado no portão humano do Módulo 1); o padrão aqui é a técnica usual para repositórios
reidratarem value objects com construtor privado sem tocar no pacote de domínio.

---

## 7. Identidade (`id`) de `Fato`/`Folha` cunhada em `persistencia`, não por `DEFAULT` do banco

**Contexto:** nem `dominio` nem o playbook especificam quem gera `FatoId`/`FolhaId`.

**Decisão:** `fato-repositorio.ts::registrar` e `folha-repositorio.ts::criar` cunham o id
via `randomUUID()` (node:crypto) ANTES do INSERT, e o devolvem — não usam
`DEFAULT gen_random_uuid()` no schema.

**Por quê:** mantém TypeScript como única fonte da identidade antes e depois do INSERT
(sem precisar de `RETURNING id` + round-trip extra para descobrir o id gerado pelo banco),
e produz o mesmo tipo de valor (`FatoId`/`FolhaId`, branded string) tanto antes quanto
depois da escrita. `registro_calculo`/`transicao_folha` usam `bigserial` técnico (o
domínio não dá identidade própria a `RegistroCalculo`/`TransicaoFolha`), mas esse id nunca
é exposto fora de `persistencia`.

---

## 8. Vínculo pessoa↔história em `linhaDoTempoPg`: recebido explicitamente do chamador

**Contexto:** `LinhaDoTempo` (Design §4) diz textualmente que enxerga "os fatos de uma
história (e da pessoa dona dela)" — mas nenhuma tabela em escopo do Módulo 3 modela esse
vínculo (não existe `HistoriaRepositorio` nem um campo `pessoaId` em `Folha`/`Fato` que
amarre os dois na direção história→pessoa dona).

**Decisão:** `linhaDoTempoPg(pool, catalogo, { pessoaId, historiaId }, corte)` recebe os
dois ids explicitamente do chamador.

**Por quê:** decisão conservadora — inventar uma tabela/relacionamento não especificado
seria "decidir demais" sobre um contrato que provavelmente pertence a um módulo de
identidade/pessoa ainda não escrito. **Suposição sinalizada para confirmação**: é o ponto
mais provável de precisar ajuste quando `app-folha` (Módulo 5) ou um pacote de identidade
nascerem.

---

## 9. Teste bitemporal usa um tipo de fixture `cargo`, não a derivação real posse+promoção

**Contexto:** o playbook pede um teste `vigenteEm('cargo', abril)` com corte maio ⇒ B6 /
corte agosto ⇒ B8 (cenário Victor) — mas `cargo` é uma DERIVAÇÃO no design real (Design §4:
"cargo (último fato de promoção/posse vigente)"), implementada em `regras-alrn` (Módulo 4),
que unifica fatos de `posse` e `promocao`. `persistencia` (Módulo 3) não tem acesso a
nenhuma derivação — só a `LinhaDoTempo.vigenteEm(tipo, em)` sobre um único tipo de fato.

**Decisão:** os testes de integração de `persistencia` (`src/testes/fixtures.ts`) definem
um tipo de fato de fixture chamado `cargo` (`TIPO_CARGO`) diretamente, com duas versões ao
longo do tempo (B6 registrado em janeiro, B8 com efeito fevereiro/registro julho),
exercitando `vigenteEm` sobre ESSE tipo único.

**Por quê:** testa o mecanismo bitemporal de `persistencia` (a resolução `versaoVigente`
sobre fatos vindos do banco, a query de exclusão de substituídos) sem inventar a lógica de
derivação que pertence ao Módulo 4 — permanece fiel ao "não implemente lógica de cálculo,
decisões de negócio" do escopo do Módulo 3.

---

## 10. Exportações e `listarRegistros` acrescentados no Módulo 5

**Contexto:** `app-folha` (Módulo 5) precisa (i) subir o mesmo schema nos seus testes de
integração e no `demo:victor`, (ii) ler `registro_calculo` no `LeitorDeJanelas` real, que o
playbook coloca em `app-folha` e não aqui, e (iii) reler os registros de uma folha fechada
para o golden test.

**Decisão:**
- `DIRETORIO_MIGRACOES` (`bootstrap`/`schema`), resolvido a partir da raiz do pacote, vale
  rodando de `src/` ou de `dist/`. O suporte de teste daqui passou a usá-lo também.
- `linhaParaRegistroCalculo`, `SELECT_REGISTRO_CALCULO` e `LinhaRegistroCalculo` exportados.
  O NUMERIC ⇄ `Dinheiro` continua com um único dono.
- `FolhaRepositorio.listarRegistros(folhaId)`, em ordem de inserção (= ordem do motor).

**Por quê:** copiar migrações para outro pacote criaria dois schemas que podem divergir.
Exportar o mapeamento evita uma segunda conversão NUMERIC→dinheiro escrita à mão.

**Achado registrado (ver `app-folha` DECISOES #7):** `timestamptz` volta do banco como
`…00.000Z`, não necessariamente na forma em que foi gravado. Como `DataRegistro` é comparada
como texto, isso importa na fronteira do corte.
