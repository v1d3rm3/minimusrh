#!/usr/bin/env node
import { criarPool } from "@minimusrh/persistencia";
import { executarCli } from "../cli.js";

// bin/importar.ts — ponto de entrada da CLI (`rushx importar -- --fonte csv --dir ... --lote ...`).
// Conexão pelas variáveis PG* do ambiente: `criarPool({})` deixa o `pg` lê-las.
process.exitCode = await executarCli(process.argv.slice(2), {
  criarPool: () => criarPool({}),
  escrever: (texto) => process.stdout.write(texto),
  escreverErro: (texto) => process.stderr.write(texto),
});
