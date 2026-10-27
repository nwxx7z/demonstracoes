/* No Tacho — demonstração estática, sem API, banco ou pedidos reais. */
(() => {
"use strict";
const PHONE="5582993188030",KEY="notacho_demo_cart_v2";
const source=window.NOTACHO_CATALOG;
const $=(q,r=document)=>r.querySelector(q);
const $$=(q,r=document)=>Array.from(r.querySelectorAll(q));
const money=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const norm=s=>String(s||"").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const safe=s=>String(s||"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
if(!Array.isArray(source))return;
const items=source.flatMap(([category,list],ci)=>list.map(([name,price,desc,icon],i)=>({id:ci+"-"+i,category,name,price,desc,icon})));
const byId=new Map(items.map(p=>[p.id,p]));
const cat=["Todos",...source.map(a=>a[0])];
const symbols={salad:"🥬",soup:"🥣",steak:"🥩",pot:"🥘",pastry:"🥟",seafood:"🐙",shrimp:"🍤",fish:"🐟",beef:"🍖",pasta:"🍝",rice:"🍚",fries:"🍟",bowl:"🥣",beer:"🍺",water:"💧",soda:"🥤",juice:"🍹",drink:"🍸",dessert:"🍮"};
let selected="Todos",query="",cart=[],lastFocus=null,observer=null;
try {
 const prior=JSON.parse(localStorage.getItem(KEY)||"[]");
 if(Array.isArray(prior))cart=prior.filter(p=>byId.has(p.id)&&Number.isInteger(p.qty)&&p.qty>0&&p.qty<=99);
}catch{}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(cart))}catch{}}
function total(){return cart.reduce((t,x)=>t+(byId.get(x.id)?.price||0)*x.qty,0)}
function cartCount(){return cart.reduce((n,x)=>n+x.qty,0)}
function counts(){$("#cartCountDesktop").textContent=String(cartCount());$("#cartCountMobile").textContent=String(cartCount())}
function icon(item){
 const parts={
  salad:'<path d="M20 52c-5-22 12-37 23-25 12-16 31 1 18 25z" fill="#64833f"/><path d="M41 24v33M30 38l10 9 13-12" stroke="#f4deb0" stroke-width="3" fill="none"/>',
  fish:'<path d="M15 41c18-21 38-21 49 0-11 21-31 21-49 0ZM64 41l12-14v28z" fill="#518c85"/><circle cx="32" cy="37" r="3" fill="#fff"/>',
  shrimp:'<path d="M60 21c-25-6-42 15-29 31 12 17 32 7 32-4" fill="none" stroke="#d47838" stroke-width="14" stroke-linecap="round"/><circle cx="58" cy="23" r="3" fill="#fff"/>',
  pot:'<path d="M14 39h54l-8 28H22z" fill="#884224"/><ellipse cx="41" cy="39" rx="30" ry="10" fill="#d69235"/><path d="M25 24q-6-9 3-17M43 24q-6-9 3-17M57 24q-6-9 3-17" stroke="#fff0c7" stroke-width="4" stroke-linecap="round" fill="none"/>',
  steak:'<path d="M19 46c-8-19 15-37 31-29 23 10 17 44-6 49-13 4-20-6-25-20z" fill="#a75230"/><ellipse cx="43" cy="42" rx="11" ry="9" fill="#f2c3a0"/>',
  dessert:'<path d="M23 60V43q0-18 18-18t18 18v17z" fill="#d88f49"/><path d="M17 60h48" stroke="#713e26" stroke-width="7" stroke-linecap="round"/><circle cx="41" cy="24" r="6" fill="#af4229"/>'
 };
 const shape=parts[item.icon]||'<circle cx="41" cy="42" r="29" fill="#e4b965"/><text x="41" y="54" text-anchor="middle" font-size="33">'+(symbols[item.icon]||"🍽️")+'</text>';
 return '<svg viewBox="0 0 82 82" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">'+shape+'</svg>';
}
function filters(){
 $("#categoryFilters").innerHTML=cat.map(c=>'<button type="button" class="filter-chip '+(c===selected?"active":"")+'" data-category="'+safe(c)+'" aria-pressed="'+String(c===selected)+'">'+safe(c)+'</button>').join("");
}
function menu(){
 const data=items.filter(p=>(selected==="Todos"||p.category===selected)&&norm(p.name+" "+p.desc).includes(query));
 $("#menuCount").textContent=data.length+" "+(data.length===1?"item":"itens");
 const target=$("#menuGrid");
 target.innerHTML=data.length?data.map(p=>
  '<article class="menu-card">'+
    '<div class="menu-card-icon">'+icon(p)+'</div>'+
    '<div class="menu-card-content"><div class="menu-card-top"><div><span class="menu-card-category">'+safe(p.category)+'</span><h3 class="menu-card-title">'+safe(p.name)+'</h3></div><strong class="menu-card-price">'+money(p.price)+'</strong></div>'+
    '<p class="menu-card-description">'+safe(p.desc)+'</p><div class="menu-card-actions"><button type="button" class="add-button" data-add="'+p.id+'" aria-label="Adicionar '+safe(p.name)+'">Adicionar +</button></div></div>'+
  '</article>').join(""):'<div class="empty-state">Nenhum prato encontrado. Experimente outro termo ou categoria.</div>';
}
function change(id,delta){
 const p=byId.get(id);if(!p)return;
 const item=cart.find(e=>e.id===id),qty=Math.min(99,Math.max(0,(item?.qty||0)+delta));
 if(item&&qty===0)cart=cart.filter(e=>e.id!==id);
 else if(item)item.qty=qty;
 else if(qty>0)cart.push({id,qty});
 persist();counts();drawCart();
}
function drawCart(){
 const c=$("#cartItems");c.innerHTML=cart.length?cart.map(x=>{
  const p=byId.get(x.id);
  return '<article class="cart-item"><div><h3>'+safe(p.name)+'</h3><p>'+money(p.price)+' cada</p><strong>'+money(p.price*x.qty)+'</strong></div>'+
   '<div class="cart-item-actions"><div class="quantity-controls"><button type="button" data-dec="'+x.id+'" aria-label="Diminuir '+safe(p.name)+'">−</button><span>'+x.qty+'</span><button type="button" data-inc="'+x.id+'" aria-label="Aumentar '+safe(p.name)+'">+</button></div></div></article>';
 }).join(""):'<div class="empty-cart">Sua sacola está vazia. Escolha um prato no cardápio! 🥘</div>';
 $("#cartTotal").textContent=money(total());
}
function openCart(){
 lastFocus=document.activeElement;$("#cartDrawer").classList.add("open");
 $("#cartDrawer").setAttribute("aria-hidden","false");$("#cartDrawer").setAttribute("role","dialog");$("#cartDrawer").setAttribute("aria-modal","true");
 $("#backdrop").hidden=false;document.body.classList.add("cart-open");
 $("#closeCart").focus();
}
function closeCart(){
 $("#cartDrawer").classList.remove("open");$("#cartDrawer").setAttribute("aria-hidden","true");
 $("#backdrop").hidden=true;document.body.classList.remove("cart-open");lastFocus?.focus?.();
}
function checkout(event){
 event.preventDefault();
 if(cartCount()===0){window.alert("Escolha ao menos um prato antes de continuar.");return}
 if(!$("#checkoutForm").reportValidity())return;
 const name=$("#customerName").value.trim(),delivery=$("#deliveryType").value,address=$("#customerAddress").value.trim(),note=$("#customerNotes").value.trim();
 if(!name){$("#customerName").focus();return}
 if(delivery==="entrega"&&!address){window.alert("Informe um endereço para consulta de entrega.");$("#customerAddress").focus();return}
 const text=[
 "🥘 *NO TACHO — PEDIDO DEMONSTRATIVO*",
 "Mensagem para o desenvolvedor; NÃO é pedido no restaurante.","",
 "*Nome:* "+name,
 "*Recebimento:* "+(delivery==="retirada"?"Retirada no local":"Entrega — confirmar disponibilidade"),
 address?"*Endereço/referência:* "+address:"",
 "*Itens:*",...cart.map(x=>"• "+x.qty+"x "+byId.get(x.id).name+" — "+money(x.qty*byId.get(x.id).price)),
 "","*Subtotal:* "+money(total()),
 "*Frete:* A consultar",note?"*Observações:* "+note:"",
 "","⚠️ Esta é uma demonstração de front-end; confirmar cardápio, valores e disponibilidade com a loja."
 ].filter(Boolean).join("\n");
 const url="https://wa.me/5582993188030?text="+encodeURIComponent(text);
 const opened=window.open(url,"_blank","noopener,noreferrer");if(!opened)window.location.href=url;
}
function animate(){
 if("IntersectionObserver" in window){
  const ob=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("visible");ob.unobserve(e.target)}}),{threshold:.07});
  $$(".reveal").forEach(e=>ob.observe(e));
 }else $$(".reveal").forEach(e=>e.classList.add("visible"));
}
document.addEventListener("click",event=>{
 const add=event.target.closest("[data-add]");if(add)return change(add.dataset.add,1);
 const dec=event.target.closest("[data-dec]");if(dec)return change(dec.dataset.dec,-1);
 const inc=event.target.closest("[data-inc]");if(inc)return change(inc.dataset.inc,1);
 const f=event.target.closest("[data-category]");if(f){selected=f.dataset.category;filters();menu();return}
});
$("#searchInput").addEventListener("input",e=>{query=norm(e.target.value);menu()});
$("#clearFilters").addEventListener("click",()=>{selected="Todos";query="";$("#searchInput").value="";filters();menu()});
["openCartDesktop","openCartMobile","openCartBottom"].forEach(id=>$("#"+id)?.addEventListener("click",openCart));
$("#closeCart").addEventListener("click",closeCart);
$("#backdrop").addEventListener("click",closeCart);
$("#clearCart").addEventListener("click",()=>{cart=[];persist();counts();drawCart()});
$("#checkoutForm").addEventListener("submit",checkout);
$("#deliveryType").addEventListener("change",()=>{$("#customerAddress").required=$("#deliveryType").value==="entrega"});
document.addEventListener("keydown",e=>{
 if(!$("#cartDrawer").classList.contains("open"))return;
 if(e.key==="Escape"){closeCart();return}
 if(e.key==="Tab"){
  const all=$$('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)',$("#cartDrawer")).filter(n=>n.getClientRects().length);
  if(all.length&&e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all[all.length-1].focus()}
  else if(all.length&&!e.shiftKey&&document.activeElement===all[all.length-1]){e.preventDefault();all[0].focus()}
 }
});
const navlinks=$$(".mobile-bar a");
navlinks.forEach(el=>el.addEventListener("click",()=>{
 navlinks.forEach(a=>a.classList.toggle("active",a===el));
}));
filters();menu();counts();drawCart();animate();
})();
