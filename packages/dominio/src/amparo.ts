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

export class Amparo {
  private constructor(
    readonly tipo: TipoAmparoChave,
    /** Identidade canônica — agrupa fatos do mesmo documento; indexada no banco. */
    readonly identificacaoCanonica: string,
    /** Como foi digitado/importado — preservado para auditoria ("o documento físico diz o quê?"). */
    readonly comoInformado: string,
    readonly validadoContraVersao?: number,  // ausente = legado importado sem validação
  ) {}

  /** Porta dos fatos NOVOS: usa normalizarAmparo com a versão vigente do tipo. */
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

  /** Porta do importador (Marco 3): aceita sem validar, preserva original, normaliza se possível. */
  static legado(tipo: TipoAmparoChave, entrada: string): Amparo {
    return new Amparo(tipo, entrada.trim(), entrada);
  }

  mesmoDocumentoQue(o: Amparo): boolean {
    return this.tipo === o.tipo && this.identificacaoCanonica === o.identificacaoCanonica;
  }
}