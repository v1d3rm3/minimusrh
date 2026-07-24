import { Competencia, DataEfeito, DataRegistro } from "./competencia.js";
import { LinhaDoTempo } from "./linha-do-tempo.js";
import { DerivacaoChave, TipoFatoChave } from "./tipos.js";
import { ComVigencia } from "./vigencia.js";

// derivacao.ts — CONTRATO (§0.1, critério 3): implementado em código no pacote da
// instituição (regras-alrn), pois quase toda derivação referencia vocabulário institucional
// ('cargo' lê fatos 'promocao'/'posse'; 'saldo_divida_auxilio' lê a dívida do auxílio).
// VERSIONADO como tudo que participa do cálculo: mudar "como se contam os dias trabalhados"
// por edição destrutiva quebraria a reprodutibilidade pelo mesmo buraco do §1.4.
export interface VersaoDerivacao<T> extends ComVigencia {
  readonly versao: number;
  readonly dataEfeito: DataEfeito;
  readonly dataRegistro: DataRegistro;
  readonly dependeDe: readonly TipoFatoChave[];   // insumo do grafo e do impacto (§9.3)
  derivar(linha: LinhaDoTempo, referencia: DataEfeito, competencia: Competencia): T | undefined;
}

export interface Derivacao<T> {
  readonly chave: DerivacaoChave;
  readonly versoes: readonly VersaoDerivacao<T>[];
}

// registro-derivacoes.ts — liga o catálogo de chaves (dado) às implementações (código).
// Contrato de leitura (família do Catalogo, §1.4); regras-alrn implementa. Verificação de
// integridade na inicialização: toda chave catalogada tem implementação registrada, e
// vice-versa — "nada morre com dependentes vivos" (§9.5), aplicado ao nascimento.
export interface RegistroDeDerivacoes {
  porChave(chave: DerivacaoChave): Derivacao<unknown> | undefined;
}