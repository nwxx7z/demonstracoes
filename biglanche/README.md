# Big Lanche — Reformulação visual (DEMONSTRAÇÃO ISOLADA)

Rota: `/biglanche/`. URL prevista no GitHub Pages: https://nwxx7z.github.io/demonstracoes/biglanche/

**Repositório original consultado SOMENTE EM LEITURA:** `nwxx7z/biglanchetestekitchen`. Nenhum arquivo, branch, deploy, API, impressão, conexão ou configuração do projeto original foi modificado.

## Origem do conteúdo
O arquivo `data.js` foi gerado a partir do snapshot de `api/_catalog.js` do repositório original; inclui **112 produtos**, preços, descrições, adicionais, taxas de entrega e sabores, distribuídos pelas seções originais. Esse catálogo não é sincronizado automaticamente: valores e disponibilidade podem ter mudado na loja verdadeira.

## Recursos da versão demonstrativa
- Hero animado, kinetic type, glassmorphism discreto, marca SVG sofisticada e mascote tático gamer em SVG **original, inspirado em jogos battle royale (não é personagem oficial de Free Fire/Garena)**.
- Cardápio, busca, categorias, miniaturas ilustrativas, adição ao carrinho.
- Configuração por item: adicionais com preço, sabores de sucos/milkshake, quantidade e observação.
- Checkout com nome, endereço, pagamento, frete e mensagem preparada para WhatsApp **5582993188030** (desenvolvedor; não o WhatsApp comercial original).
- Homebar inferior animada no mobile. Redução de movimento respeita `prefers-reduced-motion`.
- Cozinha demo em `/biglanche/kitchen/`, com pedidos locais, status, disponibilidade, modo de loja, alterações de produto, novas opções e visualização de cupom.

## Limites deliberados
Esta é uma **simulação puramente front-end**, hospedável em GitHub Pages. Os dados são armazenados no `localStorage` do navegador e podem ser apagados pelo próprio navegador. Não existe backend, autenticação de verdade, multiusuário, banco Neon, envio de pedidos à cozinha real, webhook, impressão automática, QZ Tray nem integração com WhatsApp Business. O botão de WhatsApp abre uma mensagem para revisão pelo usuário, mas não envia automaticamente.

Todas as imagens nesta versão são **ilustrações SVG locais**, não fotografias oficiais de produtos.

## Organização
- `index.html`, `style.css`, `app.js`, `data.js`.
- `assets/big-lanche-logo.svg`, `assets/gamer-mascot.svg`, `assets/burger.svg`.
- `kitchen/index.html`, `kitchen/kitchen.js`.

Habilite GitHub Pages para a branch `main` e pasta `/(root)`.
