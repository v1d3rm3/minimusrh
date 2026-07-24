import { TipoAmparoChave, TipoAmparo } from "./catalogo-amparos.js";
import { TipoFato } from "./catalogo-fatos.js";
import { Rubrica } from "./rubrica.js";
import { TipoFatoChave, RubricaChave } from "./tipos.js";

export interface Catalogo<Chave extends string, T> {
  porChave(chave: Chave): T | undefined;
  todos(): readonly T[];
}

export type CatalogoTiposDeFato = Catalogo<TipoFatoChave, TipoFato>;
export type CatalogoRubricas    = Catalogo<RubricaChave, Rubrica>;
export type CatalogoAmparos     = Catalogo<TipoAmparoChave, TipoAmparo>;