import { DataEfeito, DataRegistro } from "./competencia.js";

export interface ComVigencia {
  /** Data em que a versão passa a valer no mundo real ('YYYY-MM-DD', inclusiva). */
  readonly dataEfeito: DataEfeito;
  /** Data em que a versão deixa de valer no mundo real ('YYYY-MM-DD', exclusiva). */
  readonly dataFimEfeito?: DataEfeito;
  /** Timestamp ISO de quando a versão foi publicada/registrada no sistema — o `corte` filtra por isto. */
  readonly dataRegistro: DataRegistro;
}

/**
 * A função de resolução bitemporal do sistema — ÚNICA, compartilhada por regras, rubricas
 * e os seis catálogos (§5.3).
 *
 * Resolve qual é a única versão ativa de um item versionado para uma data do calendário (`em`),
 * considerando apenas o conhecimento registrado no sistema até determinado instante (`corte`).
 *
 * ### Parâmetros (os dois eixos do tempo):
 * - `versoes`: histórico de versões do item.
 * - `em` (`DataEfeito`): *"Para qual dia do calendário estou olhando?"* — data de referência no
 *   mundo real (ex.: último dia da competência sendo calculada, `'2026-01-31'`).
 * - `corte` (`DataRegistro`): *"Até qual momento do histórico do banco posso enxergar?"* —
 *   instante limite de conhecimento no sistema.
 *
 * ### Critérios de seleção:
 * 1. **Filtro de conhecimento (`corte`):** ignora versões registradas após o `corte` (`dataRegistro > corte`).
 * 2. **Filtro de vigência (`em`):** ignora versões que ainda não entraram em vigor (`dataEfeito > em`)
 *    ou que já expiraram (`dataFimEfeito <= em`).
 * 3. **Escolha e desempate:** entre as versões válidas restantes, vence a de **maior `dataEfeito`**
 *    (vigência mais recente até `em`). Em caso de empate na mesma `dataEfeito`, vence a de
 *    **maior `dataRegistro`** (retificação/publicação mais recente para aquela mesma vigência).
 *
 * ### Por que isso habilita o cálculo retroativo (§5.3)?
 * Para uma mesma competência (`em` fixo, ex.: `'2026-01-31'`), variar o `corte` responde a duas perguntas:
 * - **Como foi pago na época:** `corte` = instante em que a folha de janeiro foi fechada.
 * - **Como deveria ter sido pago (visão de hoje):** `corte` = agora (inclui reajustes/regras
 *   publicados em meses posteriores com `dataEfeito` retroativa a janeiro).
 *
 * A subtração entre os dois resultados é o valor retroativo.
 */
export function versaoVigente<V extends ComVigencia>(
  versoes: readonly V[], em: DataEfeito, corte: DataRegistro,
): V | undefined {
  let escolhida: V | undefined;
  for (const v of versoes) {
    if (v.dataRegistro > corte) continue;
    if (v.dataEfeito > em) continue;
    if (v.dataFimEfeito !== undefined && v.dataFimEfeito <= em) continue;

    const ganha =
      escolhida === undefined ||
      v.dataEfeito > escolhida.dataEfeito ||
      (v.dataEfeito === escolhida.dataEfeito && v.dataRegistro > escolhida.dataRegistro);
    if (ganha) escolhida = v;
  }
  return escolhida;
}