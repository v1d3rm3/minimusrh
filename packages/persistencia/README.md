# `@minimusrh/persistencia`

O esquema Postgres da linha de fatos do MinimusRH (Playbook, Módulo 3) e as implementações
concretas dos contratos de leitura que `@minimusrh/dominio` apenas declara — em especial
`LinhaDoTempo`. É a única camada autorizada a falar com o banco.

## O que é

- **Migrações** (`migrations/bootstrap/` + `migrations/schema/`, via `node-pg-migrate`) —
  duas roles (`minimus_migracao`, `minimus_app`), as 4 tabelas (`fato`, `folha`,
  `registro_calculo`, `transicao_folha`), os índices do Roteiro §2.5.3, e as triggers
  append-only + de validação de cadeia de substituição.
- **`fato-repositorio.ts`** — `fatoRepositorioPg(pool, catalogo)`: `registrar` (única porta
  de escrita, valida `conteudo` antes do insert), `buscarPorId`, `carregarParaLinhaDoTempo`
  (sustenta `linha-do-tempo-pg.ts`) e `instantaneoAtual` (a query `DISTINCT ON` literal do
  Roteiro).
- **`linha-do-tempo-pg.ts`** — `linhaDoTempoPg(...)`: implementação de `LinhaDoTempo` via
  uma pré-carga assíncrona única + resolução em memória com `versaoVigente` do dominio
  (nunca reimplementada).
- **`folha-repositorio.ts`** — `folhaRepositorioPg(pool)`: `criar`, `buscarPorId`,
  `listarTransicoes`, e `persistirTransicao` (UPDATE + INSERT da transição + lote de
  `registro_calculo` no fechamento, tudo na mesma transação).
- **`validacao-conteudo.ts`** — `validarConteudo(catalogo, fato)`: a validação de
  `Fato.conteudo` contra `CampoSchema[]` que não existe em `dominio` (ver DECISOES #1).
- **`mapeamento-*.ts`** — conversões entre os tipos do dominio e as linhas de banco;
  `NUMERIC ⇄ Dinheiro` sempre via string (`Dinheiro.de`/`.paraString()`).

## O que NÃO é

Zero lógica de cálculo, zero decisão de negócio, zero NestJS. Não reimplementa
`versaoVigente` nem a semântica de `Folha.corte` (já decidida pelo `motor`) — só persiste o
que chega pronto.

Ambiguidades resolvidas durante a implementação estão em
[`DECISOES-IMPLEMENTACAO.md`](./DECISOES-IMPLEMENTACAO.md).

## Como rodar

A partir da raiz do monorepo (via Rush):

```sh
rush build --to @minimusrh/persistencia
```

A partir de `packages/persistencia/`:

```sh
rushx build            # tsc -p tsconfig.json → dist/
rushx typecheck         # tsc -p tsconfig.typecheck.json (inclui os *.test.ts)
rushx test               # vitest run — unitários + integração (Testcontainers, requer Docker)
rushx test:watch         # vitest em modo watch
rushx test:coverage     # vitest run --coverage (100% em todo módulo com lógica)
```

Os testes `*.integracao.test.ts` sobem um Postgres efêmero via Testcontainers
(`@testcontainers/postgresql`) — **exigem um daemon Docker rodando** na máquina que roda
`rushx test`. Os testes unitários (`validacao-conteudo.test.ts`, `mapeamento-*.test.ts`,
`arquitetura.test.ts`) não precisam de Docker.
