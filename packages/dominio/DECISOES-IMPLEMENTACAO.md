# Decisões de implementação — pacote `dominio`

Registro das ambiguidades e lacunas encontradas entre `PROMPT_Claude_Code_Dominio.md` e
`docs/MinimusRH_Design_Dominio.md` durante a implementação, no formato pedido pelo prompt:
*contexto → opções consideradas → decisão → por quê*. Revisão humana pendente.

---

## 1. Layout de arquivos diverge da "Estrutura esperada" do PROMPT

**Contexto:** o pacote já tinha dois commits anteriores quando este trabalho começou, com
`competencia.ts` (em vez de `tempo.ts`), `percentual.ts` separado de `dinheiro.ts`, e
`tipos.ts` fazendo o papel de `brand.ts`. A seção "Estrutura esperada" do PROMPT lista nomes
de arquivo diferentes.

**Opções consideradas:**
(a) renomear/fundir para bater literalmente com a estrutura do PROMPT, tocando imports em
~20 arquivos; (b) manter o layout já commitado e documentar o desvio.

**Decisão:** (b) — mantido o layout atual. Perguntado diretamente ao usuário, que confirmou
a preferência por não gerar esse churn em código já testado e funcionando.

**Por quê:** as "regras inegociáveis" (1–9) do PROMPT não mencionam nomes de arquivo — só a
lista de tipos que precisam existir e ser exportados por `index.ts`, o que está satisfeito
independente do nome do arquivo físico. O custo de renomear (revisão de ~20 imports, diff
grande sem mudança de comportamento) supera o benefício de fidelidade literal ao nome do
arquivo.

---

## 2. Ordem de `Competencia.ultimas(n)`

**Contexto:** a implementação herdada (e o teste que a acompanhava) devolvia as competências
da mais nova para a mais velha. O design doc (`§1.3`) não especifica a ordem
(`/* ... */`), mas o PROMPT explicita: *"ultimas(n) (da mais antiga à mais recente, incluindo
a corrente)"*.

**Decisão:** invertida a ordem para mais-antiga → mais-nova, e o teste correspondente
atualizado.

**Por quê:** regra de precedência do próprio PROMPT — só o design doc tem precedência sobre
o PROMPT quando **conflitam**; aqui o design doc é omisso, não conflitante, então a instrução
explícita do PROMPT vale.

---

## 3. Fábricas `dataEfeito()` / `dataRegistro()` (validação)

**Contexto:** o design doc mostra as assinaturas `dataEfeito = (iso) => valida(iso) as
DataEfeito` sem definir `valida`. A regra inegociável #2 exige que toda data seja "validada
nas factories".

**Decisão:** `dataEfeito()` valida formato `YYYY-MM-DD` por regex e depois o calendário real
(mês 1–12, dia dentro do número de dias do mês, incluindo bissexto) reaproveitando o
`diasNoMes` já usado por `Competencia`. `dataRegistro()` valida formato ISO 8601 por regex e,
adicionalmente, invalida timestamps que o parser de datas do JS não consegue interpretar
(`new Date(iso)` com argumento — permitido pela regra #2, que só proíbe `new Date()` sem
argumento e `Date.now()`).

**Por quê:** sem essa validação de calendário, `dataEfeito('2026-02-30')` produziria uma
`DataEfeito` sintaticamente válida mas semanticamente impossível, quebrando silenciosamente
comparações lexicográficas em `versaoVigente`.

---

## 4. Parsing de dígitos sem `Number(...)` / `parseFloat`

**Contexto:** o critério de aceite exige `grep` vazio para `parseFloat|Number\(|new
Date\(\)|Date.now|@nestjs` em todo `src/` — não só nos arquivos que lidam com dinheiro.
Validar data exige converter strings de dígitos (`'2026'`, `'02'`) para número.

**Decisão:** usado `parseInt(str, 10)`, que não está na lista proibida, no lugar de
`Number(...)`.

**Por quê:** `parseInt` não é o vetor do bug que a regra combate (perda de precisão decimal
em dinheiro); é o utilitário padrão para converter dígitos de calendário, já validados por
regex antes da conversão (então não há ambiguidade de base/formato).

---

## 5. Teste de arquitetura em vez de regra de ESLint

**Contexto:** a regra inegociável #1 pede "regra de ESLint (ou teste de arquitetura)" para
barrar `parseFloat`/`Number(`/`new Date()`/`Date.now` em `src/`. O monorepo Rush ainda não
tem ESLint configurado em lugar nenhum (nem no root, nem em outro pacote de referência).

**Decisão:** implementado como teste de arquitetura (`src/arquitetura.test.ts`), rodado a
cada `vitest run`, que varre todo `.ts` em `src/` (exceto ele mesmo) atrás dos termos
proibidos.

**Por quê:** o PROMPT permite explicitamente essa alternativa; configurar ESLint do zero no
monorepo (flat config, integração com `rush build`/`command-line.json`) é trabalho de
tooling fora do escopo deste pacote e melhor tratado como decisão própria do time, não
inventada aqui.

---

## 6. Escopo de `catalogo.ts`: só `CatalogoTiposDeFato`, `CatalogoRubricas`, `CatalogoAmparos`

**Contexto:** o design doc (`§1.4`) mostra esses três aliases e termina com "// ... e os
demais, na mesma forma". O conceitual (`§9.1`) fala em "cinco catálogos": tipos de fato,
classificações de rubrica, **tipos de folha**, papéis do RBAC e chaves de derivação — mas em
nenhum lugar do design doc existe uma interface `VersaoTipoFolha`/`TipoFolha` no molde
`{ chave, versoes }`.

**Decisão:** implementados apenas os três catálogos com forma explícita no design doc.
`RegistroDeDerivacoes` (derivações) já cobre o catálogo de chaves de derivação com um
contrato próprio (não o genérico `Catalogo<K,T>`). RBAC é explicitamente fora do pacote
`dominio` (não é vocabulário do domínio de folha). `TipoFolhaChave` existe como brand
(`tipos.ts`) e é usado onde necessário (`Folha.tipo`, `VersaoRegra.aplicaSeAFolhas`, etc.),
mas sem uma entidade de catálogo — porque o design doc nunca definiu sua forma.

**Por quê:** inventar `VersaoTipoFolha` sem nenhuma pista do design doc sobre seus campos
seria adivinhação, exatamente o que a regra "não invente silenciosamente" proíbe.

---

## 7. Arquivo `tipo-amparo.ts` órfão removido

**Contexto:** existia um `src/tipo-amparo.ts` com `export type TipoAmparo = 'processo' |
'portaria' | 'resolucao' | 'outro'` — um enum fechado, não referenciado por nenhum outro
arquivo, e em conflito de nome com a interface `TipoAmparo` de `catalogo-amparos.ts`.

**Decisão:** arquivo apagado.

**Por quê:** contradiz frontalmente a Decisão 7 do design doc (§11): tipos de amparo são o
**sexto catálogo**, dado versionado e editável pela instituição — não um union type fechado
no código. Era código morto e incompatível com o modelo adotado.

---

## 8. `Amparo.legado()` não tenta normalizar

**Contexto:** o design doc descreve a porta do importador como "aceita sem validar, preserva
original, **normaliza se possível**". A assinatura que o próprio design doc define, porém, é
`legado(tipo, entrada): Amparo` — sem `catalogo` nem `em`, os dois insumos que
`normalizarAmparo` exige para saber qual máscara aplicar.

**Decisão:** `legado()` preserva o `comoInformado` e usa `entrada.trim()` como
`identificacaoCanonica`, sem tentar canonicalizar por `TipoGrupo`.

**Por quê:** com a assinatura definida pelo design doc, não há como `legado()` sozinho
alcançar uma máscara para normalizar contra. A leitura mais coerente de "normaliza se
possível" é uma responsabilidade do **chamador** (ex.: o importador tenta `Amparo.criar()`
primeiro e só cai para `legado()` quando este falha) — decisão de orquestração do Marco 3,
fora do domínio puro.

---

## 9. Cobertura de testes restrita aos módulos com lógica

**Contexto:** a meta de 100% de cobertura do PROMPT é escopada a "módulos com lógica
(dinheiro, tempo, vigencia, normalizacao-amparo, amparo, folha)"; "módulos só-de-tipos não
contam".

**Decisão:** `vitest.config.ts` restringe `coverage.include` a
`dinheiro.ts, percentual.ts, competencia.ts, vigencia.ts, normalizacao-amparo.ts, amparo.ts,
folha.ts`, com threshold 100% (statements/branches/functions/lines) para esse conjunto.

**Por quê:** os demais módulos (`catalogo*.ts`, `contexto.ts`, `derivacao.ts`, `fato.ts`,
`linha-do-tempo.ts`, `regra.ts`, `rubrica.ts`, `registro-calculo.ts`, `tipos.ts`) só têm
`interface`/`type` — não geram JS executável, então "cobertura" não se aplica a eles; incluí-
los no denominador só adicionaria ruído sem sinal.

---

## 10. `tsconfig.typecheck.json` além do `tsconfig.json` de build

**Contexto:** `tsconfig.json` (usado por `rush build`) exclui `src/**/*.test.ts` de propósito,
para não emitir artefatos de teste em `dist/`. Mas isso significa que `tsc -p tsconfig.json`
nunca verifica os arquivos de teste — inclusive o teste de tipos com `@ts-expect-error`
(critério de aceite: brands não intercambiáveis), que só tem efeito se algo realmente rodar
`tsc` sobre ele.

**Decisão:** criado `tsconfig.typecheck.json` (estende o de build, inclui os testes,
`noEmit: true`) e o script `typecheck` em `package.json`.

**Por quê:** sem isso, um erro de tipo em qualquer `*.test.ts` — incluindo a prova de brands
— passaria despercebido tanto no build quanto no `vitest run` (que roda sobre JS
transpilado por esbuild, sem checagem de tipos).
