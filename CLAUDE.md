# CLAUDE.md

Este arquivo fornece orientações ao Claude Code (claude.ai/code) para trabalhar com código neste repositório.

## Estado do repositório

Monorepo **Rush.js** (rushVersion 5.177.2, PNPM 9.15.9, PNPM workspaces habilitado) do MinimusRH, um motor de folha de pagamento. A implementação segue o playbook `docs/MinimusRH_Playbook_Implementacao.md`: **uma sessão por módulo, na ordem, com um portão de revisão humana entre os módulos**.

Módulos concluídos (todos em `packages/` e registrados em `rush.json`):

| # | Pacote | Depende de |
|---|---|---|
| 1 | `@minimusrh/dominio` | `decimal.js` |
| 2 | `@minimusrh/motor` | dominio |
| 3 | `@minimusrh/persistencia` | dominio, `pg`, `node-pg-migrate` |
| 4 | `@minimusrh/regras-alrn` | dominio (somente) |
| 5 | `@minimusrh/app-folha` | dominio, motor, persistencia, regras-alrn, `pg` |

O **Módulo 6, retroatividade (Marco 2, o "teste de fogo")**, está implementado no `app-folha` (`apurar-diferencas.ts`, `alcance-retroativo.ts`, `rushx demo:retroativo`) e passou no portão humano em 24/10/2026 (data registrada no README). O próximo é o Módulo 7 (`importador-legado`). Consulte o playbook para saber o escopo e o portão humano de cada módulo.

O **golden test de reprodutibilidade** (`packages/app-folha/src/golden-reprodutibilidade.integracao.test.ts`, arquivo de referência em `packages/app-folha/golden/`) é o teste mais importante do repositório. Nunca o desligue nem o regrave só "para passar". A regravação consciente é feita com `ATUALIZAR_GOLDEN=1 rushx test`. `apps/` continua vazio; a `api` (NestJS) só entra no Módulo 11.

Documentação de referência em `docs/` (Fundação e Modelo, Design do Domínio, Roteiro do MVP, Playbook). Cada pacote tem um `DECISOES-IMPLEMENTACAO.md` que registra as lacunas do design e as decisões tomadas. Leia o do pacote antes de alterá-lo.

Para adicionar um projeto novo, ele precisa ser tanto (a) uma pasta real com `package.json` dentro de `apps/` ou `packages/`, quanto (b) registrado no array `projects` de `rush.json` com `packageName` e `projectFolder`. O Rush não detecta pastas automaticamente.

## Regras globais do projeto

As regras inegociáveis (dinheiro nunca é `number`, sem relógio fora da `api`, fatos append-only, grafo de imports restrito, decisões registradas em `DECISOES-IMPLEMENTACAO.md`) ficam na seção "Regras globais" do playbook. Elas valem para todo pacote.

## Ferramental / ambiente

- A versão do Node é fixada via `mise.toml` (24.18.0) e restringida pelo `nodeSupportedVersionRange` do `rush.json` (`>=24.11.1 <25.0.0`).
- O gerenciador de pacotes é o PNPM, instalado e com versão fixada pelo próprio Rush (não via corepack/instalação global). Sempre gerencie pacotes através de `rush`/`rushx`, não do `pnpm` puro.
- Cada pacote usa TypeScript (`tsc`) e Vitest, com o mesmo conjunto de scripts: `build`, `typecheck`, `test`, `test:watch` e `test:coverage`. A cobertura exige 100% nos módulos com lógica.
- Os testes de integração de `persistencia` e `app-folha` (`*.integracao.test.ts`) sobem Postgres via **Testcontainers** e exigem Docker disponível.
- Subspaces do Rush estão desabilitados, o cache de build está desabilitado (`buildCacheEnabled: false`) e não há política de versão definida.
- `rush test` é um comando bulk customizado (`common/config/rush/command-line.json`) que roda o script `test` de cada projeto. Ele não faz build antes, então rode `rush build` primeiro.

## Comandos comuns

- `rush install`: instala as dependências com base no lockfile commitado.
- `rush update`: instala e atualiza o lockfile após mudanças em `package.json`.
- `rush build` / `rush rebuild`: build incremental / completo de todos os projetos.
- `rush build --to <projeto>` / `--from <projeto>`: restringe o build a um projeto e suas dependências / dependentes.
- `rush build && rush test`: verificação completa do repositório (critério de aceite de cada módulo).
- Dentro da pasta de um pacote: `rushx test`, `rushx test:coverage`, `rushx typecheck`.
- `rushx demo:victor` (em `packages/app-folha`, exige build e Docker): fecha a folha 07/2026 do Victor e imprime o contracheque com o extrato de cálculo.
- `rushx demo:retroativo` (em `packages/app-folha`, exige build e Docker): fecha 01–07/2026, registra a promoção retroativa do Victor e imprime a tabela de diferenças apuradas.

## CI

Não há workflow ativo: `.github/workflows/` está vazio, porque o CI foi removido no commit `3519125`. O playbook pede que o golden test rode no CI para sempre, então será preciso recriar o workflow. Ao recriá-lo, use Node 24, compatível com o `nodeSupportedVersionRange`.
