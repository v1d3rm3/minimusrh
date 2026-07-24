# `@minimusrh/motor`

O núcleo de execução do MinimusRH (Playbook, Módulo 2): monta o grafo de dependências entre
rubricas, resolve as versões vigentes de regras/rubricas para uma competência, implementa o
`Contexto` que as regras enxergam, e calcula uma folha — tudo em funções **puras**, sobre os
contratos definidos em `@minimusrh/dominio`.

## O que é

- **`grafo.ts`** — `montarGrafo(regras, rubricas)`: ordena a execução das regras pela
  ordem de dependência entre as rubricas que produzem (Fundacao §5.1), detectando ciclos
  (diretos e via classificação) antes de qualquer cálculo rodar.
- **`resolucao.ts`** — `resolverParaExecucao(...)`: para uma `(competencia, tipoFolha,
  corte)`, resolve as versões vigentes de regras e rubricas via `versaoVigente` do dominio —
  a única fonte de semântica temporal do sistema.
- **`contexto-impl.ts`** — `criarContexto(...)`: a implementação real de `Contexto` (as
  quatro portas do Design §6), sobre `LinhaDoTempo`, `RegistroDeDerivacoes` e os valores já
  calculados na execução corrente.
- **`contexto-instrumentado.ts`** — `instrumentar(ctx)`: decorator que registra toda
  leitura; usado por `calcular-folha.ts` para montar a árvore de explicação, e pelos testes
  de regras concretas (Módulo 4+) para fiscalizar se a `DeclaracaoConsumo` de uma regra
  mente.
- **`calcular-folha.ts`** — `calcularFolha(entrada)`: a função central, pura — recebe as
  histórias participantes e os catálogos, devolve `RegistroCalculo[]` com árvore de
  explicação, quais regras não se aplicaram, e quais erros ocorreram (ciclo ou exceção de
  regra).
- **`ciclo-folha.ts`** — `transitar(folha, para, autor, instante, amparo?)`: valida contra
  `TRANSICOES` do dominio e devolve a folha + o registro de transição; não persiste nada.

## O que NÃO é

Zero banco, zero NestJS, zero regras concretas, zero relógio (todas as datas chegam de
fora). Não implementa o `LeitorDeJanelas` real (fica para o Módulo 5, sobre folhas
FECHADAS) nem retroatividade (Módulo 6 — que reaproveita `calcularFolha` duas vezes e faz
uma subtração, sem lógica nova).

Ambiguidades resolvidas durante a implementação estão em
[`DECISOES-IMPLEMENTACAO.md`](./DECISOES-IMPLEMENTACAO.md).

## Como rodar

A partir da raiz do monorepo (via Rush):

```sh
rush build --to @minimusrh/motor
```

A partir de `packages/motor/`:

```sh
rushx build            # tsc -p tsconfig.json → dist/
rushx typecheck         # tsc -p tsconfig.typecheck.json (inclui os *.test.ts)
rushx test               # vitest run
rushx test:watch         # vitest em modo watch
rushx test:coverage     # vitest run --coverage (100% em todo módulo com lógica)
```
