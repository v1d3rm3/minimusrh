# `@minimusrh/app-folha`

O serviço de aplicação da folha (Playbook, Módulo 5 — Roteiro Marco 1, "O Victor recebe"):
costura `motor`, `persistencia` e `regras-alrn` no primeiro fluxo completo, **abrir →
simular → travar corte → fechar → reproduzir**, em funções puras de orquestração, sem
NestJS e sem relógio (todo instante chega do chamador).

## O que é

- **`servico-folha.ts`**: `criarServicoFolha({pool, configuracao, cadastro})`.
  - `abrir(competencia, tipo)`;
  - `calcularSimulacao(folhaId, corteProvisorio)`: só em folha aberta, nunca persiste, e o
    resultado vem marcado como simulação, com o corte usado;
  - `travarCorte(folhaId, corte, autor)`: aberta → em conferência;
  - `fechar(folhaId, autor, instante)`: recalcula com o corte travado e grava registros,
    transição e selo numa única transação. Recusa fechar se o cálculo tiver erros;
  - `reproduzir(folhaId)`: recalcula do zero uma folha fechada, com o mesmo corte e o mesmo
    selo, sem persistir.

  As transições passam por `motor::transitar`.
- **`leitor-janelas-pg.ts`**: `LeitorDeJanelas` real sobre `registro_calculo` de folhas
  **fechadas** até o corte (Fundação §7.3). Faz uma pré-carga e responde em memória, e
  devolve as `folhasConsumidas` para o selo.
- **`configuracao.ts`**: `ConfiguracaoInstituicao` (os catálogos como dado),
  `configuracaoAlrn()` e a porta `CadastroDeHistorias`.
- **`extrato.ts`**: árvore `NoExplicacao` em texto indentado (`renderizarExtrato`) e
  contracheque com extrato (`renderizarContracheque`).
- **`serializacao.ts`**: forma canônica de um resultado, usada pelo golden test.

## O golden test

`src/golden-reprodutibilidade.integracao.test.ts` é **o teste mais importante do
repositório**. Ele semeia o Victor, fecha a folha mensal 07/2026 e prova duas coisas: o
persistido é igual ao recálculo do zero, byte a byte; e o resultado é igual a
`golden/victor-2026-07-mensal.json`. Para regravar o golden **de propósito**, depois de
entender a diferença: `ATUALIZAR_GOLDEN=1 rushx test`.

## Rodando

- `rushx test`: unitários e integração. A integração usa Testcontainers e exige Docker.
- `rushx demo:victor`: exige `rush build` e Docker. Roda o fluxo num Postgres efêmero e
  imprime o contracheque do Victor com o extrato de cálculo.

## O que NÃO é

Não é API: o NestJS é o Módulo 11 e hospedará este serviço sem que ele saiba. Não faz
retroatividade: a diferença entre duas leituras do tempo é o Módulo 6. Não cobre
consolidação entre folhas além da leitura de janela: dependências fechadas e teto
incremental ficam para o Módulo 12. Decisões e lacunas estão em `DECISOES-IMPLEMENTACAO.md`.
