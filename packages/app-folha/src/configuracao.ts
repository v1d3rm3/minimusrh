import type {
  Catalogo,
  CatalogoRubricas,
  CatalogoTiposDeFato,
  HistoriaId,
  PessoaId,
  RegistroDeDerivacoes,
  RegraChave,
  TipoFolhaChave,
  VersaoRegra,
} from "@minimusrh/dominio";
import {
  CATALOGO_REGRAS,
  criarCatalogoRubricas,
  criarCatalogoTiposDeFato,
  criarCatalogoTiposDeFolha,
  criarRegistroDeDerivacoes,
} from "@minimusrh/regras-alrn";

// configuracao.ts — o que o serviço de folha precisa saber da instituição, como DADO
// (Fundação §4: "domínio entra pelo catálogo, nunca pelo código do core"). O serviço é
// genérico; só `configuracaoAlrn()` conhece `regras-alrn`.

export interface ConfiguracaoInstituicao {
  readonly tiposDeFato: CatalogoTiposDeFato;
  readonly tiposDeFolha: Catalogo<TipoFolhaChave, unknown>;
  readonly rubricas: CatalogoRubricas;
  readonly regras: ReadonlyMap<RegraChave, readonly VersaoRegra[]>;
  readonly derivacoes: RegistroDeDerivacoes;
}

/** Agrupa versões de regra pela chave — a forma que `motor::calcularFolha` consome. */
export function agruparRegras(versoes: readonly VersaoRegra[]): ReadonlyMap<RegraChave, readonly VersaoRegra[]> {
  const mapa = new Map<RegraChave, VersaoRegra[]>();
  for (const versao of versoes) {
    const grupo = mapa.get(versao.regra);
    if (grupo !== undefined) grupo.push(versao);
    else mapa.set(versao.regra, [versao]);
  }
  return mapa;
}

export function configuracaoAlrn(): ConfiguracaoInstituicao {
  return {
    tiposDeFato: criarCatalogoTiposDeFato(),
    tiposDeFolha: criarCatalogoTiposDeFolha(),
    rubricas: criarCatalogoRubricas(),
    regras: agruparRegras(CATALOGO_REGRAS),
    derivacoes: criarRegistroDeDerivacoes(),
  };
}

/** Uma história e a pessoa dona dela — o par que `persistencia::linhaDoTempoPg` exige. */
export interface AlvoHistoria {
  readonly pessoaId: PessoaId;
  readonly historiaId: HistoriaId;
}

/**
 * Quem são as histórias da instituição. Nenhuma tabela modela o vínculo pessoa↔história
 * ainda (persistencia DECISOES #8), então o serviço recebe esta porta em vez de inventar
 * uma — ver DECISOES #2 deste pacote.
 */
export interface CadastroDeHistorias {
  listar(): Promise<readonly AlvoHistoria[]>;
}

export function cadastroEmMemoria(alvos: readonly AlvoHistoria[]): CadastroDeHistorias {
  return { listar: async () => alvos };
}
