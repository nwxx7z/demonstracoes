/* Big Lanche — DEMO isolada. Nenhuma chamada à API, Neon ou impressora do site verdadeiro. */
(() => {
"use strict";
const DATA=window.BIG_DEMO_DATA;
if(!DATA){document.querySelector("#result-count").textContent="Catálogo de demonstração indisponível.";return}
const PHONE="5582993188030",CART_KEY="biglanche_demo_cart_v1",ORDER_KEY="biglanche_demo_orders_v1",MENU_KEY="biglanche_demo_availability_v1",MODE_KEY="biglanche_demo_mode_v1";
const $=(q,parent=document)=>parent.querySelector(q),$$=(q,parent=document)=>Array.from(parent.querySelectorAll(q));
const brl=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const norm=s=>String(s??"").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const EDIT_KEY="biglanche_demo_custom_v1",HIDDEN_KEY="biglanche_demo_hidden_sections_v1";
let products=[];let byId=new Map();
function loadProducts(){
 const overrides=getJSON(EDIT_KEY,{});
 products=Object.entries(DATA.products).map(([id,p])=>({...p,...(overrides[id]||{}),id,section:overrides[id]?.section??Number(id.split("-")[0])}));
 for(const [id,p] of Object.entries(overrides)){if(id.startsWith("custom-")&&p.name&&Number.isFinite(Number(p.price)))products.push({...p,id,section:Number(p.section)});}
 products.sort((a,b)=>a.section-b.section||a.name.localeCompare(b.name,"pt-BR"));
 byId=new Map(products.map(p=>[p.id,p]));
}
function getJSON(key,fallback){try{const obj=JSON.parse(localStorage.getItem(key)||"null");return obj??fallback}catch{return fallback}}
function store(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
let cart=getJSON(CART_KEY,[]);if(!Array.isArray(cart))cart=[];
cart=cart.filter(x=>byId.has(x.id)&&Number.isInteger(x.qty)&&x.qty>=1&&x.qty<=99);
let blocked=getJSON(MENU_KEY,{});if(typeof blocked!=="object"||!blocked||Array.isArray(blocked))blocked={};
let chosen=null,quantity=1,filter=-1,term="",activeModal=null,lastFocus=null,activeNav=0,toastTimer;
const markers=["🍔","🍔","🌭","🍟","🍟","🍢","🥤","🍺","🍰","🥟","🍕","🥟","✨"];
const isBeverage=p=>p.section===6||p.section===7;
function itemSymbol(p){return markers[p.section]||"🍔"}
function showToast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2200)}
function subtotal(){return cart.reduce((sum,x)=>sum+x.qty*x.unitPrice,0)}
function count(){return cart.reduce((n,x)=>n+x.qty,0)}
function statusMode(){const mode=getJSON(MODE_KEY,"auto");if(mode==="closed")return "Loja fechada (demo)";if(mode==="open")return "Loja aberta (demo)";return "Modo automático (demo)"}
function updateStatus(){$("#store-status").textContent=statusMode()}
function setMobile(index){activeNav=index;const pill=$(".mobile-indicator");if(pill)pill.style.transform="translateX("+(index*100)+"%)";$$(".mobile-link").forEach((el,i)=>el.classList.toggle("active",index===i))}
function updateCount(){$$("[data-cart-count]").forEach(el=>el.textContent=String(count()))}
function categories(){
 const tabs=$("#category-tabs");
 tabs.innerHTML='<button type="button" data-category="-1" class="'+(filter===-1?"active":"")+'" aria-pressed="'+String(filter===-1)+'">✳ Todos</button>'+
 DATA.sections.map((name,i)=>'<button type="button" data-category="'+i+'" aria-pressed="'+String(filter===i)+'" class="'+(filter===i?"active":"")+'">'+esc(name)+'</button>').join("");
}
function render(){
 const hiddenSections=getJSON(HIDDEN_KEY,{});
 const visible=products.filter(p=>hiddenSections[p.section]!==true&&(filter<0||p.section===filter)&&norm(p.name+" "+(p.description||"")).includes(term));
 $("#result-count").textContent=visible.length+" produto"+(visible.length===1?"":"s")+" encontrado"+(visible.length===1?"":"s")+" • catálogo original: "+products.length;
 $("#products").innerHTML=visible.length?visible.map(p=>{
  const blockedItem=blocked[p.id]===false;
  return '<article class="product-card"><div class="food-art">'+
   (p.section<2?'<img src="./assets/burger.svg" alt="Ilustração genérica de hambúrguer" loading="lazy">':'<span class="food-icon" aria-hidden="true">'+itemSymbol(p)+'</span>')+
   '<span class="food-tag">'+esc(DATA.sections[p.section])+'</span></div>'+
   '<div class="product-copy"><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||"Personalize na próxima etapa.")+'</p>'+
   '<div class="price-row"><strong>'+brl(p.price)+'</strong>'+
   (blockedItem?'<button class="add" type="button" disabled title="Indisponível nesta demonstração" aria-label="'+esc(p.name)+' indisponível">×</button>':'<button type="button" class="add" data-open-product="'+esc(p.id)+'" aria-label="Personalizar '+esc(p.name)+'">+</button>')+
   '</div></div></article>';
 }).join(""):'<div class="empty">Nenhum item corresponde à busca. Experimente outra palavra.</div>';
 categories();
}
function getExtras(){return $$("#addon-area input:checked").map(el=>({name:el.value,price:Number(el.dataset.price)||0}))}
function flavorValue(){return $("#flavor-area select")?.value||""}
function selectedUnit(){return (chosen?.price||0)+getExtras().reduce((sum,x)=>sum+x.price,0)}
function detailTotals(){$("#detail-total").textContent=brl(selectedUnit()*quantity)}
function flavors(p){
 if(p.kind==="milkshake")return DATA.milkshakeFlavors;
 if(p.kind==="suco")return DATA.juiceFlavors;
 if(p.kind==="refrigerante"&&/sabor|refrigerante/i.test(p.name))return ["Cola","Guaraná","Laranja","Uva"];
 return [];
}
function productDialog(p){
 if(!p||blocked[p.id]===false)return;
 chosen=p;quantity=1;$("#quantity").textContent="1";$("#product-title").textContent=p.name;$("#detail-desc").textContent=p.description||"Selecione os detalhes do item.";
 const img=$("#detail-image");img.src="./assets/burger.svg";img.alt="Ilustração genérica de hambúrguer, não fotografia do produto";
 $("#item-note").value="";
 const f=flavors(p);
 $("#flavor-area").innerHTML=f.length?'<h3 class="option-title">Escolha o sabor</h3><label class="field">Sabor<select id="flavor-select" required><option value="">Selecione um sabor</option>'+f.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join("")+'</select></label>':"";
 const group=DATA.addons[p.addonGroup]||{};
 $("#addon-area").innerHTML=Object.keys(group).length?'<h3 class="option-title">Adicionais (opcionais)</h3><div class="addon-options">'+Object.entries(group).map(([name,item])=>
 '<label><input type="checkbox" data-price="'+Number(item.price)+'" value="'+esc(name)+'">'+esc(name)+' <b>+'+brl(item.price)+'</b></label>').join("")+'</div>':"";
 detailTotals();openModal("product");
}
function openModal(which){
 lastFocus=document.activeElement;activeModal=which;
 $("#veil").hidden=false;document.body.classList.add("dialog-open");
 for(const modal of ["product","cart"]){const el=$("#"+modal+"-modal");const opened=modal===which;el.classList.toggle("open",opened);el.setAttribute("aria-hidden",String(!opened))}
 if(which==="cart"){drawCart();setMobile(2)}
 $("#"+which+"-modal .close")?.focus();
}
function closeModal(){
 for(const m of ["product","cart"]){const el=$("#"+m+"-modal");el.classList.remove("open");el.setAttribute("aria-hidden","true")}
 $("#veil").hidden=true;document.body.classList.remove("dialog-open");activeModal=null;setMobile(activeNav===2?0:activeNav);lastFocus?.focus?.();
}
function detailsKey(id,extra,flavor,note){return JSON.stringify([id,extra.map(a=>a.name).sort(),flavor,note])}
function pushItem(){
 if(!chosen)return;
 if($("#flavor-area select")&&!$("#flavor-area select").value)return $("#flavor-area select").reportValidity();
 const addons=getExtras(),flavor=flavorValue(),note=$("#item-note").value.trim(),id=chosen.id,unitPrice=selectedUnit();
 const key=detailsKey(id,addons,flavor,note);
 const item=cart.find(x=>x.key===key);
 if(item)item.qty=Math.min(99,item.qty+quantity);
 else cart.push({key,id,name:chosen.name,unitPrice,basePrice:chosen.price,addons,flavor,note,qty:quantity});
 store(CART_KEY,cart);updateCount();closeModal();showToast(chosen.name+" adicionado à sacola ✓");
}
function drawCart(){
 const area=$("#cart-list");
 area.innerHTML=cart.length?cart.map((x,i)=>
  '<div class="cart-list-item"><div class="cart-symbol">'+itemSymbol(byId.get(x.id))+'</div><div class="cart-info"><strong>'+esc(x.name)+'</strong>'+
  '<small>'+[x.addons.map(a=>a.name).join(", "),x.flavor,x.note].filter(Boolean).map(esc).join(" • ")+'</small>'+
  '<small>'+x.qty+' × '+brl(x.unitPrice)+' = '+brl(x.qty*x.unitPrice)+'</small></div>'+
  '<div class="cart-counter"><button type="button" data-decrease="'+i+'" aria-label="Remover uma unidade">−</button><b>'+x.qty+'</b><button type="button" data-increase="'+i+'" aria-label="Adicionar uma unidade">+</button></div></div>').join(""):'<p class="empty-cart">Sua sacola está vazia. Escolha um lanche para começar! 🍔</p>';
 $("#cart-title-count").textContent=count();$("#checkout").disabled=!cart.length;$("#save-local").disabled=!cart.length;updateCount();updateTotal();
}
function changeCart(index,step){const x=cart[index];if(!x)return;x.qty=Math.max(0,Math.min(99,x.qty+step));if(x.qty===0)cart.splice(index,1);store(CART_KEY,cart);drawCart()}
function prepareDelivery(){
 const root=$("#delivery");root.innerHTML=Object.entries(DATA.deliveryFees).map(([name,price])=>'<option value="'+esc(name)+'">'+esc(name)+(price?" — "+brl(price):"")+'</option>').join("");
 $("#delivery-local").innerHTML='<option value="">Escolha a região...</option>'+Object.entries(DATA.deliveryLocalFees).map(([name,price])=>'<option value="'+esc(name)+'">'+esc(name)+' — '+brl(price)+'</option>').join("");
 root.insertAdjacentHTML("beforeend",'<option value="São Bento — localidades">São Bento — bairros e localidades</option>');
 deliveryChange();
}
function deliveryFee(){const place=$("#delivery").value;if(place==="São Bento — localidades")return DATA.deliveryLocalFees[$("#delivery-local").value]??0;return DATA.deliveryFees[place]??0}
function deliveryChange(){
 const place=$("#delivery").value,local=place==="São Bento — localidades",pickup=place==="Retirada no local";
 $("#local-area").hidden=!local;$("#delivery-local").required=local;
 $("#address-field").hidden=pickup;$("#address").required=!pickup;
 updateTotal();
}
function updateTotal(){$("#subtotal").textContent=brl(subtotal());$("#shipping").textContent=brl(deliveryFee());$("#grand-total").textContent=brl(subtotal()+deliveryFee())}
function validateOrder(){
 if(!cart.length){showToast("Adicione algum produto antes de continuar.");return false}
 if($("#delivery").value==="São Bento — localidades"&&!$("#delivery-local").value){$("#delivery-local").reportValidity();return false}
 return $("#checkout-form").reportValidity();
}
function orderData(){
 const name=$("#customer").value.trim(),delivery=$("#delivery").value,location=$("#delivery-local").value,address=$("#address").value.trim(),payment=$("#payment").value,note=$("#general-note").value.trim();
 return {id:"DEMO-"+Date.now().toString(36).toUpperCase(),createdAt:new Date().toISOString(),customer:name,delivery,locality:delivery==="São Bento — localidades"?location:"",address,payment,note,items:cart.map(x=>({...x})),subtotal:subtotal(),shipping:deliveryFee(),total:subtotal()+deliveryFee(),status:"recebido",demo:true};
}
function orderMessage(o){
 return ["🍔 *BIG LANCHE — PEDIDO DEMONSTRATIVO*",
 "⚠️ Este é um modelo visual: mensagem ao desenvolvedor, não ao restaurante.","",
 "*Cliente:* "+o.customer,"*Itens:*",
 ...o.items.map(x=>"• "+x.qty+"x "+x.name+(x.flavor?" ("+x.flavor+")":"")+" — "+brl(x.unitPrice*x.qty)+
 (x.addons.length?"\n   + "+x.addons.map(a=>a.name).join(", "):"")+(x.note?"\n   Obs.: "+x.note:"")),
 "","*Entrega:* "+o.delivery+(o.locality?" — "+o.locality:""),o.address?"*Endereço:* "+o.address:"",
 "*Pagamento:* "+o.payment,o.note?"*Observação geral:* "+o.note:"",
 "*Subtotal:* "+brl(o.subtotal),"*Taxa de referência:* "+brl(o.shipping),"*Total demonstrativo:* "+brl(o.total),
 "","Valores de um snapshot do catálogo, sujeitos à atualização. NÃO é um pedido real."].filter(Boolean).join("\n");
}
function submitWhatsApp(){
 if(!validateOrder())return;
 const msg=orderMessage(orderData()),url="https://wa.me/"+PHONE+"?text="+encodeURIComponent(msg);
 const opened=window.open(url,"_blank","noopener,noreferrer");if(!opened)window.location.href=url;
}
function saveKitchen(){
 if(!validateOrder())return;
 const order=orderData(),history=getJSON(ORDER_KEY,[]);
 const clean=Array.isArray(history)?history:[];
 clean.unshift(order);store(ORDER_KEY,clean.slice(0,200));showToast("Pedido salvo apenas nesta demo ✓");
 // Evita abrir o site real; a tela de cozinha usa localStorage separado.
 setTimeout(()=>{window.location.href="./kitchen/"},400);
}
function attach(){
 document.addEventListener("click",e=>{
  const b=e.target.closest("[data-open-product]");if(b)return productDialog(byId.get(b.dataset.openProduct));
  if(e.target.closest("[data-cart-open]"))return openModal("cart");
  if(e.target.closest("[data-close]")||e.target===$("#veil"))return closeModal();
  if(e.target.closest("#qty-plus")){quantity=Math.min(quantity+1,99);$("#quantity").textContent=quantity;return detailTotals()}
  if(e.target.closest("#qty-minus")){quantity=Math.max(quantity-1,1);$("#quantity").textContent=quantity;return detailTotals()}
  const inc=e.target.closest("[data-increase]"),dec=e.target.closest("[data-decrease]");
  if(inc)return changeCart(Number(inc.dataset.increase),1);
  if(dec)return changeCart(Number(dec.dataset.decrease),-1);
  const tab=e.target.closest("[data-category]");
  if(tab){filter=Number(tab.dataset.category);return render()}
  const link=e.target.closest("[data-mobile]");
  if(link)setMobile(link.dataset.mobile==="inicio"?0:1);
 });
 $("#search").addEventListener("input",e=>{term=norm(e.target.value);render()});
 $("#reset-catalog").addEventListener("click",()=>{filter=-1;term="";$("#search").value="";render()});
 $("#customize-form").addEventListener("submit",e=>{e.preventDefault();pushItem()});
 $("#addon-area").addEventListener("change",detailTotals);
 $("#flavor-area").addEventListener("change",detailTotals);
 $("#delivery").addEventListener("change",deliveryChange);
 $("#delivery-local").addEventListener("change",updateTotal);
 $("#checkout-form").addEventListener("submit",e=>{e.preventDefault();submitWhatsApp()});
 $("#save-local").addEventListener("click",saveKitchen);
 document.addEventListener("keydown",e=>{
  if(!activeModal)return;
  if(e.key==="Escape"){closeModal();return}
  if(e.key!=="Tab")return;
  const root=$("#"+activeModal+"-modal"),focusables=$$('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]',root).filter(x=>x.getClientRects().length);
  if(!focusables.length)return;
  if(e.shiftKey&&document.activeElement===focusables[0]){e.preventDefault();focusables[focusables.length-1].focus()}
  else if(!e.shiftKey&&document.activeElement===focusables[focusables.length-1]){e.preventDefault();focusables[0].focus()}
 });
 window.addEventListener("storage",e=>{if([MENU_KEY,EDIT_KEY,HIDDEN_KEY].includes(e.key)){blocked=getJSON(MENU_KEY,{});loadProducts();render()}if(e.key===MODE_KEY)updateStatus()});
}
function animate(){
 if("IntersectionObserver" in window){
  const o=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add("visible");o.unobserve(e.target)}},{threshold:.06});
  $$(".reveal").forEach(el=>o.observe(el));
 }else $$(".reveal").forEach(el=>el.classList.add("visible"));
}
loadProducts();prepareDelivery();render();drawCart();attach();updateStatus();animate();setMobile(0);
})();