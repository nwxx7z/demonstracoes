/* Mania Sushi — core front-end, sem backend ou bibliotecas de JS.
   Alterações de cardápio, bairros e WhatsApp ficam neste arquivo. */
(() => {
  "use strict";

  // IMPORTANTE: catálogo e fretes inteiramente fictícios para apresentação.
  const WHATSAPP = "5582993188030";
  const CATALOG = [
    { id: "uramaki", name: "Uramaki", category: "classicos", details: "Arroz por fora, alga e recheio especial. Porção ilustrativa de 8 peças.", price: 24.90, tag: "Clássico" },
    { id: "sashimi", name: "Sashimi", category: "classicos", details: "Fatias de salmão ao estilo tradicional. Porção ilustrativa de 6 peças.", price: 29.90, tag: "Fresco" },
    { id: "sushi-box", name: "Sushi Box", category: "especiais", details: "Uma caixinha cheia de sabores. Combinado ilustrativo de 14 peças.", price: 49.90, tag: "Para dividir" },
    { id: "futomaki", name: "Futomaki", category: "classicos", details: "Rolinho generoso de arroz, alga e recheio. Porção ilustrativa de 8 peças.", price: 25.90, tag: "Clássico" },
    { id: "temaki", name: "Temaki", category: "classicos", details: "Cone de alga com arroz e salmão. Porção ilustrativa de 1 unidade.", price: 28.90, tag: "Favorito" },
    { id: "niguiri", name: "Niguiri", category: "classicos", details: "Bolinho de arroz coberto com peixe. Porção ilustrativa de 6 peças.", price: 23.90, tag: "Delicado" },
    { id: "hot", name: "Hot", category: "quentes", details: "Rolinho crocante com recheio cremoso. Porção ilustrativa de 8 peças.", price: 26.90, tag: "Crocante" },
    { id: "dragon", name: "Dragon", category: "especiais", details: "Enrolado especial com cobertura marcante. Porção ilustrativa de 8 peças.", price: 31.90, tag: "Especial" },
    { id: "joy", name: "Joy", category: "especiais", details: "Peça delicada envolvida em salmão. Porção ilustrativa de 6 peças.", price: 29.90, tag: "Queridinho" },
    { id: "sandushi", name: "Sandushi", category: "quentes", details: "Sanduíche de sushi empanado e crocante. Porção ilustrativa de 2 peças.", price: 27.90, tag: "Diferente" }
  ];
  const NEIGHBORHOODS = [
    { name: "Itapoã", fee: 4 },
    { name: "Novo Horizonte", fee: 5 },
    { name: "Brasília", fee: 6 },
    { name: "Jardim Tropical", fee: 7 },
    { name: "Centro", fee: 8 },
    { name: "Capiatã", fee: 8 }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const brl = amount => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
  const normalize = value => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const SKU = new Map(CATALOG.map(product => [product.id, product]));
  const storageKey = "mania-sushi-demo-cart-v1";

  let cart = {};
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      for (const [id, qty] of Object.entries(saved)) {
        if (SKU.has(id) && Number.isInteger(qty) && qty > 0) cart[id] = Math.min(qty, 99);
      }
    }
  } catch { /* Modo privado sem storage: carrinho segue em memória. */ }

  let activeFilter = "todos";
  let lastFocused = null;
  let toastTimer;

  function persistCart() {
    try { localStorage.setItem(storageKey, JSON.stringify(cart)); } catch { /* continua sem persistência */ }
  }

  function sushiSvg(id) {
    return '<svg class="food-svg" viewBox="0 0 240 200" aria-hidden="true" focusable="false"><use href="./assets/sushi.svg#' + id + '"></use></svg>';
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
  }

  function renderMenu() {
    const search = normalize($("#search").value.trim());
    const matches = CATALOG.filter(product =>
      (activeFilter === "todos" || product.category === activeFilter) &&
      normalize(product.name + " " + product.details).includes(search)
    );
    $("#menu-grid").innerHTML = matches.length
      ? matches.map(product => '<article class="food-card">' +
        '<div class="food-image"><span class="food-badge">' + product.tag + '</span>' + sushiSvg(product.id) + '</div>' +
        '<div class="food-detail"><h3>' + product.name + '</h3><p>' + product.details + '</p>' +
        '<div class="food-price-row"><strong class="food-price">' + brl(product.price) + '</strong>' +
        '<button type="button" class="add-food" data-add="' + product.id + '" aria-label="Adicionar ' + product.name + ' à sacola">+</button>' +
        '</div></div></article>').join("")
      : '<p class="empty-menu">Nenhum item encontrado. Tente outro nome ou escolha “Todos”.</p>';
  }

  function cartQuantity() {
    return Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  }

  function subtotal() {
    return CATALOG.reduce((sum, item) => sum + item.price * (cart[item.id] || 0), 0);
  }

  function selectedNeighborhood() {
    return NEIGHBORHOODS.find(area => area.name === $("#delivery-neighborhood").value) || null;
  }

  function renderTotals() {
    const itemCount = cartQuantity();
    $$("[data-cart-count]").forEach(element => element.textContent = String(itemCount));
    $("#subtotal").textContent = brl(subtotal());
    const neighborhood = selectedNeighborhood();
    $("#shipping").textContent = neighborhood ? brl(neighborhood.fee) : "A escolher";
    $("#total").textContent = brl(subtotal() + (neighborhood ? neighborhood.fee : 0));
    $("#checkout").disabled = itemCount === 0;
  }

  function renderCart() {
    const selectedItems = CATALOG.filter(product => cart[product.id]);
    $("#cart-items").innerHTML = selectedItems.length
      ? selectedItems.map(product => '<div class="cart-item">' +
        '<div class="cart-mini">' + sushiSvg(product.id) + '</div>' +
        '<div class="cart-info"><strong>' + product.name + '</strong><small>' + brl(product.price * cart[product.id]) + '</small></div>' +
        '<div class="quantity">' +
        '<button type="button" data-dec="' + product.id + '" aria-label="Diminuir ' + product.name + '">−</button>' +
        '<span aria-label="' + cart[product.id] + ' unidade(s)">' + cart[product.id] + '</span>' +
        '<button type="button" data-inc="' + product.id + '" aria-label="Aumentar ' + product.name + '">+</button>' +
        '</div></div>').join("")
      : '<div class="cart-empty">Sua sacola está vazia. Escolha um sushi no cardápio para começar! 🍣</div>';
    renderTotals();
  }

  function updateItem(id, delta) {
    if (!SKU.has(id)) return;
    const count = Math.min(99, Math.max(0, (cart[id] || 0) + delta));
    if (count === 0) delete cart[id];
    else cart[id] = count;
    persistCart();
    renderCart();
    if (delta > 0) showToast(SKU.get(id).name + " adicionado à sacola ✓");
  }

  function openCart() {
    lastFocused = document.activeElement;
    $("#cart").classList.add("open");
    $("#cart").setAttribute("aria-hidden", "false");
    $(".scrim").classList.add("open");
    document.body.classList.add("cart-open");
    $(".close-cart").focus();
  }

  function closeCart() {
    $("#cart").classList.remove("open");
    $("#cart").setAttribute("aria-hidden", "true");
    $(".scrim").classList.remove("open");
    document.body.classList.remove("cart-open");
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function initializeDelivery() {
    $("#delivery-list").innerHTML = NEIGHBORHOODS.map(area =>
      '<div class="delivery-row"><span>' + area.name + '</span><strong>' + brl(area.fee) + '</strong></div>'
    ).join("");
    $("#delivery-neighborhood").insertAdjacentHTML(
      "beforeend",
      NEIGHBORHOODS.map(area => '<option value="' + area.name + '">' + area.name + ' — ' + brl(area.fee) + '</option>').join("")
    );
  }

  function submitOrder(event) {
    event.preventDefault();
    if (!cartQuantity()) return showToast("Adicione algum item antes de continuar.");
    const form = $("#order-form");
    if (!form.reportValidity()) return;
    const customer = $("#customer-name").value.trim();
    const address = $("#customer-address").value.trim();
    const neighborhood = selectedNeighborhood();
    if (!customer || !address || !neighborhood) return showToast("Preencha nome, endereço e bairro.");
    const note = $("#customer-note").value.trim();
    const list = CATALOG
      .filter(product => cart[product.id])
      .map(product => "• " + cart[product.id] + "x " + product.name + " — " + brl(product.price * cart[product.id]))
      .join("\n");

    const message = [
      "🍣 *MANIA SUSHI — PEDIDO DEMONSTRATIVO*",
      "",
      "*Cliente:* " + customer,
      "*Itens:*",
      list,
      "",
      "*Bairro:* " + neighborhood.name,
      "*Endereço:* " + address,
      "*Subtotal:* " + brl(subtotal()),
      "*Entrega ilustrativa:* " + brl(neighborhood.fee),
      "*Total ilustrativo:* " + brl(subtotal() + neighborhood.fee),
      note ? "*Observações:* " + note : "",
      "",
      "⚠️ *DEMONSTRAÇÃO:* produtos, preços e frete são exemplos. Confirme os valores e a disponibilidade antes de qualquer pedido."
    ].filter(Boolean).join("\n");
    const url = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(message);
    // Abertura em resposta direta ao envio; sem disparar mensagem automaticamente.
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) window.location.href = url;
  }

  // Delegação de eventos mantém os cards funcionais após as buscas/filtros.
  document.addEventListener("click", event => {
    const add = event.target.closest("[data-add]");
    const inc = event.target.closest("[data-inc]");
    const dec = event.target.closest("[data-dec]");
    const filter = event.target.closest("[data-filter]");
    if (add) return updateItem(add.dataset.add, 1);
    if (inc) return updateItem(inc.dataset.inc, 1);
    if (dec) return updateItem(dec.dataset.dec, -1);
    if (filter) {
      activeFilter = filter.dataset.filter;
      $$("[data-filter]").forEach(button => {
        const isActive = button === filter;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
      return renderMenu();
    }
    if (event.target.closest("[data-open-cart]")) return openCart();
    if (event.target.closest("[data-close-cart]")) return closeCart();
  });

  $("#search").addEventListener("input", renderMenu);
  $("#delivery-neighborhood").addEventListener("change", renderTotals);
  $("#order-form").addEventListener("submit", submitOrder);

  document.addEventListener("keydown", event => {
    if (!$("#cart").classList.contains("open")) return;
    if (event.key === "Escape") { closeCart(); return; }
    if (event.key !== "Tab") return;
    const focusables = $$('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)', $("#cart"))
      .filter(element => element.getClientRects().length);
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    $$(".reveal").forEach(element => revealObserver.observe(element));

    const mobileObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        $$("[data-nav]").forEach(link => link.classList.toggle("current", link.dataset.nav === entry.target.id));
      });
    }, { rootMargin: "-20% 0px -60% 0px" });
    ["inicio", "cardapio", "entregas"].forEach(id => {
      const section = document.getElementById(id);
      if (section) mobileObserver.observe(section);
    });
  } else {
    $$(".reveal").forEach(element => element.classList.add("visible"));
  }

  initializeDelivery();
  renderMenu();
  renderCart();
})();
