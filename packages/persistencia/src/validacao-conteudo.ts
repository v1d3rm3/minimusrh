import { Dinheiro, Percentual, dataEfeito } from "@minimusrh/dominio";
import type {
  AlvoFato,
  Amparo,
  CampoSchema,
  CatalogoTiposDeFato,
  ErroValidacao,
  TipoFatoChave,
} from "@minimusrh/dominio";

// validacao-conteudo.ts — lacuna real do design (DECISOES #1): `Fato.conteudo` é descrito
// no dominio como "validado contra o schema da versão do tipo" (fato.ts), mas nenhuma
// função de validação existe lá. `persistencia` implementa aqui, chamada por
// `fato-repositorio.ts::registrar` ANTES de qualquer I/O.

/** Subconjunto de `NovoFato` necessário para validar — evita import circular com fato-repositorio.ts. */
export interface DadosParaValidar {
  readonly tipo: TipoFatoChave;
  readonly versaoDoTipo: number;
  readonly conteudo: unknown;
  readonly alvo: AlvoFato;
  readonly amparo?: Amparo;
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function mensagemDeErro(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * `TipoCampo` é vocabulário FECHADO da plataforma (como `TipoGrupo` em
 * normalizacao-amparo.ts do dominio), não chave de domínio da instituição — o switch
 * aqui é o mesmo padrão do interpretador de amparo, não a proibição da Regra Global #3
 * (que veta `if`/`switch` sobre RUBRICA/TIPO DE FATO, dado de catálogo institucional).
 */
function validarValorDoCampo(campo: CampoSchema, valor: unknown): ErroValidacao | undefined {
  switch (campo.tipo) {
    case "texto":
      return typeof valor === "string" ? undefined : { erro: `campo '${campo.nome}' deveria ser texto` };
    case "numero":
      return typeof valor === "number" ? undefined : { erro: `campo '${campo.nome}' deveria ser numero` };
    case "logico":
      return typeof valor === "boolean" ? undefined : { erro: `campo '${campo.nome}' deveria ser logico` };
    case "data":
      if (typeof valor !== "string") {
        return { erro: `campo '${campo.nome}' deveria ser uma data ('YYYY-MM-DD')` };
      }
      try {
        dataEfeito(valor);
        return undefined;
      } catch (e) {
        return { erro: `campo '${campo.nome}': ${mensagemDeErro(e)}` };
      }
    case "dinheiro":
      if (typeof valor !== "string") {
        return { erro: `campo '${campo.nome}' deveria ser dinheiro (string decimal)` };
      }
      try {
        Dinheiro.de(valor);
        return undefined;
      } catch {
        return { erro: `campo '${campo.nome}': valor monetario invalido '${valor}'` };
      }
    case "percentual":
      if (typeof valor !== "string") {
        return { erro: `campo '${campo.nome}' deveria ser percentual (string decimal)` };
      }
      try {
        Percentual.de(valor);
        return undefined;
      } catch {
        return { erro: `campo '${campo.nome}': percentual invalido '${valor}'` };
      }
  }
}

/** Campos depreciados ficam opcionais independente de `obrigatorio` (§9.2: campos nunca somem, só depreciam). */
function validarCampos(schema: readonly CampoSchema[], conteudo: unknown): ErroValidacao | undefined {
  if (!ehRegistro(conteudo)) return { erro: "conteudo do fato deve ser um objeto" };

  const nomesDoSchema = new Set(schema.map((campo) => campo.nome));
  for (const chave of Object.keys(conteudo)) {
    if (!nomesDoSchema.has(chave)) return { erro: `campo desconhecido no conteudo: '${chave}'` };
  }

  for (const campo of schema) {
    const valor = conteudo[campo.nome];
    if (valor === undefined) {
      if (campo.obrigatorio && !campo.depreciado) {
        return { erro: `campo obrigatorio ausente: '${campo.nome}'` };
      }
      continue;
    }
    const erro = validarValorDoCampo(campo, valor);
    if (erro) return erro;
  }

  return undefined;
}

export function validarConteudo(catalogo: CatalogoTiposDeFato, fato: DadosParaValidar): true | ErroValidacao {
  const tipoFato = catalogo.porChave(fato.tipo);
  if (!tipoFato) return { erro: `tipo de fato desconhecido: '${fato.tipo}'` };

  if (tipoFato.alvo !== fato.alvo.escopo) {
    return { erro: `fato do tipo '${fato.tipo}' espera alvo '${tipoFato.alvo}', recebeu '${fato.alvo.escopo}'` };
  }

  const versao = tipoFato.versoes.find((v) => v.versao === fato.versaoDoTipo);
  if (!versao) return { erro: `versao ${fato.versaoDoTipo} nao encontrada para o tipo '${fato.tipo}'` };

  if (versao.exigeAmparo && fato.amparo === undefined) {
    return { erro: `tipo '${fato.tipo}' (versao ${fato.versaoDoTipo}) exige amparo` };
  }

  const erroCampos = validarCampos(versao.schema, fato.conteudo);
  if (erroCampos) return erroCampos;

  return true;
}
