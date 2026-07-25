import { dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { AlvoFato, Autor, CatalogoTiposDeFato, FatoId, HistoriaId, PessoaId, TipoFato, TipoFatoChave } from "@minimusrh/dominio";
import type { NovoFato } from "../fato-repositorio.js";

// fixtures.ts — suporte de teste (NÃO é `*.test.ts`): um catálogo mínimo ad-hoc para os
// testes de integração de `persistencia` (Módulo 3 do playbook não precisa da fixture
// "Victor" formal — essa nasce em `regras-alrn`, Módulo 4).

export const TIPO_POSSE = "posse" as TipoFatoChave;
export const TIPO_EXONERACAO = "exoneracao" as TipoFatoChave;

/**
 * DECISOES #9: o teste bitemporal do Módulo 3 precisa de um tipo de fato cujo VALOR
 * (cargo) mude ao longo do tempo para exercitar `vigenteEm` diretamente — a derivação
 * real que unifica fatos de `posse`+`promocao` num único "cargo atual" pertence a
 * `regras-alrn` (Módulo 4, fora de escopo aqui). `cargo` aqui é só um tipo de fato de
 * fixture: testa o mecanismo bitemporal de `persistencia`, não a regra de negócio.
 */
export const TIPO_CARGO = "cargo" as TipoFatoChave;

/** Único tipo de fixture com `alvo: 'pessoa'` (Design §3: 'nascimento' é exemplo real). */
export const TIPO_NASCIMENTO = "nascimento" as TipoFatoChave;

export const AUTOR_TESTE: Autor = { tipo: "humano", usuarioId: "teste" };

function schemaCargo() {
  return [{ nome: "cargo", tipo: "texto" as const, obrigatorio: true }];
}

export function catalogoDeTeste(): CatalogoTiposDeFato {
  const tipos: TipoFato[] = [
    {
      chave: TIPO_POSSE,
      alvo: "historia",
      abreHistoria: true,
      versoes: [
        {
          versao: 1,
          dataEfeito: dataEfeito("2000-01-01"),
          dataRegistro: dataRegistro("2000-01-01T00:00:00Z"),
          schema: schemaCargo(),
          exigeAmparo: false,
        },
      ],
    },
    {
      chave: TIPO_CARGO,
      alvo: "historia",
      versoes: [
        {
          versao: 1,
          dataEfeito: dataEfeito("2000-01-01"),
          dataRegistro: dataRegistro("2000-01-01T00:00:00Z"),
          schema: schemaCargo(),
          exigeAmparo: false,
        },
      ],
    },
    {
      chave: TIPO_EXONERACAO,
      alvo: "historia",
      encerraHistoria: true,
      versoes: [
        {
          versao: 1,
          dataEfeito: dataEfeito("2000-01-01"),
          dataRegistro: dataRegistro("2000-01-01T00:00:00Z"),
          schema: [],
          exigeAmparo: false,
        },
      ],
    },
    {
      chave: TIPO_NASCIMENTO,
      alvo: "pessoa",
      versoes: [
        {
          versao: 1,
          dataEfeito: dataEfeito("2000-01-01"),
          dataRegistro: dataRegistro("2000-01-01T00:00:00Z"),
          schema: [],
          exigeAmparo: false,
        },
      ],
    },
  ];
  const mapa = new Map(tipos.map((tipo) => [tipo.chave, tipo]));
  return { porChave: (chave) => mapa.get(chave), todos: () => tipos };
}

function alvoHistoria(historiaId: HistoriaId): AlvoFato {
  return { escopo: "historia", historiaId };
}

function alvoPessoa(pessoaId: PessoaId): AlvoFato {
  return { escopo: "pessoa", pessoaId };
}

export function fatoNascimento(pessoaId: PessoaId, dataEfeitoIso: string, dataRegistroIso: string): NovoFato<Record<string, never>> {
  return {
    alvo: alvoPessoa(pessoaId),
    tipo: TIPO_NASCIMENTO,
    versaoDoTipo: 1,
    conteudo: {},
    dataEfeito: dataEfeito(dataEfeitoIso),
    dataRegistro: dataRegistro(dataRegistroIso),
    autor: AUTOR_TESTE,
  };
}

export function fatoPosse(
  historiaId: HistoriaId,
  cargo: string,
  dataEfeitoIso: string,
  dataRegistroIso: string,
): NovoFato<{ cargo: string }> {
  return {
    alvo: alvoHistoria(historiaId),
    tipo: TIPO_POSSE,
    versaoDoTipo: 1,
    conteudo: { cargo },
    dataEfeito: dataEfeito(dataEfeitoIso),
    dataRegistro: dataRegistro(dataRegistroIso),
    autor: AUTOR_TESTE,
  };
}

export function fatoCargo(
  historiaId: HistoriaId,
  cargo: string,
  dataEfeitoIso: string,
  dataRegistroIso: string,
  substituiFatoId?: FatoId,
): NovoFato<{ cargo: string }> {
  return {
    alvo: alvoHistoria(historiaId),
    tipo: TIPO_CARGO,
    versaoDoTipo: 1,
    conteudo: { cargo },
    dataEfeito: dataEfeito(dataEfeitoIso),
    dataRegistro: dataRegistro(dataRegistroIso),
    autor: AUTOR_TESTE,
    ...(substituiFatoId !== undefined ? { substituiFatoId } : {}),
  };
}
