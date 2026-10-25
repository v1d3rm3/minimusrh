import { describe, expect, it } from "vitest";
import { historiaIdDoVinculo, pessoaIdDoServidor, uuidV5 } from "./identidade.js";

describe("identidade derivada do legado (UUID v5)", () => {
  it("bate com o vetor de teste do UUID v5 (namespace DNS, 'www.example.com')", () => {
    expect(uuidV5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
  });

  it("é determinística e separa servidor de vínculo com o mesmo identificador", () => {
    expect(pessoaIdDoServidor("1001")).toBe(pessoaIdDoServidor("1001"));
    expect(pessoaIdDoServidor("1001")).not.toBe(historiaIdDoVinculo("1001"));
    expect(historiaIdDoVinculo("V1")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
