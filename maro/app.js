/* Marô Restaurante — demo. Edite WHATSAPP e MENU com os dados oficiais. */
const WHATSAPP = '5582991688472';
const IMG = id => `https://images.unsplash.com/${id}?w=200&h=200&q=60&auto=format&fit=crop`;

// Placeholders: substitua nomes, descrições e preços pelo cardápio real.
const MENU = [
  { cat: 'Entradas', name: '[ENTRADA 1]', desc: '[Descrição da entrada]', price: '[PREÇO]', img: IMG('photo-1540189549336-e6e99c3679fe') },
  { cat: 'Entradas', name: '[ENTRADA 2]', desc: '[Descrição da entrada]', price: '[PREÇO]', img: IMG('photo-1512621776951-a57141f2eefd') },
  { cat: 'Pratos principais', name: '[PRATO PRINCIPAL 1]', desc: '[Descrição do prato]', price: '[PREÇO]', img: IMG('photo-1546069901-ba9599a7e63c') },
  { cat: 'Pratos principais', name: '[PRATO PRINCIPAL 2]', desc: '[Descrição do prato]', price: '[PREÇO]', img: IMG('photo-1504674900247-0877df9cc836') },
  { cat: 'Pratos principais', name: '[PRATO PRINCIPAL 3]', desc: '[Descrição do prato]', price: '[PREÇO]', img: IMG('photo-1490645935967-10de6ba17061') },
  { cat: 'Frutos do mar', name: '[FRUTOS DO MAR 1]', desc: '[Descrição do prato]', price: '[PREÇO]', img: IMG('photo-1565299624946-b28f40a0ae38') },
  { cat: 'Frutos do mar', name: '[FRUTOS DO MAR 2]', desc: '[Descrição do prato]', price: '[PREÇO]', img: IMG('photo-1466637574441-749b8f19452f') },
  { cat: 'Sobremesas', name: '[SOBREMESA 1]', desc: '[Descrição da sobremesa]', price: '[PREÇO]', img: IMG('photo-1414235077428-338989a2e8c0') },
  { cat: 'Bebidas', name: '[BEBIDA 1]', desc: '[Descrição da bebida]', price: '[PREÇO]', img: IMG('photo-1559339352-11d035aa65de') },
];

const qs = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];
const waLink = text => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let filter = 'Todos';

function renderFilters() {
  const cats = ['Todos', ...new Set(MENU.map(i => i.cat))];
  qs('#filters').innerHTML = cats.map(c =>
    `<button type="button" class="filter" data-cat="${esc(c)}" aria-pressed="${c === filter}">${esc(c)}</button>`).join('');
  qsa('.filter').forEach(b => b.addEventListener('click', () => { filter = b.dataset.cat; renderFilters(); renderMenu(); }));
}

function renderMenu() {
  const term = qs('#search').value.trim().toLowerCase();
  const items = MENU.filter(i => (filter === 'Todos' || i.cat === filter) &&
    (!term || (i.name + i.desc + i.cat).toLowerCase().includes(term)));
  if (!items.length) { qs('#menu').innerHTML = '<p class="empty">Nenhum prato encontrado. Tente outra busca.</p>'; return; }
  let html = '', last = '';
  items.forEach(i => {
    if (i.cat !== last) { html += `<h3 class="menu-cat">${esc(i.cat)}</h3>`; last = i.cat; }
    html += `<article class="dish"><img src="${i.img}" alt="Foto ilustrativa: ${esc(i.name)}" width="84" height="84" loading="lazy">
      <div><h3>${esc(i.name)}</h3><p>${esc(i.desc)}</p>
      <div class="dish-foot"><span class="price">${esc(i.price)}</span>
      <a href="${waLink(`Olá, Marô! Quero pedir: ${i.name}.`)}" target="_blank" rel="noopener noreferrer" aria-label="Pedir ${esc(i.name)} pelo WhatsApp">Pedir</a></div></div></article>`;
  });
  qs('#menu').innerHTML = html;
}

function initReserve() {
  const form = qs('#reserve-form');
  const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  form.data.min = today.toISOString().slice(0, 10);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const ok = d.nome.trim() && d.data && d.hora;
    qs('#form-error').hidden = !!ok;
    if (!ok) return;
    const data = d.data.split('-').reverse().join('/');
    const msg = `Olá, Marô! Gostaria de reservar uma mesa.\n\n👤 Nome: ${d.nome.trim()}\n📅 Data: ${data}\n🕒 Horário: ${d.hora}\n👥 Pessoas: ${d.pessoas}` + (d.obs.trim() ? `\n📝 Obs.: ${d.obs.trim()}` : '');
    window.open(waLink(msg), '_blank', 'noopener');
  });
}

function initToolbar() {
  const tabs = qsa('.tool-tab'), ind = qs('.nav-indicator');
  const set = id => tabs.forEach((t, i) => {
    const on = t.dataset.tab === id;
    t.classList.toggle('selected', on);
    if (on) { t.setAttribute('aria-current', 'page'); ind.style.transform = `translateX(${i * 100}%)`; }
    else t.removeAttribute('aria-current');
  });
  const map = { inicio: 'inicio', cardapio: 'cardapio', pratos: 'cardapio', cozinha: 'cardapio', depoimentos: 'reservas', reservas: 'reservas', localizacao: 'localizacao' };
  if (!('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && set(map[e.target.id])), { rootMargin: '-35% 0px -55% 0px' });
  Object.keys(map).forEach(id => qs('#' + id) && obs.observe(qs('#' + id)));
}

function initReveal() {
  if (!('IntersectionObserver' in window)) { qsa('.reveal').forEach(el => el.classList.add('visible')); return; }
  const obs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } }), { threshold: .08 });
  qsa('.reveal').forEach(el => obs.observe(el));
}

renderFilters();
renderMenu();
qs('#search').addEventListener('input', renderMenu);
initReserve();
initToolbar();
initReveal();
