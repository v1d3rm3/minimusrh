Princípios do design

1. Ilegal = intipável. O que o conceitual proíbe, o sistema de tipos impede: Dinheiro não se mistura com number; fato não tem setter; estado de folha só transita pelos caminhos declarados.
2. Tudo que o conceitual versiona vira par Coisa + VersaoDeCoisa. Regra, rubrica, tipo de fato — mesmo padrão, sempre.
3. O domínio não conhece banco, HTTP, nem relógio. Nenhum new Date() sem parâmetro; toda referência temporal chega de fora (Decisão da DSL, §7.1 do conceitual, aplicada ao código host).
4. Interfaces de leitura, nunca de mutação. O domínio descreve; quem muda o mundo (append de fatos) é a persistência, pela porta única.