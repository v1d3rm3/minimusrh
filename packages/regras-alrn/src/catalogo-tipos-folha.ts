import type { Catalogo, TipoFolhaChave } from "@minimusrh/dominio";
import { criarCatalogo } from "./catalogo-util.js";

// catalogo-tipos-folha.ts — o domínio (`@minimusrh/dominio`) NÃO define uma entidade
// `TipoFolha`/`VersaoTipoFolha` (só a chave branded `TipoFolhaChave`) — mesma lacuna já
// registrada na decisão #6 de `packages/dominio/DECISOES-IMPLEMENTACAO.md`. O playbook do
// Módulo 4 pede um catálogo de "tipos de folha (mensal)"; como não há forma nenhuma
// especificada em nenhum documento de design, este tipo é uma invenção LOCAL, mínima e
// documentada em DECISOES — só o suficiente para nomear o tipo de folha nas regras.
export interface TipoFolha {
  readonly chave: TipoFolhaChave;
  readonly nome: string;
}

export type CatalogoTiposDeFolha = Catalogo<TipoFolhaChave, TipoFolha>;

export const TIPO_FOLHA_MENSAL = "mensal" as TipoFolhaChave;

export const CATALOGO_TIPOS_DE_FOLHA: readonly TipoFolha[] = [{ chave: TIPO_FOLHA_MENSAL, nome: "Mensal" }];

export function criarCatalogoTiposDeFolha(): CatalogoTiposDeFolha {
  return criarCatalogo((tipo) => tipo.chave, CATALOGO_TIPOS_DE_FOLHA);
}
