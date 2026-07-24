# Instrução para Claude Code — Implementar o pacote `dominio` do MinimusRH

## Papel e contexto

Você vai implementar o **pacote `dominio`** do MinimusRH, um sistema de folha de pagamento configurável para o setor público brasileiro, cuja fundação é: **fatos imutáveis bitemporais** (data de efeito + data de registro), **estado sempre derivado** (nunca armazenado como verdade primária) e **tudo que participa do cálculo é versionado** (regras, rubricas, tipos de fato, tipos de amparo, derivações).

Este pacote é o vocabulário puro do sistema: tipos, value objects e contratos. **Zero framework. Zero I/O. Zero relógio.**

## Documentos de referência (leia NESTA ordem antes de escrever qualquer código)

1. `docs/MinimusRH_Design_Dominio.md` — **a fonte da verdade deste trabalho.** Contém o TypeScript anotado de cada módulo, os critérios de design (§0.1: interface vs. classe) e as decisões numeradas (§11). Em conflito entre esta instrução e o design doc, **o design doc vence** — e você deve apontar o conflito em `DECISOES-IMPLEMENTACAO.md`.
2. `docs/MinimusRH_Fundacao_e_Modelo_v2.md` — o modelo conceitual (v2.9). Consulte quando precisar entender o *porquê* de um tipo (as anotações `§N` no design doc apontam para cá).
3. `docs/MinimusRH_Roteiro_MVP.md` — contexto de onde este pacote se encaixa (§2.5: stack e layout Rush).

Se os documentos não estiverem no repositório, **pare e peça-os** antes de prosseguir.

## Escopo

**Implementar:** o pacote `packages/dominio` completo, com testes.

**NÃO implementar (nem esboçar):** motor, persistência, regras concretas da ALRN, API NestJS, qualquer tela, qualquer acesso a banco. Se durante a implementação parecer necessário algo dessas camadas, é sinal de erro de fronteira — registre em `DECISOES-IMPLEMENTACAO.md` e mantenha o domínio puro.

## Estrutura esperada

```
packages/dominio/
  src/
    brand.ts                 # Brand<T,B> e todos os IDs/chaves branded
    dinheiro.ts              # Dinheiro, Percentual, PoliticaArredondamento
    tempo.ts                 # DataEfeito, DataRegistro, Competencia
    vigencia.ts              # ComVigencia, versaoVigente
    catalogo.ts              # Catalogo<Chave,T> genérico + aliases dos seis catálogos
    fato.ts                  # Fato, AlvoFato, Autor
    amparo.ts                # Amparo (classe), ErroValidacao
    normalizacao-amparo.ts   # normalizarAmparo (interpretador puro)
    catalogo-amparos.ts      # TipoAmparo, VersaoTipoAmparo, GrupoMascara, TipoGrupo
    catalogo-fatos.ts        # TipoFato, VersaoTipoFato, CampoSchema, TipoCampo
    linha-do-tempo.ts        # LinhaDoTempo (interface)
    derivacao.ts             # Derivacao, VersaoDerivacao, RegistroDeDerivacoes
    rubrica.ts               # Rubrica, VersaoRubrica, NaturezaRubrica
    contexto.ts              # Contexto, ConsultaJanela
    regra.ts                 # VersaoRegra, DeclaracaoConsumo, EscopoRegra
    folha.ts                 # Folha, EstadoFolha, TRANSICOES, TransicaoFolha
    registro-calculo.ts      # RegistroCalculo, NoExplicacao, FonteExplicacao
    index.ts                 # exports públicos
  test/                      # espelhando src/ (dinheiro.test.ts, vigencia.test.ts, ...)
  package.json
  tsconfig.json
```

Se o monorepo Rush ainda não existir, crie o mínimo necessário (`rush.json` + este pacote registrado). Se já existir, apenas adicione o pacote. Ferramentas: **TypeScript em modo `strict` total** (incluindo `noUncheckedIndexedAccess`), **Vitest** para testes, ESLint. Única dependência de runtime permitida: **`decimal.js`**.

## Regras inegociáveis (violar qualquer uma = trabalho recusado)

1. **`number` jamais representa dinheiro.** `Dinheiro` tem construtor privado; entradas só por `Dinheiro.de(string)` e `Dinheiro.deCentavos(bigint)`; nenhum método público devolve `number` (apenas `paraString()`). Adicione regra de ESLint (ou teste de arquitetura) que falhe se `parseFloat`/`Number(` aparecer em `src/`.
2. **Nenhum `new Date()` sem argumento, nenhum `Date.now()`.** O domínio não conhece o relógio. Datas são strings branded (`YYYY-MM-DD` para efeito; ISO timestamp para registro), validadas nas factories.
3. **`DataEfeito` e `DataRegistro` são brands diferentes** — o compilador deve recusar a troca de uma pela outra.
4. **Fatos e demais registros são `readonly` profundos.** Nenhum setter, nenhuma mutação.
5. **Nenhum import de `@nestjs/*`, `pg`, ou qualquer framework.** Só `decimal.js` e o próprio pacote.
6. **Aritmética de `Dinheiro` não arredonda implicitamente.** Arredondamento só via `arredondar(politica)` explícito.
7. **`TRANSICOES` da folha é dado exaustivo**, com `fechada: []` e `cancelada: []` — sem métodos de transição, sem exceções à máquina.
8. **Interface vs. classe segue o §0.1 do design doc** — não converta interfaces em classes "para ficar mais OO", nem o contrário.
9. **Comentários de rastreabilidade:** mantenha as anotações `§N` do design doc nos tipos correspondentes (elas ligam código ao conceitual).

## Especificações críticas (resumo normativo — o detalhe está no design doc)

- **`versaoVigente<V extends ComVigencia>(versoes, em, corte)`** — a função de resolução temporal ÚNICA do sistema: entre as versões com `dataRegistro <= corte`, a de maior `dataEfeito <= em`, respeitando `dataFimEfeito` quando presente. Empate de `dataEfeito`: vence a de maior `dataRegistro`. Retorna `undefined` se nada vige.
- **`normalizarAmparo(versao, entrada)`** — interpretador puro da especificação declarativa: compila `mascara` (string-fonte), aplica sobre `entrada.trim()`, canonicaliza grupo a grupo por `TipoGrupo` (`numero` ⇒ sem zeros à esquerda; `ano` ⇒ exige 4 dígitos; `texto` ⇒ trim + caixa alta), injeta em `formatoCanonico`. Falha ⇒ `ErroValidacao` citando `exemplo`.
- **`Amparo`** — classe com duas factories: `criar()` (valida via `versaoVigente` + `normalizarAmparo`; identidade canônica = `${tipo}:${canonica}`) e `legado()` (aceita sem validar, preserva `comoInformado`, `validadoContraVersao` ausente). `mesmoDocumentoQue()` compara tipo + canônica.
- **`Competencia`** — factory validada (mês 1–12); `anterior()`, `ultimas(n)` (da mais antiga à mais recente, incluindo a corrente), `dataReferencia()` (último dia do mês), `contem(dataEfeito)`, `igual()`, `toString()` = `'YYYY-MM'`.
- **`Dinheiro`** — operações do design doc; comparações; imutável (toda operação devolve nova instância); `paraString()` com 2 casas para o `NUMERIC` do Postgres.
- **Todas as interfaces `VersaoDeX` estendem `ComVigencia`** (têm `dataEfeito` E `dataRegistro`).

## Estratégia de testes (test-first onde indicado)

Escreva os testes **antes** da implementação para os módulos de maior risco, nesta ordem: `dinheiro`, `vigencia`, `tempo`, `normalizacao-amparo`, `folha`. Testes obrigatórios:

1. **O teste-documento do float** (`dinheiro.test.ts`): demonstre que `Dinheiro.de('0.10').somar(Dinheiro.de('0.20'))` é exatamente `'0.30'`, com comentário explicando por que `number` é proibido. Some 10.000 parcelas de `'0.01'` e exija exatamente `'100.00'`.
2. **Arredondamento**: `meio_para_cima`, `truncar` e `banqueiro` sobre casos de borda (`'2.005'`, `'2.675'`, negativos).
3. **`versaoVigente` bitemporal** — o teste mais importante do pacote. Monte o cenário do conceitual: versão A (efeito jan, registro jan) e versão B (efeito mar, registro JUL — publicada retroativamente). Verifique: (a) consulta para abril com corte de maio ⇒ A ("como foi pago"); (b) consulta para abril com corte de agosto ⇒ B ("como deveria ser"); (c) `dataFimEfeito` respeitado; (d) lista vazia / nada vigente ⇒ `undefined`; (e) desempate por `dataRegistro`.
4. **`TRANSICOES` exaustivo**: teste linha a linha, incluindo explicitamente que de `fechada` não se sai para NENHUM estado.
5. **`normalizarAmparo`**: `'0045/2026'` e `'45/2026'` ⇒ mesma canônica; entrada fora da máscara ⇒ `ErroValidacao` com o exemplo na mensagem; canonicalização de cada `TipoGrupo`.
6. **`Amparo`**: `criar` resolve a versão vigente correta quando há duas versões de máscara; `legado` preserva o original e não valida; `mesmoDocumentoQue` agrupa grafias diferentes do mesmo processo.
7. **`Competencia`**: virada de ano em `anterior()`; `ultimas(12)` cruzando anos; `dataReferencia()` em fevereiro bissexto e não-bissexto.
8. **Brands**: um teste de tipo (com `@ts-expect-error`) provando que `DataEfeito` não entra onde vai `DataRegistro`, e que `HistoriaId` não entra onde vai `PessoaId`.

Meta: 100% de cobertura nos módulos com lógica (`dinheiro`, `tempo`, `vigencia`, `normalizacao-amparo`, `amparo`, `folha`); módulos só-de-tipos não contam para cobertura.

## Processo de trabalho

1. Leia os três documentos na ordem indicada. Só então comece.
2. Implemente na ordem: `brand` → `tempo` → `dinheiro` → `vigencia` → `catalogo` → `fato`/`catalogo-fatos` → `catalogo-amparos`/`normalizacao-amparo`/`amparo` → `linha-do-tempo`/`derivacao` → `rubrica` → `contexto` → `regra` → `folha` → `registro-calculo` → `index`.
3. **Rode `vitest` e o build TypeScript após cada módulo** — nunca acumule vermelho.
4. Ao final: build limpo, testes verdes, lint verde, e um `README.md` curto no pacote (o que é, o que não é, como rodar os testes).
5. **Ambiguidade ou lacuna no design doc:** NÃO invente silenciosamente. Tome a decisão mais conservadora, implemente, e registre em `packages/dominio/DECISOES-IMPLEMENTACAO.md` no formato: *contexto → opções consideradas → decisão → por quê*. Esse arquivo será revisado por humano.

## Critérios de aceite (verifique você mesmo antes de declarar concluído)

- [ ] `tsc --noEmit` sem erros, `strict` total
- [ ] Todos os testes passando; cobertura 100% nos módulos com lógica
- [ ] Grep de `parseFloat|Number\(|new Date\(\)|Date.now|@nestjs` em `src/` retorna vazio
- [ ] Nenhuma dependência de runtime além de `decimal.js`
- [ ] Todos os tipos do design doc §1–§9 existem e exportados em `index.ts`
- [ ] Anotações `§N` preservadas nos comentários
- [ ] `DECISOES-IMPLEMENTACAO.md` existe (mesmo que diga "nenhuma ambiguidade encontrada")
- [ ] `README.md` do pacote escrito
