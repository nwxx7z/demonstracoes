# Recheada Burguer — demonstração (front-end puro)

Endereço de publicação: https://nwxx7z.github.io/demonstracoes/recheadob/

## Referência do catálogo

Foram transcritas **54 entradas** visíveis no vídeo enviado, com nomes e preços exibidos no catálogo da Recheada Burguer. A distribuição no site é:
- 38 comidas (burgers, sanduíches, passaportes, cachorro-quente);
- 14 bebidas (inclui duas entradas de suco de goiaba, que aparecem repetidas no vídeo);
- 2 acompanhamentos (batatas fritas).

Partes das descrições não eram visíveis devido ao truncamento na gravação. Esses casos foram preservados com reticências, sem completar ingredientes por suposição. As designações das porções pequena/grande decorrem do texto parcialmente visível; devem ser confirmadas. O preço/estoque pode ter mudado depois da gravação.

## Arquivos

- `index.html`: hero, identidade visual, seção de logo acima do cardápio, homebar, sacola e formulário.
- `style.css`: design preto, amarelo e branco, glassmorphism, kinetic type, animações com `prefers-reduced-motion`, media queries para celulares.
- `catalog.js`: produtos com `id`, `name`, `price`, `section`, `description` e `icon`.
- `app.js`: busca, filtros, itens, sacola persistente no `localStorage`, mensagem pronta e redirecionamento.
- `assets/logo.svg`: interpretação vetorial da logo mostrada no vídeo.
- `assets/burger-hero.svg`: hero vetorial original e leve.

Para trocar ícones por fotos: inclua o arquivo em `assets/` e configure `image: "./assets/foto.webp"` no objeto do produto em `catalog.js`.

## Segurança da demonstração

**Não é o site oficial da lanchonete.** Botões de WhatsApp direcionam para **5582993188030**, número do desenvolvedor informado pelo usuário. O pedido é exibido em forma de mensagem pronta para revisão no WhatsApp; não há checkout de pagamento, API, estoque em tempo real, impressão ou envio automático.

Publicar a branch `main` do repositório `nwxx7z/demonstracoes` via GitHub Pages no diretório `/(root)`.
