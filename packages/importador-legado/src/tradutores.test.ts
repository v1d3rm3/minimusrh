import { Amparo, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { TipoFato, TipoFatoChave } from "@minimusrh/dominio";
import { TIPO_FATO_POSSE, criarCatalogoTiposDeFato } from "@minimusrh/regras-alrn";
import { describe, expect, it } from "vitest";
import { configuracaoAlrn, type ConfiguracaoImportacao } from "./configuracao.js";
import { CONVENCAO_REGISTRO_DESCONHECIDO } from "./convencoes.js";
import { historiaIdDoVinculo, pessoaIdDoServidor } from "./identidade.js";
import type { RegistroContracheque, RegistroEvento, RegistroServidor, RegistroVinculo } from "./registros.js";
import { assinaturaDoFato, ehRejeicao, escolherVersaoDoTipo, traduzir, type Rejeicao, type UnidadeImportacao } from "./tradutores.js";

const ctx = { configuracao: configuracaoAlrn(), lote: "lote-1" };
const origem = { arquivo: "x.csv", linha: 2 };

function unidade(r: Parameters<typeof traduzir>[1], c = ctx): UnidadeImportacao {
  const t = traduzir(c, r);
  if (ehRejeicao(t)) throw new Error(`rejeitado: ${t.motivo}`);
  return t;
}

function motivo(r: Parameters<typeof traduzir>[1], c = ctx): string {
  const t = traduzir(c, r);
  if (!ehRejeicao(t)) throw new Error("esperava rejeição");
  return (t as Rejeicao).motivo;
}

const servidor: RegistroServidor = { tipo: "servidor", origem, idServidor: "1001", dataNascimento: "1990-05-20" };
const vinculo: RegistroVinculo = { tipo: "vinculo", origem, idVinculo: "V1", idServidor: "1001", dataInicio: "2020-03-01", campos: { cargo: "B6" } };
const evento: RegistroEvento = {
  tipo: "evento",
  origem,
  idEvento: "E1",
  idVinculo: "V1",
  tipoFato: "promocao",
  dataEfeito: "2026-02-15",
  dataRegistro: "2026-07-10T14:30:00-03:00",
  amparo: { tipo: "processo", comoInformado: "Proc. 123/2026" },
  campos: { cargo: "B8" },
};
const contracheque: RegistroContracheque = {
  tipo: "contracheque",
  origem,
  idVinculo: "V1",
  competencia: "2026-03",
  tipoFolha: "MENSAL",
  rubrica: "0001",
  descricao: "VENCIMENTO",
  valor: "5000.00",
};

describe("tradutores: registro cru → fatos", () => {
  it("servidor: identidade derivada + nascimento como fato de pessoa, com a convenção de registro visível", () => {
    const u = unidade(servidor);
    expect(u).toMatchObject({ tipo: "servidor", chaveNatural: "servidor:1001", servidor: { idServidorLegado: "1001", pessoaId: pessoaIdDoServidor("1001") } });
    if (u.tipo !== "servidor") throw new Error();
    expect(u.fatos).toHaveLength(1);
    const [f] = u.fatos;
    expect(f!.chaveNatural).toBe("servidor:1001:nascimento");
    expect(f!.registroPorConvencao).toBe(true);
    expect(f!.fato).toEqual({
      alvo: { escopo: "pessoa", pessoaId: pessoaIdDoServidor("1001") },
      tipo: "nascimento",
      versaoDoTipo: 1,
      conteudo: {},
      dataEfeito: "1990-05-20",
      // CONVENCAO_REGISTRO_DESCONHECIDO: registro := efeito, à meia-noite UTC
      dataRegistro: "1990-05-20T00:00:00.000Z",
      autor: { tipo: "importacao", lote: "lote-1" },
    });
    expect(CONVENCAO_REGISTRO_DESCONHECIDO.aplicar(dataEfeito("1990-05-20"))).toBe(f!.fato.dataRegistro);
  });

  it("servidor sem data de nascimento: só a identidade", () => {
    const { dataNascimento: _d, ...semData } = servidor;
    expect(unidade(semData)).toMatchObject({ fatos: [] });
  });

  it("vínculo aberto: história derivada + posse com o conteúdo das colunas campo.*", () => {
    const u = unidade(vinculo);
    if (u.tipo !== "vinculo") throw new Error();
    expect(u.vinculo).toEqual({ idVinculoLegado: "V1", historiaId: historiaIdDoVinculo("V1"), idServidorLegado: "1001", pessoaId: pessoaIdDoServidor("1001") });
    expect(u.fatos.map((f) => [f.chaveNatural, f.fato.tipo, f.fato.dataEfeito, f.fato.conteudo])).toEqual([
      ["vinculo:V1:abertura", "posse", "2020-03-01", { cargo: "B6" }],
    ]);
    expect(u.fatos[0]!.fato.alvo).toEqual({ escopo: "historia", historiaId: historiaIdDoVinculo("V1") });
  });

  it("vínculo encerrado: posse + exoneração no último dia de exercício", () => {
    const u = unidade({ ...vinculo, dataFim: "2026-02-20" });
    if (u.tipo !== "vinculo") throw new Error();
    expect(u.fatos.map((f) => [f.chaveNatural, f.fato.tipo, f.fato.dataEfeito, f.fato.conteudo])).toEqual([
      ["vinculo:V1:abertura", "posse", "2020-03-01", { cargo: "B6" }],
      ["vinculo:V1:encerramento", "exoneracao", "2026-02-20", {}],
    ]);
  });

  it("evento: data de registro do legado (canonizada), amparo pela porta do legado, sem convenção", () => {
    const u = unidade(evento);
    if (u.tipo !== "evento") throw new Error();
    expect(u.idVinculoLegado).toBe("V1");
    const [f] = u.fatos;
    expect(f!.chaveNatural).toBe("evento:E1");
    expect(f!.registroPorConvencao).toBe(false);
    expect(f!.fato).toMatchObject({ tipo: "promocao", dataEfeito: "2026-02-15", dataRegistro: "2026-07-10T17:30:00.000Z", conteudo: { cargo: "B8" } });
    expect(f!.fato.amparo).toBeInstanceOf(Amparo);
    expect(f!.fato.amparo).toMatchObject({ tipo: "processo", identificacaoCanonica: "Proc. 123/2026", comoInformado: "Proc. 123/2026", validadoContraVersao: undefined });
  });

  it("evento com data de registro sem hora: 00:00:00Z, e não conta como convenção", () => {
    const u = unidade({ ...evento, dataRegistro: "2026-07-10" });
    expect(u.tipo === "evento" && u.fatos[0]).toMatchObject({ registroPorConvencao: false, fato: { dataRegistro: "2026-07-10T00:00:00.000Z" } });
  });

  it("evento sem data de registro usa a convenção", () => {
    const { dataRegistro: _r, ...semRegistro } = evento;
    const u = unidade(semRegistro);
    expect(u.tipo === "evento" && u.fatos[0]).toMatchObject({ registroPorConvencao: true, fato: { dataRegistro: "2026-02-15T00:00:00.000Z" } });
  });

  it("converte os campos pelo tipo do schema e preserva o texto", () => {
    const u = unidade({
      ...evento,
      tipoFato: "comprovacao_plano_saude",
      campos: { operadora: "Unimed", mensalidade: "350.00", periodo_fim: "2026-12-31" },
    });
    expect(u.tipo === "evento" && u.fatos[0]!.fato.conteudo).toEqual({ operadora: "Unimed", mensalidade: "350.00", periodo_fim: "2026-12-31" });
  });

  it("contracheque: linha de gabarito com competência e valor exatos, fora da linha de fatos", () => {
    const u = unidade(contracheque);
    if (u.tipo !== "contracheque") throw new Error();
    expect(u.chaveNatural).toBe("contracheque:V1:2026-03:MENSAL:0001");
    expect(u.gabarito).toMatchObject({ idVinculoLegado: "V1", historiaId: historiaIdDoVinculo("V1"), tipoFolhaLegado: "MENSAL", rubricaLegado: "0001", descricao: "VENCIMENTO" });
    expect(u.gabarito.competencia.toString()).toBe("2026-03");
    expect(u.gabarito.valor.paraString()).toBe("5000.00");
    const { descricao: _d, ...semDescricao } = contracheque;
    expect(unidade({ ...semDescricao, valor: "-12.5" })).not.toHaveProperty("gabarito.descricao");
  });

  it("registro ilegível vira rejeição com o motivo da fonte", () => {
    expect(traduzir(ctx, { tipo: "ilegivel", origem, motivo: "linha torta" })).toEqual({ origem, motivo: "linha torta" });
  });

  it.each<[string, Parameters<typeof traduzir>[1], RegExp]>([
    ["nascimento fora do calendário", { ...servidor, dataNascimento: "1988-02-30" }, /'data_nascimento' inválida: '1988-02-30'/],
    ["data de início inválida", { ...vinculo, dataInicio: "01/03/2020" }, /'data_inicio' inválida/],
    ["fim antes do início", { ...vinculo, dataFim: "2019-12-31" }, /'data_fim' \(2019-12-31\) anterior a 'data_inicio'/],
    ["posse sem o campo obrigatório", { ...vinculo, campos: {} }, /fato 'posse': campo obrigatorio ausente: 'cargo'/],
    ["campo fora do schema", { ...vinculo, campos: { cargo: "B6", nivel: "3" } }, /campo desconhecido no conteudo: 'nivel'/],
    ["tipo de fato desconhecido", { ...evento, tipoFato: "licenca_premio" }, /tipo de fato desconhecido no catálogo: 'licenca_premio'/],
    ["evento de pessoa", { ...evento, tipoFato: "nascimento" }, /é de pessoa/],
    ["evento que abre história", { ...evento, tipoFato: "posse" }, /abre ou encerra história: vem de vinculos.csv/],
    ["evento que encerra história", { ...evento, tipoFato: "exoneracao", campos: {} }, /abre ou encerra história/],
    ["promoção sem amparo", (({ amparo: _a, ...r }) => r)(evento), /exige amparo/],
    ["tipo de amparo desconhecido", { ...evento, amparo: { tipo: "oficio", comoInformado: "1/2025" } }, /tipo de amparo desconhecido no catálogo: 'oficio'/],
    ["data de registro inválida", { ...evento, dataRegistro: "ontem" }, /'data_registro' inválida: 'ontem'/],
    ["data de efeito inválida", { ...evento, dataEfeito: "2026-13-01" }, /'data_efeito' inválida/],
    ["dinheiro com vírgula", { ...evento, tipoFato: "comprovacao_plano_saude", amparo: undefined, campos: { operadora: "U", mensalidade: "350,00", periodo_fim: "2026-12-31" } } as RegistroEvento, /'350,00' não é decimal com ponto/],
    ["competência fora do intervalo", { ...contracheque, competencia: "2026-13" }, /'competencia' inválida: '2026-13'/],
    ["competência sem formato", { ...contracheque, competencia: "03/2026" }, /'competencia' inválida/],
    ["valor com vírgula", { ...contracheque, valor: "1.234,56" }, /'valor' inválido: '1.234,56'/],
    ["valor com mais de 2 casas", { ...contracheque, valor: "1.005" }, /'valor' inválido/],
    ["valor em notação científica", { ...contracheque, valor: "1e3" }, /'valor' inválido/],
  ])("rejeita: %s", (_caso, registro, esperado) => {
    expect(motivo(registro)).toMatch(esperado);
  });

  it("tipo do estado legado ausente do catálogo vira rejeição (traduzir chamado sem validarConfiguracao)", () => {
    const semPosse: ConfiguracaoImportacao = { ...ctx.configuracao, tipos: { ...ctx.configuracao.tipos, abertura: "admissao" as TipoFatoChave } };
    expect(motivo(vinculo, { ...ctx, configuracao: semPosse })).toBe("tipo de fato desconhecido no catálogo: 'admissao'");
  });

  it("erro inesperado (não de tradução) sobe, não vira rejeição", () => {
    const quebrado: ConfiguracaoImportacao = {
      ...ctx.configuracao,
      tiposDeFato: { porChave: () => { throw new Error("catálogo fora do ar"); }, todos: () => [] },
    };
    expect(() => traduzir({ ...ctx, configuracao: quebrado }, evento)).toThrow("catálogo fora do ar");
  });
});

describe("conversão de campos por tipo do schema (numero, logico, percentual)", () => {
  const TIPO_TESTE = "ficha" as TipoFatoChave;
  const tipoTeste: TipoFato = {
    chave: TIPO_TESTE,
    alvo: "historia",
    versoes: [
      {
        versao: 1,
        dataEfeito: dataEfeito("2026-01-01"),
        dataRegistro: dataRegistro("2026-01-01T00:00:00Z"),
        exigeAmparo: false,
        schema: [
          { nome: "dependentes", tipo: "numero", obrigatorio: false },
          { nome: "ativo", tipo: "logico", obrigatorio: false },
          { nome: "aliquota", tipo: "percentual", obrigatorio: false },
        ],
      },
    ],
  };
  const catalogo = criarCatalogoTiposDeFato();
  const comTeste: ConfiguracaoImportacao = {
    ...ctx.configuracao,
    tiposDeFato: { porChave: (c) => (c === TIPO_TESTE ? tipoTeste : catalogo.porChave(c)), todos: () => [...catalogo.todos(), tipoTeste] },
  };
  const c = { ...ctx, configuracao: comTeste };
  const base: RegistroEvento = { tipo: "evento", origem, idEvento: "F1", idVinculo: "V1", tipoFato: "ficha", dataEfeito: "2026-02-01", campos: {} };

  it("numero ⇒ inteiro; logico ⇒ sim/nao/true/false; percentual ⇒ texto decimal", () => {
    const u = unidade({ ...base, campos: { dependentes: "2", ativo: "Sim", aliquota: "11.5" } }, c);
    expect(u.tipo === "evento" && u.fatos[0]!.fato.conteudo).toEqual({ dependentes: 2, ativo: true, aliquota: "11.5" });
    const v = unidade({ ...base, campos: { ativo: "não" } }, c);
    expect(v.tipo === "evento" && v.fatos[0]!.fato.conteudo).toEqual({ ativo: false });
  });

  it.each([
    [{ dependentes: "2.5" }, /'2.5' não é inteiro/],
    [{ ativo: "talvez" }, /'talvez' não é lógico/],
    [{ aliquota: "11%" }, /'11%' não é decimal/],
  ])("recusa %o", (campos, esperado) => {
    expect(motivo({ ...base, campos }, c)).toMatch(esperado);
  });
});

describe("escolherVersaoDoTipo", () => {
  const posse = criarCatalogoTiposDeFato().porChave(TIPO_FATO_POSSE)!;
  const v = (versao: number, efeito: string, registro: string) => ({ ...posse.versoes[0]!, versao, dataEfeito: dataEfeito(efeito), dataRegistro: dataRegistro(registro) });
  const v1 = v(1, "2026-01-01", "2026-01-01T00:00:00Z");
  const v2 = v(2, "2027-01-01", "2026-06-01T00:00:00Z");
  // as duas ordens: o catálogo não promete ordenar as versões.
  const tipos: TipoFato[] = [{ ...posse, versoes: [v1, v2] }, { ...posse, versoes: [v2, v1] }];

  it.each(tipos)("vigente na data de efeito, com o catálogo mais recente (%#)", (tipo) => {
    expect(escolherVersaoDoTipo(tipo, dataEfeito("2026-05-01")).versao).toBe(1);
    expect(escolherVersaoDoTipo(tipo, dataEfeito("2027-02-01")).versao).toBe(2);
  });

  it.each(tipos)("fato anterior à primeira versão do tipo usa a primeira versão (%#)", (tipo) => {
    expect(escolherVersaoDoTipo(tipo, dataEfeito("2010-01-01")).versao).toBe(1);
  });
});

describe("assinaturaDoFato", () => {
  it("ignora o autor (o lote) e a ordem das chaves do conteúdo; muda com o conteúdo", () => {
    const u = unidade(vinculo);
    if (u.tipo !== "vinculo") throw new Error();
    const fato = u.fatos[0]!.fato;
    expect(assinaturaDoFato({ ...fato, autor: { tipo: "importacao", lote: "outro" } })).toBe(u.fatos[0]!.assinatura);
    expect(assinaturaDoFato({ ...fato, conteudo: { b: 1, a: [1, { d: 2, c: 3 }] } })).toBe(assinaturaDoFato({ ...fato, conteudo: { a: [1, { c: 3, d: 2 }], b: 1 } }));
    expect(assinaturaDoFato({ ...fato, conteudo: { cargo: "B7" } })).not.toBe(u.fatos[0]!.assinatura);
  });

  it("considera a grafia do amparo", () => {
    const u = unidade(evento);
    if (u.tipo !== "evento") throw new Error();
    const fato = u.fatos[0]!.fato;
    expect(assinaturaDoFato({ ...fato, amparo: Amparo.legado(fato.amparo!.tipo, "123/2026") })).not.toBe(u.fatos[0]!.assinatura);
  });
});
