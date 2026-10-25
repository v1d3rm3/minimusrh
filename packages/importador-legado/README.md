# `@minimusrh/importador-legado`

A CLI que traduz dados do sistema legado em fatos bitemporais (Playbook, Módulo 7 — Roteiro
Marco 3, peça 1). O legado guarda **estado**. O importador transforma esse estado em fatos com
data de efeito e data de registro, aplica **convenções explícitas** onde o legado não sabe
(nunca inventa datas "plausíveis") e importa os contracheques do legado como **gabarito**, o
material de comparação do harness (Módulo 8).

## O que é

- **`registros.ts`**: o contrato `FonteLegado`, que itera registros crus tipados (servidores,
  vínculos, eventos funcionais, contracheques), mais `RegistroIlegivel` para linhas que a fonte
  não conseguiu estruturar.
- **`fonte-csv.ts`** + **`csv.ts`**: `fonteCsv(dir)`, a fonte de referência, com o layout
  documentado em [`docs/layout-importacao.md`](../../docs/layout-importacao.md).
- **`tradutores.ts`**: `traduzir(ctx, registro)` → `UnidadeImportacao | Rejeicao`. Funções
  puras. O conteúdo é validado contra o catálogo **antes** de gravar, e o amparo entra pela porta
  `Amparo.legado()`.
- **`convencoes.ts`**: `CONVENCAO_REGISTRO_DESCONHECIDO` (`data_registro := data_efeito`, à
  00:00:00Z) e o autor `{ tipo: 'importacao', lote }`.
- **`identidade.ts`**: UUID v5 da pessoa e da história, derivados do identificador do legado.
- **`destino-pg.ts`**: grava cada unidade numa transação (fatos pela porta única
  `fatoRepositorioPg.registrar` + identidade ou gabarito). Idempotente por chave natural, e um
  conflito não grava nada.
- **`importar.ts`**: o pipeline. Lê a fonte inteira, ordena por dependência, traduz, confere as
  referências, grava e acumula o relatório.
- **`relatorio.ts`**: totais, rejeições com `arquivo:linha` e motivo, e amostra de fatos gerados
  por tipo.
- **`vinculos-importados.ts`**: `listarVinculosImportados(pool)`, os pares pessoa↔história
  importados (para o `CadastroDeHistorias` do harness).
- **`cli.ts`** + **`bin/importar.ts`**: `importar --fonte csv --dir <diretório> --lote <id>`.

As tabelas (`servidor_legado`, `vinculo_legado`, `fato_importado`, `gabarito_legado`) são
criadas pelas migrações de `persistencia` (DECISOES #11 de lá).

## Rodando

- `rushx test`: unitários e integração. A integração usa Testcontainers e exige Docker.
- `rushx importar -- --fonte csv --dir <diretório> --lote <id>`: exige `rush build`, um Postgres
  com o schema migrado e as variáveis `PG*` (papel `minimus_app`). Saída `0` sem rejeições,
  `2` com rejeições, `1` erro de uso ou fatal.

Lotes de exemplo em `fixtures/`: `lote-referencia` (tudo válido, inclui o Victor) e
`lote-com-rejeicoes` (um caso de cada rejeição).

## O que NÃO é

Não compara nada: o batimento contra o gabarito é o harness (Módulo 8), e é lá que mora o
mapeamento de rubricas legado⇄MinimusRH. Não corrige dado já importado: um conflito é
rejeitado, porque corrigir pede um fato de substituição. Não roda migrações. Decisões e
convenções estão em `DECISOES-IMPLEMENTACAO.md`.
