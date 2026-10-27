/* Recheada Burguer — demonstração estática. Sem pedidos reais, backend, impressão ou integrações não autorizadas. */
(() => {
"use strict";
const MENU=window.RECHEADA_MENU||[];
const WA="5582993188030";
const KEY="recheadob-demo-cart-v1";
const $=(sel,parent=document)=>parent.querySelector(sel);
const $$=(sel,parent=document)=>Array.from(parent.querySelectorAll(sel));
const money=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const normalize=s=>String(s||"").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const esc=s=>String(s||"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const byId=new Map(MENU.map(p=>[p.id,p]));
const icons={burger:"🍔",sandwich:"🥪",hotdog:"🌭",fries:"🍟",juice:"🥤",soda:"🥤",water:"💧"};
const CATEGORIES=[
 {id:"todos",label:"Todos",icon:"✳"},
 {id:"hamburgueres",label:"Hambúrgueres",icon:"🍔"},
 {id:"passaportes",label:"Passaportes",icon:"🥪"},
 {id:"cachorros-quentes",label:"Cachorros-quentes",icon:"🌭"},
 {id:"sanduiches",label:"Sanduíches e filés",icon:"🥪"},
 {id:"acompanhamentos",label:"Acompanhamentos",icon:"🍟"},
 {id:"sucos",label:"Sucos",icon:"🥤"},
 {id:"refrigerantes",label:"Refrigerantes",icon:"🥤"},
 {id:"agua",label:"Água",icon:"💧"}
];
const categoryMap=new Map(CATEGORIES.map(c=>[c.id,c]));
const categoryLabel=Object.fromEntries(CATEGORIES.map(c=>[c.id,c.label.toLocaleUpperCase("pt-BR")]));
function renderFilters(){
 $("#category-filters").innerHTML=CATEGORIES.map(c=>
 '<button class="filter'+(c.id===activeCategory?" selected":"")+'" type="button" data-category="'+c.id+'" aria-pressed="'+String(c.id===activeCategory)+'">'+
 '<span aria-hidden="true">'+c.icon+'</span> '+esc(c.label)+' <span class="filter-count">'+(c.id==="todos"?MENU.length:MENU.filter(p=>p.category===c.id).length)+'</span></button>'
 ).join("");
}
const getSaved=()=>{try{const data=JSON.parse(localStorage.getItem(KEY)||"{}");return data&&typeof data==="object"&&!Array.isArray(data)?data:{}}catch{return {}}};
let cart={};
for(const [id,quantity] of Object.entries(getSaved())){
 if(byId.has(id)&&Number.isInteger(quantity)&&quantity>0)cart[id]=Math.min(99,quantity);
}
let activeCategory="todos",query="",previousFocus=null,drawerOpen=false,activeNav="inicio",toastTimer;
function save(){try{localStorage.setItem(KEY,JSON.stringify(cart))}catch{}}
function totalCount(){return Object.values(cart).reduce((sum,q)=>sum+q,0)}
function subtotal(){return MENU.reduce((sum,p)=>sum+(cart[p.id]||0)*p.price,0)}
function notice(text){
 const toast=$("#toast");toast.textContent=text;toast.classList.add("show");
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2300);
}
function updateCount(){$$("[data-cart-count]").forEach(el=>el.textContent=String(totalCount()))}
function cardImage(p){
 if(p.image){
  // Troca futura das ilustrações: basta cadastrar image: "./assets/nome-da-foto.webp" no catalog.js.
  return '<img src="'+esc(p.image)+'" alt="Foto de '+esc(p.name)+'" loading="lazy">';
 }
 if(p.icon==="burger")return '<img src="./assets/burger-hero.svg" alt="Ilustração genérica de hambúrguer" loading="lazy">';
 return '<span class="product-emoji" role="img" aria-label="Ícone ilustrativo">'+(icons[p.icon]||"🍽️")+'</span>';
}
function render(){
 const list=MENU.filter(p=>(activeCategory==="todos"||p.category===activeCategory)&&normalize(p.name+" "+p.description).includes(normalize(query)));
 $("#result-count").textContent=list.length+" item"+(list.length===1?"":"s")+" • "+(activeCategory==="todos"?"Todas as categorias":categoryMap.get(activeCategory)?.label||"Cardápio");
 $$(".filter").forEach(btn=>{const selected=btn.dataset.category===activeCategory;btn.classList.toggle("selected",selected);btn.setAttribute("aria-pressed",String(selected))});
 const card=p=>
  '<article class="product-card">'+
   '<div class="product-visual">'+cardImage(p)+'<span class="product-tag">'+esc(categoryLabel[p.category])+'</span></div>'+
   '<div class="product-body"><h4>'+esc(p.name)+'</h4>'+
   '<p>'+esc(p.description||"Detalhes disponíveis mediante confirmação.")+'</p>'+
   '<div class="product-foot"><strong class="product-price">'+money(p.price)+'</strong>'+
   '<button type="button" class="add" data-add="'+esc(p.id)+'" aria-label="Adicionar '+esc(p.name)+' à sacola">+</button></div></div>'+
  '</article>';
 const groups=CATEGORIES.filter(c=>c.id!=="todos"&&(activeCategory==="todos"||activeCategory===c.id))
   .map(c=>({...c,items:list.filter(p=>p.category===c.id)})).filter(c=>c.items.length);
 $("#products").innerHTML=list.length?groups.map(c=>
  '<h3 class="category-heading"><span class="category-heading-icon" aria-hidden="true">'+c.icon+'</span><span>'+esc(c.label)+
  '<small>'+c.items.length+' '+(c.items.length===1?"opção":"opções")+'</small></span></h3>'+
  c.items.map(card).join("")
 ).join(""):'<div class="empty">Nenhum item encontrado. Experimente outra palavra ou escolha “Todos”.</div>';
}
function renderCart(){
 const selected=MENU.filter(p=>cart[p.id]>0);
 $("#cart-items").innerHTML=selected.length?selected.map(p=>
  '<div class="cart-line-item"><div class="cart-item-art">'+(icons[p.icon]||"🍽️")+'</div>'+
  '<div class="cart-item-info"><strong>'+esc(p.name)+'</strong><small>'+money(p.price*cart[p.id])+' • '+money(p.price)+' / unidade</small></div>'+
  '<div class="item-qty"><button type="button" data-decrease="'+p.id+'" aria-label="Diminuir '+esc(p.name)+'">−</button><span>'+cart[p.id]+'</span><button type="button" data-increase="'+p.id+'" aria-label="Aumentar '+esc(p.name)+'">+</button></div></div>'
 ).join(""):'<div class="empty-cart">A sacola está vazia. Escolha um lanche, bebida ou acompanhamento e volte aqui para finalizar! 🍔</div>';
 $("#subtotal").textContent=money(subtotal());
 $("#finish").disabled=selected.length===0;
 updateCount();
}
function change(id,delta){
 if(!byId.has(id))return;
 const next=Math.min(99,Math.max(0,(cart[id]||0)+delta));
 if(next)cart[id]=next;else delete cart[id];
 save();renderCart();
 if(delta>0)notice(byId.get(id).name+" adicionado à sacola!");
}
function setBar(id){
 activeNav=id;
 const index=id==="inicio"?0:id==="cardapio"?1:id==="sacola"?2:3;
 $(".homebar-active").style.transform="translateX("+(index*100)+"%)";
 $$(".home-link").forEach(el=>{
  const selected=(id==="sacola"&&el.hasAttribute("data-open-cart"))||el.dataset.nav===id;
  el.classList.toggle("active",selected);
  if(el.tagName==="A")selected?el.setAttribute("aria-current","location"):el.removeAttribute("aria-current");
 });
}
function openCart(){
 previousFocus=document.activeElement;
 $("#backdrop").hidden=false;
 $("#drawer").classList.add("open");$("#drawer").setAttribute("aria-hidden","false");
 document.body.classList.add("drawer-open");drawerOpen=true;setBar("sacola");
 $(".close").focus();
}
function closeCart(){
 $("#drawer").classList.remove("open");$("#drawer").setAttribute("aria-hidden","true");
 $("#backdrop").hidden=true;document.body.classList.remove("drawer-open");drawerOpen=false;setBar("inicio");
 previousFocus?.focus?.();
}
function checkout(event){
 event.preventDefault();
 if(totalCount()===0){notice("Escolha um item para finalizar.");return}
 if(!$("#order-form").reportValidity())return;
 const customer=$("#customer").value.trim(),delivery=$("#delivery").value,address=$("#address").value.trim(),notes=$("#notes").value.trim();
 if(!customer){notice("Informe seu nome.");$("#customer").focus();return}
 if(delivery==="Consultar entrega"&&!address){notice("Informe seu endereço para consultar entrega.");$("#address").focus();return}
 const lines=[
  "🍔 *RECHEADA BURGUER — PEDIDO PELA DEMONSTRAÇÃO*",
  "Mensagem para o desenvolvedor, não para o restaurante. Valores reproduzidos do vídeo e sujeitos a confirmação.",
  "",
  "*Cliente:* "+customer,
  "*Itens do pedido:*",
  ...MENU.filter(p=>cart[p.id]).map(p=>"• "+cart[p.id]+"x "+p.name+" — "+money(cart[p.id]*p.price)),
  "",
  "*Subtotal:* "+money(subtotal()),
  "*Taxa de entrega:* a confirmar",
  "*Recebimento:* "+delivery,
  address?"*Endereço:* "+address:"",
  notes?"*Observações:* "+notes:"",
  "",
  "⚠️ Nenhum pedido real foi registrado; confirme a disponibilidade e os preços com a loja."
 ].filter(Boolean).join("\n");
 const url="https://wa.me/"+WA+"?text="+encodeURIComponent(lines);
 // Redirecionamento direto no mobile evita bloqueios de pop-up.
 window.location.href=url;
}
function activateReveals(){
 if("IntersectionObserver" in window){
  const ob=new IntersectionObserver(entries=>entries.forEach(entry=>{
   if(entry.isIntersecting){entry.target.classList.add("visible");ob.unobserve(entry.target)}
  }),{threshold:.04});
  $$(".reveal").forEach(el=>ob.observe(el));
 }else $$(".reveal").forEach(el=>el.classList.add("visible"));
}
document.addEventListener("click",event=>{
 const add=event.target.closest("[data-add]");
 if(add)return change(add.dataset.add,1);
 const plus=event.target.closest("[data-increase]");
 if(plus)return change(plus.dataset.increase,1);
 const minus=event.target.closest("[data-decrease]");
 if(minus)return change(minus.dataset.decrease,-1);
 const category=event.target.closest("[data-category]");
 if(category){activeCategory=category.dataset.category;return render()}
 if(event.target.closest("#reset")){activeCategory="todos";query="";$("#search").value="";return render()}
 if(event.target.closest("[data-open-cart]"))return openCart();
 if(event.target.closest("[data-close-cart]")||event.target===$("#backdrop"))return closeCart();
 const nav=event.target.closest("[data-nav]");
 if(nav)setBar(nav.dataset.nav);
});
$("#search").addEventListener("input",event=>{query=event.target.value;render()});
$("#delivery").addEventListener("change",event=>{
 const isPickup=event.target.value==="Retirada no balcão";
 $("#address-label").hidden=isPickup;$("#address").required=!isPickup;
});
$("#order-form").addEventListener("submit",checkout);
document.addEventListener("keydown",event=>{
 if(!drawerOpen)return;
 if(event.key==="Escape"){closeCart();return}
 if(event.key!=="Tab")return;
 const focusables=$$("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",$("#drawer")).filter(el=>el.getClientRects().length);
 if(!focusables.length)return;
 const first=focusables[0],last=focusables[focusables.length-1];
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});
if("IntersectionObserver" in window){
 const observer=new IntersectionObserver(entries=>entries.forEach(e=>{
  if(e.isIntersecting&&e.target.id&&["inicio","cardapio","contato"].includes(e.target.id)&&!drawerOpen)setBar(e.target.id)
 }),{rootMargin:"-20% 0px -65% 0px"});
 ["inicio","cardapio","contato"].forEach(id=>{const el=document.getElementById(id);if(el)observer.observe(el)});
}
$("#address").required=true;
renderFilters();activateReveals();render();renderCart();setBar("inicio");
})();