# CLAUDE.md

Este arquivo fornece orientações ao Claude Code (claude.ai/code) para trabalhar com código neste repositório.

## Estado do repositório

Este é um **monorepo Rush.js** recém-criado (rushVersion 5.177.2, PNPM 9.15.9, PNPM workspaces habilitado). Ainda não há código de aplicação:
- `apps/` está vazio.
- `packages/dominio` é um diretório placeholder vazio (sem `package.json`).
- O array `projects` em `rush.json` é inteiramente conteúdo de template comentado — nenhum projeto está registrado no Rush ainda.

Ao adicionar o primeiro projeto real, ele precisa ser tanto (a) uma pasta real com `package.json` dentro de `apps/` ou `packages/`, quanto (b) registrado no array `projects` de `rush.json` com os campos `packageName` e `projectFolder` correspondentes — o Rush não detecta a pasta de um projeto automaticamente.

## Ferramental / ambiente

- A versão do Node é fixada via `mise.toml` (24.18.0) e restringida pelo `nodeSupportedVersionRange` do `rush.json` (`>=24.11.1 <25.0.0`).
- O gerenciador de pacotes é o PNPM, instalado e com versão fixada pelo próprio Rush (não via corepack/instalação global) — sempre invoque o gerenciamento de pacotes através de `rush`/`rushx`, não do `pnpm` puro.
- Subspaces do Rush estão desabilitados (`common/config/rush/subspaces.json`); existe um único workspace padrão.
- O cache de build está desabilitado (`buildCacheEnabled: false`, provedor `local-only`) em `common/config/rush/build-cache.json`.
- Nenhuma política de versão está definida (`common/config/rush/version-policies.json` está vazio) e nenhum comando/parâmetro customizado do Rush existe ainda (`common/config/rush/command-line.json` está vazio).

## Comandos comuns

Bootstrap / instalar dependências do monorepo inteiro:
- `node common/scripts/install-run-rush.js install` — instala com base no lockfile commitado (usado no CI).
- `rush update` — instala e atualiza o lockfile após mudanças em `package.json` (uma vez que o Rush esteja instalado globalmente, ou use o shim `install-run-rush.js` acima).

Build:
- `rush build` — build incremental de todos os projetos.
- `rush rebuild` — rebuild completo de todos os projetos (o CI roda `rush rebuild --verbose --production`).
- `rushx <script>` — roda um script do próprio `package.json` de um projeto, a partir da pasta desse projeto.
- `rush <comando> --to <projeto>` / `--from <projeto>` — restringe um build/rebuild a um projeto e suas dependências/dependentes.

Changelogs:
- `rush change` — gera um change file descrevendo uma mudança para versionamento (necessário antes do merge caso políticas de versão sejam adicionadas no futuro).
- `rush change --verify` — verificado no CI; confirma que os change files existem/estão consistentes.

Observação: como ainda não existem projetos, os comandos `rush build`/`rush rebuild`/lint/test atualmente não têm nada sobre o que operar — eles passam a fazer sentido assim que projetos reais em `apps/`/`packages/` forem adicionados e registrados.

## CI

`.github/workflows/ci.yml` roda em push/PR para `main`: `rush change --verify` → `rush install` → `rush rebuild --verbose --production`. Nota: o workflow fixa `actions/setup-node@v3` em **Node 16**, o que conflita com o `nodeSupportedVersionRange` (`>=24.11.1 <25.0.0`) do `rush.json` — vale a pena reconciliar isso caso o CI comece a falhar na verificação de versão do Node.
