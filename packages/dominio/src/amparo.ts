import { TipoAmparoChave } from "./catalogo-amparos.js";
import { CatalogoAmparos } from "./catalogo.js";
import { DataEfeito, DataRegistro } from "./competencia.js";
import { normalizarAmparo } from "./normalizacao-amparo.js";
import { ErroValidacao } from "./tipos.js";
import { ComVigencia, versaoVigente } from "./vigencia.js";

/** Corte "sem limite": o maior dataRegistro entre as versões conhecidas — fatos novos usam sempre o conhecimento mais atual do catálogo, nunca uma foto do passado. */
function corteSemLimite(versoes: readonly ComVigencia[]): DataRegistro | undefined {
  return versoes.reduce<DataRegistro | undefined>(
    (maior, v) => (maior === undefined || v.dataRegistro > maior ? v.dataRegistro : maior),
    undefined,
  );
}

/**
 * Referência ao ato ou documento formal (processo, portaria, resolução, lei, decisão judicial etc.)
 * que respalda juridicamente o registro de um {@link Fato} (§3.3 do modelo conceitual; §2.1 do design do domínio).
 *
 * `Amparo` é um **value object com portão de construção** (construtor privado + fábricas estáticas):
 * o domínio garante a estrutura ("todo amparo tem tipo, identidade canônica e grafia original"),
 * enquanto os tipos aceitos, máscaras e regras de formatação vêm do **catálogo de amparos**
 * ({@link CatalogoAmparos}), gerenciado pela própria instituição sem alterar código.
 *
 * ### Identidade canônica vs. grafia original
 * Todo amparo preserva duas representações complementares:
 * - **`identificacaoCanonica`:** grafia normalizada (ex.: `'0045/2026'` → `'45/2026'`), usada pelo
 *   sistema e indexada no banco para agrupar fatos respaldados pelo mesmo documento
 *   (ex.: *"todos os fatos amparados pelo processo 45/2026"*), independentemente de variações de digitação.
 * - **`comoInformado`:** grafia exata digitada pelo operador ou recebida na importação, preservada
 *   integralmente para auditoria (*"o que estava escrito no documento físico?"*).
 *
 * ### As duas portas de construção ("rigor para o futuro, honestidade com o passado")
 * - **`Amparo.criar()` (fatos novos):** valida e normaliza a entrada contra a versão vigente do
 *   {@link TipoAmparo} na data de efeito informada, gravando a versão utilizada em `validadoContraVersao`.
 * - **`Amparo.legado()` (importação de legado — Marco 3):** aceita dados históricos fora dos padrões
 *   atuais (ex.: `'Proc. 45/89'`) sem validar contra o catálogo, aplicando apenas `trim()` na
 *   `identificacaoCanonica` e deixando `validadoContraVersao` ausente (`undefined`).
 */
export class Amparo {
  private constructor(
    /** Chave do tipo de amparo no catálogo (ex.: `'processo'`, `'portaria'`, `'resolucao'`). */
    readonly tipo: TipoAmparoChave,
    /** Identidade canônica — agrupa fatos do mesmo documento; indexada no banco. */
    readonly identificacaoCanonica: string,
    /** Como foi digitado/importado — preservado para auditoria ("o documento físico diz o quê?"). */
    readonly comoInformado: string,
    /** Número da {@link VersaoTipoAmparo} usada na validação; `undefined` quando criado via {@link Amparo.legado}. */
    readonly validadoContraVersao?: number,
  ) {}

  /**
   * Porta de entrada para fatos **novos**: localiza o `tipo` no `catalogo`, resolve a versão
   * vigente na data de efeito `em` (usando o conhecimento mais recente do catálogo — corte sem limite)
   * e aplica {@link normalizarAmparo} sobre a `entrada`.
   *
   * Retorna {@link ErroValidacao} se o tipo não existir no catálogo, se não houver versão vigente
   * em `em`, ou se a `entrada` não obedecer à máscara/grupos da versão vigente.
   */
  static criar(tipo: TipoAmparoChave, entrada: string, catalogo: CatalogoAmparos,
               em: DataEfeito): Amparo | ErroValidacao {
    const tipoAmparo = catalogo.porChave(tipo);
    if (!tipoAmparo) {
      return { erro: `tipo de amparo desconhecido: '${tipo}'` };
    }

    const corte = corteSemLimite(tipoAmparo.versoes);
    const versao = corte && versaoVigente(tipoAmparo.versoes, em, corte);
    if (!versao) {
      return { erro: `nenhuma versão vigente para o tipo de amparo '${tipo}' em ${em}` };
    }

    const resultado = normalizarAmparo(versao, entrada);
    if ('erro' in resultado) return resultado;
    return new Amparo(tipo, resultado.canonica, entrada, versao.versao);
  }

  /**
   * Porta de entrada do importador de legado (Marco 3): constrói o amparo sem validar contra
   * o catálogo, preservando `entrada` em `comoInformado`, usando `entrada.trim()` como
   * `identificacaoCanonica` (DECISOES #8) e deixando `validadoContraVersao` como `undefined`.
   */
  static legado(tipo: TipoAmparoChave, entrada: string): Amparo {
    return new Amparo(tipo, entrada.trim(), entrada);
  }

  /**
   * Verifica se dois amparos referenciam o mesmo documento formal, comparando
   * o `tipo` e a `identificacaoCanonica` (ignorando diferenças na grafia original `comoInformado`).
   */
  mesmoDocumentoQue(o: Amparo): boolean {
    return this.tipo === o.tipo && this.identificacaoCanonica === o.identificacaoCanonica;
  }
}