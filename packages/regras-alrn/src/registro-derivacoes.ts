import type { Derivacao, DerivacaoChave, RegistroDeDerivacoes } from "@minimusrh/dominio";
import { DERIVACAO_CARGO, DERIVACAO_CARGO_IMPL } from "./derivacao-cargo.js";
import { DERIVACAO_DIAS_TRABALHADOS, DERIVACAO_DIAS_TRABALHADOS_IMPL } from "./derivacao-dias-trabalhados.js";
import { DERIVACAO_IDADE, DERIVACAO_IDADE_IMPL } from "./derivacao-idade.js";
import { DERIVACAO_SITUACAO_FUNCIONAL, DERIVACAO_SITUACAO_FUNCIONAL_IMPL } from "./derivacao-situacao-funcional.js";

// registro-derivacoes.ts — Design Domínio §4: "verificação de integridade na
// inicialização: toda chave catalogada tem implementação registrada, e vice-versa". O
// catálogo de chaves e o mapa de implementações são construídos a partir da MESMA lista
// (Object.entries do `MAPA`), então a bijeção é estrutural — o teste de integridade existe
// para travar contra regressão (alguém remove uma entrada do mapa sem remover a chave, ou
// vice-versa em uma refatoração futura).
const MAPA: Readonly<Record<DerivacaoChave, Derivacao<unknown>>> = {
  [DERIVACAO_IDADE]: DERIVACAO_IDADE_IMPL,
  [DERIVACAO_CARGO]: DERIVACAO_CARGO_IMPL,
  [DERIVACAO_SITUACAO_FUNCIONAL]: DERIVACAO_SITUACAO_FUNCIONAL_IMPL,
  [DERIVACAO_DIAS_TRABALHADOS]: DERIVACAO_DIAS_TRABALHADOS_IMPL,
};

export const CATALOGO_CHAVES_DERIVACAO: readonly DerivacaoChave[] = Object.keys(MAPA) as DerivacaoChave[];

export function criarRegistroDeDerivacoes(): RegistroDeDerivacoes {
  return { porChave: (chave) => MAPA[chave] };
}
