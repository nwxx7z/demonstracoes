# Tempero do Japa — Demonstração

Página: `https://nwxx7z.github.io/demonstracoes/cardjapa/`

## Cardápio

Baseado somente no arquivo **CARDAPIO_TEMPERO_DO_JAPA.pdf** fornecido pelo usuário. O material tem 6 páginas, incluindo capa, jantar (página 2), comida japonesa (página 3), petiscos (página 4), bebidas (página 5) e uma página final com fotos, Pix e taxa de entrega (página 6).

O catálogo reúne **78 entradas**, mantendo duas entradas para Carpáccio e Ceviche porque elas aparecem tanto na seção Comida Japonesa quanto na seção Petiscos do PDF.

- Jantar: 7
- Sushis e combinados: 21
- Temakis: 6
- Pokes e especiais: 5
- Petiscos: 9
- Bebidas: 6
- Drinks e bar: 24

A taxa de entrega do cardápio fotografado é **R$ 3,00**. Preços e disponibilidade devem ser confirmados com o estabelecimento. Um item com leitura potencialmente ambígua é **Drink fruta com absolut — R$ 5,00**, conforme aparece na imagem; não se alterou o preço por presunção.

## Design e recursos

- Identidade autoral inspirada no logo e no vermelho/preto da capa, com marca SVG (`assets/brand.svg`), sushi ilustrado (`assets/sushi.svg`) e hashi (`assets/hashi.svg`).
- Hero, kinetic type, ticker e microinterações.
- **Cena interativa de hashi pegando sushi no scroll** entre a homepage e o cardápio. Atualiza exclusivamente `transform: translate3d/rotate` com `requestAnimationFrame`, um único listener `scroll` passivo, visibilidade por `IntersectionObserver` e respeito a `prefers-reduced-motion`. Não requer bibliotecas de animação, vídeo, WebGL ou backend.
- Cards e ícones ilustrativos substituíveis por fotos: basta adicionar `image: "./assets/foto.webp"` ao produto em `data.js`.
- Busca em tempo real, filtros por categoria, escolha de recheio quando o cardápio oferece opções, observações por item, quantidades, sacola local e formulário.
- Layout responsivo para celular e homebar fixa, com botão de carrinho e indicador deslizante.

## Aviso

**Esta não é a página oficial do Tempero do Japa.** Todos os links e pedidos demonstrativos vão ao **WhatsApp do desenvolvedor, +55 82 99318-8030**, e não ao telefone do restaurante indicado no cardápio. O pedido fica como texto pronto, para o usuário revisar; não há transmissão automática, pagamento, estoque, cozinha, impressão nem operações reais. A chave Pix fotografada **não é utilizada** nesta demo.

## Arquivos

`index.html`, `style.css`, `app.js`, `data.js`, `assets/brand.svg`, `assets/sushi.svg`, `assets/hashi.svg`.

GitHub Pages: publicar branch `main`, diretório `/(root)`.
