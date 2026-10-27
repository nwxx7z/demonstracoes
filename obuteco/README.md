# O Buteco — Choperia & Pizzaria | Demonstração

Rota: `/obuteco/`. Publicação prevista: https://nwxx7z.github.io/demonstracoes/obuteco/

## Fonte do catálogo

Os nomes, descrições e preços foram transcritos das **nove fotografias fornecidas pelo usuário** (cardápio impresso do O Buteco, @o_butecoo). Itens:

- 15 sabores de pizzas com opções **P/G** e borda recheada **+ R$ 8,00** (cheddar ou catupiry).
- 16 sanduíches e 8 adicionais com preços.
- 14 petiscos, incluindo caldinhos, porções e pastéis de 170 g.
- 7 drinks.
- 4 opções de torre de cerveja (2L e 3L).
- 24 bebidas, sucos e cervejas.
- 26 doses, vinhos e garrafas.

**Total: 106 produtos cadastrados.** Os tamanhos P/G são selecionáveis em um único produto por sabor. A taxa de entrega de referência é **R$ 2,00**, conforme cardápio fotografado.

### Dados que devem ser conferidos
- As pizzas Filé com fritas e Nordestina: R$ 42,00 (P) e R$ 52,00 (G), valor parcialmente sobreposto nos prints.
- Os registros que na foto constam como "Baldinho Budweiser/Heineken", "51", "Sky", "Domus" etc. foram padronizados apenas para facilitar a leitura.
- A garrafa Red Label aparece como "200,000"; interpretada como **R$ 200,00**.
- Ingredientes, disponibilidade, preços e condições de entrega podem ter sido atualizados pelo estabelecimento.

## Interface e funções
- Identidade preta, amarela, vermelha, textura industrial, logo e hero vetoriais **originais**.
- Animações, kinetic type, glassmorphism, barra de navegação inferior no celular, `prefers-reduced-motion`.
- Busca, filtros por seção, ícones ilustrativos, cartões do menu.
- Personalização de pizza P/G e bordas, adicionais de sanduíches, sabores de sucos e pastéis, observações por item e quantidade.
- Carrinho com `localStorage`, escolha entrega/retirada, taxa demonstrativa, nome/endereço/pagamento/observações.
- Envio preparado para o **WhatsApp do desenvolvedor: 5582993188030**, nunca o WhatsApp do estabelecimento. Não envia a mensagem automaticamente.

## Segurança e limites

O site é **uma demonstração independente**, sem backend, APIs comerciais, estoque, impressão, cozinha, autenticação, integração com os pagamentos ou dados operacionais do estabelecimento. As imagens SVG são ilustrativas e podem ser substituídas por fotos em `assets/` usando `image: "./assets/foto.webp"` no objeto do produto em `data.js`.

## Arquivos
`index.html`, `style.css`, `app.js`, `data.js`, `assets/logo.svg`, `assets/hero.svg`.

Publicar a branch `main` com GitHub Pages usando `/(root)`.
