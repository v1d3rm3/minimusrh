# `@minimusrh/dominio`

O vocabulário puro do MinimusRH: tipos, value objects e contratos que fundamentam o sistema
de folha de pagamento — **fatos imutáveis bitemporais** (data de efeito + data de registro),
**estado sempre derivado** e **tudo que participa do cálculo é versionado**.

## O que é

- Value objects com invariante (`Dinheiro`, `Percentual`, `Competencia`, `Amparo`) — aritmética
  decimal exata via `decimal.js`, nunca `number`.
- Datas como strings branded (`DataEfeito`, `DataRegistro`) — sem `Date`, sem fuso-horário, sem
  relógio.
- A função única de resolução temporal bitemporal (`versaoVigente`) compartilhada por regras,
  rubricas e os catálogos.
- Os contratos que o `motor` e a `persistencia` implementam (`LinhaDoTempo`, `Contexto`,
  `Derivacao`, `VersaoRegra`, catálogos).
- Os tipos de registro imutável que atravessam fronteiras (`Fato`, `Folha`, `RegistroCalculo`).

Detalhes de design e a justificativa de cada tipo estão em
`docs/MinimusRH_Design_Dominio.md`; ambiguidades resolvidas durante a implementação estão em
[`DECISOES-IMPLEMENTACAO.md`](./DECISOES-IMPLEMENTACAO.md).

## O que NÃO é

Zero framework, zero I/O, zero relógio. Não tem: grafo de execução (`motor`), persistência,
regras concretas da ALRN, API, telas. Não importa `@nestjs/*`, `pg`, nem qualquer coisa que
não seja `decimal.js`.

## Como rodar

A partir da raiz do monorepo (via Rush — nunca `pnpm` direto):

```sh
rush build --to @minimusrh/dominio     # tsc
rushx test                              # a partir de packages/dominio: vitest run
```

A partir de `packages/dominio/`:

```sh
rushx build           # tsc -p tsconfig.json → dist/
rushx typecheck        # tsc -p tsconfig.typecheck.json (inclui os *.test.ts, sem emitir)
rushx test              # vitest run
rushx test:watch        # vitest em modo watch
rushx test:coverage    # vitest run --coverage (100% nos módulos com lógica)
```

`typecheck` existe separado de `build` porque `tsconfig.json` exclui os arquivos de teste do
build (para não poluir `dist/`) — sem ele, os testes de tipo (`@ts-expect-error` provando que
brands como `DataEfeito`/`DataRegistro` não são intercambiáveis) nunca seriam verificados.

## Regras que o código aqui dentro impõe

1. `Dinheiro` só nasce de `Dinheiro.de(string)` ou `Dinheiro.deCentavos(bigint)` — nunca de
   `number`. `src/arquitetura.test.ts` falha a suíte se `parseFloat`, `Number(`,
   `new Date()`, `Date.now` ou `@nestjs` aparecerem em qualquer arquivo de `src/`.
2. Arredondamento de `Dinheiro` é sempre explícito (`.arredondar(politica)`) — nada arredonda
   no meio de uma conta.
3. `DataEfeito` e `DataRegistro` são brands diferentes; o compilador recusa trocar uma pela
   outra (veja `src/tipos.test.ts`).
4. `TRANSICOES` da folha (`src/folha.ts`) é uma tabela de dados exaustiva — `fechada` e
   `cancelada` não transitam para nenhum estado.
