/* Mesa Viva — cardápio AR (demonstração estática, sem backend). */
(() => {
"use strict";
const MENU = window.MESAVIVA_MENU || [];
const WA = "5582993188030";
const KEY = "mesaviva-demo-cart-v1";
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
const money = n => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const byId = new Map(MENU.map(p => [p.id, p]));
const CATS = [
  { id: "todos", label: "Todos" },
  { id: "salgados", label: "Salgados" },
  { id: "doces", label: "Doces" },
  { id: "bebidas", label: "Bebidas" }
];
const catLabel = Object.fromEntries(CATS.map(c => [c.id, c.label.toUpperCase()]));

// celular/tablet com chance de AR (a confirmação real vem de model-viewer.canActivateAR)
const isTouchMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const pageUrl = () => location.origin + location.pathname;
const qrSrc = (data, size) => "https://api.qrserver.com/v1/create-qr-code/?size=" + size + "x" + size + "&margin=4&data=" + encodeURIComponent(data);

let active = "todos", cart = {}, current = null, lastFocus = null, toastTimer;

/* ---------- toast ---------- */
function notice(t) {
  const el = $("#toast");
  el.textContent = t;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

/* ---------- cardápio ---------- */
function renderFilters() {
  $("#filters").innerHTML = CATS.map(c => {
    const n = c.id === "todos" ? MENU.length : MENU.filter(p => p.category === c.id).length;
    return '<button class="filter' + (c.id === active ? " selected" : "") + '" type="button" data-cat="' + c.id + '" aria-pressed="' + (c.id === active) + '">' + esc(c.label) + ' <small>' + n + '</small></button>';
  }).join("");
}
function renderMenu() {
  const list = MENU.filter(p => active === "todos" || p.category === active);
  $("#products").innerHTML = list.map((p, i) =>
    '<article class="product-card" style="animation-delay:' + (i * 60) + 'ms">' +
      '<button class="product-visual" type="button" data-view="' + esc(p.id) + '" aria-label="Ver ' + esc(p.name) + ' em 3D">' +
        '<img src="' + esc(p.poster) + '" alt="Modelo 3D de ' + esc(p.name) + '" width="360" height="360" loading="lazy">' +
        '<span class="badge-ar">3D • AR</span>' +
      '</button>' +
      '<div class="product-body">' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<p>' + esc(p.description) + '</p>' +
        '<div class="product-size">⤢ ' + esc(p.size) + '</div>' +
        '<div class="product-foot">' +
          '<strong class="product-price">' + money(p.price) + '</strong>' +
          '<button class="see" type="button" data-view="' + esc(p.id) + '"><span class="ar-ico" aria-hidden="true"></span>' + (isTouchMobile ? "Ver na mesa" : "Ver em 3D") + '</button>' +
          '<button class="add" type="button" data-add="' + esc(p.id) + '" aria-label="Adicionar ' + esc(p.name) + ' à sacola">+</button>' +
        '</div>' +
      '</div>' +
    '</article>'
  ).join("");
}

/* ---------- sacola ---------- */
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
  for (const [id, q] of Object.entries(saved)) if (byId.has(id) && Number.isInteger(q) && q > 0) cart[id] = Math.min(q, 99);
} catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch {} };
const count = () => Object.values(cart).reduce((a, b) => a + b, 0);
const total = () => MENU.reduce((s, p) => s + (cart[p.id] || 0) * p.price, 0);
function renderCart() {
  const items = MENU.filter(p => cart[p.id]);
  $("#cart-items").innerHTML = items.length ? items.map(p =>
    '<div class="cart-line"><img src="' + esc(p.poster) + '" alt="" width="58" height="58">' +
    '<div class="cart-line-info"><strong>' + esc(p.name) + '</strong><small>' + money(p.price * cart[p.id]) + '</small></div>' +
    '<div class="qty"><button type="button" data-dec="' + p.id + '" aria-label="Diminuir ' + esc(p.name) + '">−</button><span>' + cart[p.id] + '</span>' +
    '<button type="button" data-inc="' + p.id + '" aria-label="Aumentar ' + esc(p.name) + '">+</button></div></div>'
  ).join("") : '<div class="empty-cart">Sua sacola está vazia. Veja um prato na mesa e adicione aqui. 🍔</div>';
  $("#subtotal").textContent = money(total());
  $("#finish").disabled = !items.length;
  $$("[data-cart-count]").forEach(el => el.textContent = count());
}
function change(id, d) {
  if (!byId.has(id)) return;
  const n = Math.max(0, Math.min(99, (cart[id] || 0) + d));
  if (n) cart[id] = n; else delete cart[id];
  save(); renderCart();
  if (d > 0) notice(byId.get(id).name + " na sacola!");
}
function openCart() {
  lastFocus = document.activeElement;
  $("#backdrop").hidden = false;
  $("#drawer").classList.add("open");
  $("#drawer").setAttribute("aria-hidden", "false");
  document.body.classList.add("locked");
  setBar("sacola");
  $("#drawer .close").focus();
}
function closeCart() {
  $("#drawer").classList.remove("open");
  $("#drawer").setAttribute("aria-hidden", "true");
  $("#backdrop").hidden = true;
  if (!current) document.body.classList.remove("locked");
  setBar(currentSection);
  lastFocus?.focus?.();
}
function checkout(e) {
  e.preventDefault();
  if (!count()) return notice("Escolha um prato primeiro.");
  if (!$("#order-form").reportValidity()) return;
  const name = $("#customer").value.trim(), table = $("#table").value.trim(), notes = $("#notes").value.trim();
  const lines = [
    "🍽️ *MESA VIVA — PEDIDO PELA DEMONSTRAÇÃO*",
    "Mensagem para o desenvolvedor (restaurante e preços fictícios).",
    "",
    "*Cliente:* " + name,
    "*Mesa:* " + table,
    "*Itens:*",
    ...MENU.filter(p => cart[p.id]).map(p => "• " + cart[p.id] + "x " + p.name + " — " + money(cart[p.id] * p.price)),
    "",
    "*Total:* " + money(total()),
    notes ? "*Observações:* " + notes : "",
    "",
    "Pedido montado no cardápio em realidade aumentada."
  ].filter(Boolean).join("\n");
  location.href = "https://wa.me/" + WA + "?text=" + encodeURIComponent(lines);
}

/* ---------- visualizador 3D / AR ---------- */
const mv = $("#mv");
function bindProgress(el) {
  const bar = el.querySelector(".mv-progress");
  if (!bar) return;
  el.addEventListener("progress", ev => {
    const p = ev.detail.totalProgress;
    bar.style.setProperty("--p", (p * 100).toFixed(0) + "%");
    bar.classList.toggle("done", p >= 1);
  });
}
function updateArUi(el) {
  // no computador: mostra QR; no celular com AR: botão "Ver na minha mesa"
  const canAR = !!el.canActivateAR;
  if (el === mv) $("#viewer-qr").hidden = canAR || isTouchMobile;
  return canAR;
}
function openViewer(id, fromQr) {
  const p = byId.get(id);
  if (!p) return;
  current = p;
  lastFocus = document.activeElement;
  mv.setAttribute("alt", "Modelo 3D de " + p.name + " em tamanho real");
  mv.setAttribute("poster", p.poster);
  mv.setAttribute("camera-orbit", p.orbit || "30deg 70deg auto");
  mv.setAttribute("src", p.model);
  mv.querySelector(".mv-progress")?.classList.remove("done");
  $("#viewer-cat").innerHTML = "<i></i> " + esc(catLabel[p.category] || "");
  $("#viewer-title").textContent = p.name;
  $("#viewer-desc").textContent = p.description;
  $("#viewer-size").textContent = p.size;
  $("#viewer-price").textContent = money(p.price);
  $("#viewer-qr-img").src = qrSrc(pageUrl() + "?prato=" + p.id + "&ar=1", 240);
  $("#viewer-qr").hidden = isTouchMobile;
  const v = $("#viewer");
  v.hidden = false;
  v.setAttribute("aria-hidden", "false");
  document.body.classList.add("locked");
  $("#viewer .viewer-sheet .close").focus();
  const url = new URL(location.href);
  url.searchParams.set("prato", p.id);
  url.searchParams.delete("ar");
  history.replaceState(null, "", url);
  if (fromQr && isTouchMobile) setTimeout(() => notice("Toque em “Ver na minha mesa” ✨"), 700);
}
function closeViewer() {
  if (!current) return;
  current = null;
  const v = $("#viewer");
  v.hidden = true;
  v.setAttribute("aria-hidden", "true");
  if (!$("#drawer").classList.contains("open")) document.body.classList.remove("locked");
  const url = new URL(location.href);
  url.searchParams.delete("prato");
  url.searchParams.delete("ar");
  history.replaceState(null, "", url);
  lastFocus?.focus?.();
}
mv.addEventListener("load", () => updateArUi(mv));
for (const el of [mv, $("#hero-mv")]) {
  bindProgress(el);
  el.addEventListener("ar-status", ev => {
    if (ev.detail.status === "failed") notice("Este aparelho não abriu a realidade aumentada. Veja em 3D na tela.");
  });
}

/* hero: QR no computador */
function setupHero() {
  const hero = $("#hero-mv");
  const qr = $(".stage-qr");
  const apply = () => {
    const canAR = !!hero.canActivateAR;
    qr.hidden = canAR || isTouchMobile;
  };
  $("[data-qr='hero']").src = qrSrc(pageUrl() + "?prato=hamburguer&ar=1", 200);
  qr.hidden = isTouchMobile;
  hero.addEventListener("load", apply);
}

/* ---------- homebar ---------- */
let currentSection = "inicio";
function setBar(id) {
  const order = ["inicio", "cardapio", "sacola", "contato"];
  const i = Math.max(0, order.indexOf(id));
  const ind = $(".homebar-active");
  if (ind) ind.style.transform = "translateX(" + i * 100 + "%)";
  $$(".home-link").forEach(el => {
    const on = el.dataset.nav === id;
    el.classList.toggle("active", on);
    if (el.tagName === "A") on ? el.setAttribute("aria-current", "location") : el.removeAttribute("aria-current");
  });
}
function watchSections() {
  if (!("IntersectionObserver" in window)) return;
  const map = { inicio: "inicio", como: "inicio", cardapio: "cardapio", restaurantes: "contato", contato: "contato" };
  const ob = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting && map[e.target.id]) {
        currentSection = map[e.target.id];
        if (!$("#drawer").classList.contains("open")) setBar(currentSection);
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  ["inicio", "como", "cardapio", "restaurantes", "contato"].forEach(id => { const el = document.getElementById(id); if (el) ob.observe(el); });
}
function reveals() {
  if (!("IntersectionObserver" in window)) return $$(".reveal").forEach(el => el.classList.add("visible"));
  const ob = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); ob.unobserve(e.target); } }), { threshold: 0.08 });
  $$(".reveal").forEach(el => ob.observe(el));
}

/* ---------- eventos ---------- */
document.addEventListener("click", e => {
  const t = e.target.closest("button,a");
  if (!t) return;
  if (t.dataset.cat) { active = t.dataset.cat; renderFilters(); renderMenu(); return; }
  if (t.dataset.view) { openViewer(t.dataset.view); return; }
  if (t.dataset.add) { change(t.dataset.add, 1); return; }
  if (t.dataset.inc) { change(t.dataset.inc, 1); return; }
  if (t.dataset.dec) { change(t.dataset.dec, -1); return; }
  if (t.hasAttribute("data-open-cart")) { e.preventDefault(); openCart(); return; }
  if (t.hasAttribute("data-close-cart")) { closeCart(); return; }
  if (t.hasAttribute("data-close-viewer")) { closeViewer(); return; }
});
$(".viewer-backdrop").addEventListener("click", closeViewer);
$("#backdrop").addEventListener("click", closeCart);
$("#viewer-add").addEventListener("click", () => current && change(current.id, 1));
$("#order-form").addEventListener("submit", checkout);
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if ($("#drawer").classList.contains("open")) closeCart();
  else closeViewer();
});

/* ---------- início ---------- */
renderFilters();
renderMenu();
renderCart();
setupHero();
watchSections();
reveals();
const params = new URLSearchParams(location.search);
if (params.get("prato") && byId.has(params.get("prato"))) openViewer(params.get("prato"), params.get("ar") === "1");
})();
