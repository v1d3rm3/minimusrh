import type { CatalogoAmparos, CatalogoTiposDeFato, TipoFato, TipoFatoChave } from "@minimusrh/dominio";
import {
  TIPO_FATO_EXONERACAO,
  TIPO_FATO_NASCIMENTO,
  TIPO_FATO_POSSE,
  criarCatalogoAmparos,
  criarCatalogoTiposDeFato,
} from "@minimusrh/regras-alrn";

// configuracao.ts — o que o importador precisa saber da instituição, como DADO (mesmo
// princípio do app-folha DECISOES #1): os catálogos contra os quais o conteúdo é validado e
// quais tipos de fato o ESTADO do legado vira (nascimento da pessoa, abertura e encerramento
// do vínculo). Os eventos funcionais já chegam com a chave do tipo de fato. Só
// `configuracaoAlrn()` conhece `regras-alrn`.

export interface TiposDoEstadoLegado {
  /** Data de nascimento do servidor ⇒ fato de pessoa. */
  readonly nascimento: TipoFatoChave;
  /** Início do vínculo ⇒ fato que abre a história. */
  readonly abertura: TipoFatoChave;
  /** Fim do vínculo ⇒ fato que encerra a história. */
  readonly encerramento: TipoFatoChave;
}

export interface ConfiguracaoImportacao {
  readonly tiposDeFato: CatalogoTiposDeFato;
  readonly amparos: CatalogoAmparos;
  readonly tipos: TiposDoEstadoLegado;
}

export class ErroConfiguracao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroConfiguracao";
  }
}

export function configuracaoAlrn(): ConfiguracaoImportacao {
  return {
    tiposDeFato: criarCatalogoTiposDeFato(),
    amparos: criarCatalogoAmparos(),
    tipos: { nascimento: TIPO_FATO_NASCIMENTO, abertura: TIPO_FATO_POSSE, encerramento: TIPO_FATO_EXONERACAO },
  };
}

/**
 * Confere a configuração contra o próprio catálogo antes de importar qualquer coisa: o tipo
 * de abertura precisa abrir história, o de encerramento encerrar, e o de nascimento ser de
 * pessoa. Configuração errada é erro fatal, não rejeição de registro.
 */
export function validarConfiguracao(configuracao: ConfiguracaoImportacao): void {
  const { tiposDeFato, tipos } = configuracao;
  const exigir = (chave: TipoFatoChave, papel: string, ok: (t: TipoFato) => boolean): void => {
    const tipo = tiposDeFato.porChave(chave);
    if (tipo === undefined) throw new ErroConfiguracao(`tipo de fato de ${papel} '${chave}' não existe no catálogo`);
    if (!ok(tipo)) throw new ErroConfiguracao(`tipo de fato '${chave}' não serve como ${papel} (ver o catálogo)`);
  };
  exigir(tipos.nascimento, "nascimento", (t) => t.alvo === "pessoa");
  exigir(tipos.abertura, "abertura", (t) => t.alvo === "historia" && t.abreHistoria === true);
  exigir(tipos.encerramento, "encerramento", (t) => t.alvo === "historia" && t.encerraHistoria === true);
}
