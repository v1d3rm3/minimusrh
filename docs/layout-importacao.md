# MinimusRH — Layout de importação do legado (fonte CSV de referência)

> Layout da `FonteCsv` do pacote `@minimusrh/importador-legado` (Playbook, Módulo 7; Roteiro §3,
> Marco 3, peça 1). É um layout **de referência**: o formato real do legado ainda será definido.
> Quando for, ele entra como outra implementação de `FonteLegado`, e os tradutores, o destino e
> o relatório continuam os mesmos.

## Visão geral

Um lote é **um diretório com quatro arquivos**, todos obrigatórios. Um arquivo só com o
cabeçalho é um conjunto vazio.

| Arquivo | Uma linha é | Vira |
|---|---|---|
| `servidores.csv` | uma pessoa | identidade da pessoa + fato `nascimento` (se houver data) |
| `vinculos.csv` | um vínculo (matrícula) = uma História | identidade da história + fato de abertura (`posse`) + fato de encerramento (`exoneracao`, se houver fim) |
| `eventos.csv` | um evento funcional | um fato do tipo indicado (ex.: `promocao`) |
| `contracheques.csv` | uma rubrica de um contracheque do legado | uma linha do **gabarito** (`gabarito_legado`), fora da linha de fatos |

A importação processa nessa ordem, qualquer que seja a ordem de leitura: um vínculo precisa do
seu servidor, e um evento ou contracheque precisa do seu vínculo. A referência pode estar no
mesmo lote ou num lote importado antes.

## Formato

- Codificação **UTF-8**, com ou sem BOM. Fim de linha LF ou CRLF.
- Separador **`;`**.
- A primeira linha é o **cabeçalho**. As colunas podem vir em qualquer ordem.
- Uma célula com `;`, aspas ou quebra de linha vai entre aspas duplas. Uma aspa dentro da célula
  é escrita dobrada: `"Unimed; plano ""A"""`.
- Célula vazia (ou só espaços) = valor **ausente**.
- Espaços nas pontas são removidos de todas as células, **exceto `amparo`**: a grafia do amparo é
  preservada para auditoria (`Amparo.comoInformado`).
- Linhas totalmente vazias são ignoradas.

### Tipos de valor

| Valor | Formato | Exemplo |
|---|---|---|
| data | `AAAA-MM-DD` | `2026-02-15` |
| data de registro | `AAAA-MM-DD` (lida como 00:00:00Z) ou timestamp ISO 8601 **com fuso** | `2026-07-10T14:30:00-03:00` |
| competência | `AAAA-MM` | `2026-03` |
| dinheiro (contracheque) | decimal com **ponto**, até 2 casas, sinal opcional | `1234.56`, `-12.5` |
| dinheiro / percentual (campo de fato) | decimal com **ponto** | `350.00`, `11.5` |
| número (campo de fato) | inteiro | `2` |
| lógico (campo de fato) | `sim`, `nao`, `não`, `true`, `false` (sem diferenciar maiúsculas) | `sim` |

Não há separador de milhar. `1.234,56` é rejeitado.

### Colunas `campo.<nome>`

Em `vinculos.csv` e `eventos.csv`, colunas com o prefixo `campo.` carregam o **conteúdo do
fato**, pelo nome do campo no schema do catálogo de tipos de fato (`regras-alrn`). Exemplo:
`campo.cargo` preenche o campo `cargo` de `posse` e de `promocao`. O valor é convertido pelo
tipo do campo no schema e validado contra o catálogo. Um campo que o tipo de fato não conhece é
rejeitado, e um campo obrigatório ausente também.

Um mesmo `eventos.csv` pode misturar tipos de fato. Cada linha usa as colunas `campo.*` do seu
tipo e deixa as outras vazias.

## Arquivos

### `servidores.csv`

| Coluna | Obrigatória | Conteúdo |
|---|---|---|
| `id_servidor` | sim | identificador da pessoa no legado |
| `data_nascimento` | não | data de nascimento. Vira o fato `nascimento` (alvo: pessoa) |

### `vinculos.csv`

| Coluna | Obrigatória | Conteúdo |
|---|---|---|
| `id_vinculo` | sim | identificador do vínculo/matrícula no legado |
| `id_servidor` | sim | o servidor dono do vínculo |
| `data_inicio` | sim | início do exercício. É a data de efeito do fato de abertura (`posse`) |
| `data_fim` | não | **último dia de exercício**. É a data de efeito do fato de encerramento (`exoneracao`). O dia de saída conta como trabalhado (regras-alrn DECISOES #3) |
| `campo.*` | conforme o schema | conteúdo do fato de abertura (na ALRN: `campo.cargo`, obrigatório) |

### `eventos.csv`

| Coluna | Obrigatória | Conteúdo |
|---|---|---|
| `id_evento` | sim | identificador do evento no legado (único no legado inteiro) |
| `id_vinculo` | sim | a história a que o evento se refere |
| `tipo_fato` | sim | chave do tipo de fato no catálogo (ex.: `promocao`, `comprovacao_plano_saude`) |
| `data_efeito` | sim | quando passa a valer |
| `data_registro` | não | quando o legado soube. **Ausente ⇒ `CONVENCAO_REGISTRO_DESCONHECIDO`** (abaixo) |
| `amparo_tipo` | junto com `amparo` | chave do tipo de amparo no catálogo (ex.: `processo`) |
| `amparo` | junto com `amparo_tipo` | identificação do documento **como está no legado** (ex.: `Proc. 123/2026`). Não é validada contra a máscara do catálogo (porta `Amparo.legado()`) |
| `campo.*` | conforme o schema | conteúdo do fato |

Eventos só se referem à **história**. Fatos de pessoa vêm de `servidores.csv`. Fatos que abrem
ou encerram história vêm de `vinculos.csv` (`data_inicio`/`data_fim`), nunca de eventos.

### `contracheques.csv`

| Coluna | Obrigatória | Conteúdo |
|---|---|---|
| `id_vinculo` | sim | o vínculo do contracheque |
| `competencia` | sim | `AAAA-MM` |
| `tipo_folha` | sim | código do tipo de folha **no legado** (ex.: `MENSAL`) |
| `rubrica` | sim | código da rubrica **no legado** (ex.: `0001`) |
| `descricao` | não | descrição da rubrica no legado, para leitura humana |
| `valor` | sim | valor como o legado pagou ou descontou, com o sinal do legado |

Os códigos de rubrica e de tipo de folha ficam **crus**. O mapeamento legado ⇄ MinimusRH é
configuração do harness (Módulo 8), não do importador.

## Convenções da tradução

- **`CONVENCAO_REGISTRO_DESCONHECIDO`**: quando a fonte não traz a data de registro, o fato é
  registrado como sabido desde que passou a valer: `data_registro := data_efeito`, às
  00:00:00Z. O fato gravado mostra isso na própria `dataRegistro`
  (`2020-03-01T00:00:00.000Z`), e o relatório conta quantos fatos usaram a convenção. Valem por
  ela o nascimento, a abertura, o encerramento e os eventos sem `data_registro`.
- **Autor**: todo fato importado tem autor `{ tipo: 'importacao', lote }`. O lote é o
  identificador passado na CLI.
- **Identidade**: pessoa e história recebem um UUID **derivado** do identificador do legado
  (UUID v5). O mesmo `id_servidor` dá sempre a mesma pessoa, e o mesmo `id_vinculo` sempre a
  mesma história.
- **Idempotência**: cada fato tem uma chave natural, independente do lote:

  | Origem | Chave natural |
  |---|---|
  | nascimento | `servidor:<id_servidor>:nascimento` |
  | abertura do vínculo | `vinculo:<id_vinculo>:abertura` |
  | encerramento do vínculo | `vinculo:<id_vinculo>:encerramento` |
  | evento | `evento:<id_evento>` |
  | linha de gabarito | `contracheque:<id_vinculo>:<competencia>:<tipo_folha>:<rubrica>` |

  Reimportar com a mesma chave e o mesmo conteúdo não grava nada. Reimportar a mesma chave com
  **conteúdo diferente** é rejeitado como conflito: o legado mudou um dado já importado, e a
  correção pede um fato de substituição, que a importação não faz. Uma chave **nova** num
  vínculo já importado (ex.: o vínculo ganhou `data_fim`) entra normalmente.

## Erros

| Situação | Efeito |
|---|---|
| arquivo ausente, cabeçalho sem coluna obrigatória, coluna desconhecida ou repetida, aspas não fechadas | **fatal**: a importação aborta antes de gravar qualquer coisa |
| linha com número errado de colunas, coluna obrigatória vazia, `amparo_tipo` sem `amparo` (ou o contrário) | linha **ilegível**: vai para o relatório e o lote segue |
| data, competência ou valor inválido; tipo de fato ou de amparo fora do catálogo; conteúdo que não passa no schema; referência a servidor/vínculo inexistente; chave repetida no lote; conflito com o já importado | registro **rejeitado**: vai para o relatório com `arquivo:linha` e motivo, e o lote segue |

Cada registro é gravado inteiro ou não é gravado (o vínculo com sua abertura e seu
encerramento, o servidor com seu nascimento).

## Uso

```sh
# schema já migrado; conexão pelas variáveis PG* do ambiente, com o papel minimus_app
export PGHOST=localhost PGPORT=5432 PGDATABASE=minimusrh PGUSER=minimus_app PGPASSWORD=...
cd packages/importador-legado
rushx importar -- --fonte csv --dir ./fixtures/lote-referencia --lote 2026-03-recorte-1
```

Código de saída: `0` importou sem rejeições; `2` importou, mas houve rejeições (ver o
relatório); `1` erro de uso ou erro fatal.

Exemplos completos em `packages/importador-legado/fixtures/`: `lote-referencia` (tudo válido) e
`lote-com-rejeicoes` (um caso de cada rejeição).
