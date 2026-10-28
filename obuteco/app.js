(()=>{"use strict";
const D=window.BUTECO_DATA;if(!D)return;
const P=D.items,PHONE="5582993188030",KEY="obuteco_demo_cart_v1",sections=[["pizzas","Pizzas","🍕"],["sanduiches","Sanduíches","🍔"],["petiscos","Petiscos","🍟"],["drinks","Drinks","🍹"],["torres","Torres de Chopp","🍺"],["bebidas","Bebidas e Sucos","🥤"],["destilados","Doses, Vinhos e Garrafas","🥃"]];
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const brl=n=>Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=s=>String(s??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const map=new Map(P.map(p=>[p.id,p])),icons=Object.fromEntries(sections.map(x=>[x[0],x[2]]));
const pizzaFlavors=P.filter(p=>p.category==="pizzas"&&p.prices);
const pizzaSelected={P:pizzaFlavors[0]?.id,G:pizzaFlavors[0]?.id};
let selectedPizzaSize="P";
let category="all",query="",chosen=null,quantity=1,activeDrawer="",lastFocus=null,activeNav="inicio",toastTimeout;
let cart;try{cart=JSON.parse(localStorage.getItem(KEY)||"[]")}catch{cart=[]}
if(!Array.isArray(cart))cart=[];
cart=cart.filter(x=>map.has(x.id)&&Number.isInteger(x.qty)&&x.qty>0&&Number.isFinite(x.unitPrice));
function save(){try{localStorage.setItem(KEY,JSON.stringify(cart))}catch{}}
function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("show");clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove("show"),2400)}
function nav(id){activeNav=id;const idx=id==="inicio"?0:id==="cardapio"?1:id==="sacola"?2:3;$(".mobile-indicator").style.transform="translateX("+(idx*100)+"%)";$$(".mobile-tab").forEach(el=>{const selected=id==="sacola"?el.hasAttribute("data-cart-open"):el.dataset.nav===id;el.classList.toggle("active",selected);if(el.tagName==="A"){if(selected)el.setAttribute("aria-current","location");else el.removeAttribute("aria-current")}})}
function count(){return cart.reduce((n,x)=>n+x.qty,0)}
function subtotal(){return cart.reduce((n,x)=>n+x.unitPrice*x.qty,0)}
function deliveryFee(){return cart.length&&$("#delivery").value==="Entrega"?D.deliveryFee:0}
function badge(){$$("[data-cart-count]").forEach(x=>x.textContent=count())}
function itemIcon(p){
 if(!p)return "🍽️";
 const name=norm(p.name),type=p.category;
 if(type==="pizzas")return "🍕";
 if(type==="sanduiches"){
  if(/passaporte|cachorro.?quente/.test(name))return "🌭";
  if(/misto|americano|beirute|file de frango|file de carne/.test(name))return "🥪";
  return "🍔";
 }
 if(type==="petiscos"){
  if(/batata/.test(name)&&!/file|calabresa/.test(name))return "🍟";
  if(/file|alcatra/.test(name))return "🥩";
  if(/paste/.test(name))return "🥟";
  if(/caldinho/.test(name))return "🥣";
  if(/torresmo/.test(name))return "🥓";
  if(/codorna/.test(name))return "🥚";
  if(/frios/.test(name))return "🧀";
  if(/calabresa/.test(name))return "🌭";
  return "🍽️";
 }
 if(type==="drinks")return "🍹";
 if(type==="torres")return "🍺";
 if(type==="bebidas"){
  if(/agua/.test(name))return "💧";
  if(/suco|laranja/.test(name))return "🧃";
  if(/heineken|amstel|budweiser|devassa|beats|ice/.test(name))return "🍺";
  if(/red bull/.test(name))return "⚡";
  return "🥤";
 }
 if(type==="destilados"){
  if(/baldinho/.test(name))return "🍺";
  if(/vinho|taca|pergola|morgado/.test(name))return "🍷";
  return "🥃";
 }
 return icons[type]||"🍽️";
}
function picture(p){
 if(p.image)return '<img src="'+esc(p.image)+'" alt="'+esc(p.name)+'" loading="lazy">';
 return '<span class="art-emoji" role="img" aria-label="Ícone ilustrativo de '+esc(p.name)+'">'+itemIcon(p)+'</span>';
}
function render(){
 const found=P.filter(p=>(category==="all"||p.category===category)&&norm(p.name+" "+p.description).includes(norm(query)));
 if(query.trim()){
  const match=found.find(p=>p.category==="pizzas");
  if(match){pizzaSelected.P=match.id;pizzaSelected.G=match.id}
 }
 $("#filters").innerHTML='<button type="button" class="filter'+(category==="all"?" active":"")+'" data-section="all" aria-pressed="'+String(category==="all")+'">✳ Todos <em>'+P.length+'</em></button>'+sections.map(([id,name,icon])=>'<button type="button" class="filter'+(category===id?" active":"")+'" data-section="'+id+'" aria-pressed="'+String(category===id)+'">'+icon+" "+esc(name)+' <em>'+(id==="pizzas"?pizzaFlavors.length:P.filter(p=>p.category===id).length)+"</em></button>").join("");
 $("#result-count").textContent=category==="pizzas"&&found.length?pizzaFlavors.length+" sabores • escolha Pequena ou Grande":found.length+" opção"+(found.length===1?"":"ões")+" do cardápio";
 const regularCard=p=>'<article class="product-card"><div class="art">'+picture(p)+'<span class="art-label">'+esc(sections.find(s=>s[0]===p.category)?.[1]||p.category)+'</span></div><div class="product-text"><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||"Toque para escolher e personalizar.")+'</p><div class="price-actions"><strong>'+brl(p.price)+'</strong><button type="button" data-product="'+esc(p.id)+'" aria-label="Personalizar '+esc(p.name)+'">+</button></div></div></article>';
 const pizzaCard=size=>{
  const p=map.get(pizzaSelected[size])||pizzaFlavors[0];
  if(!p)return "";
  const title=size==="P"?"Pizza Pequena":"Pizza Grande";
  const options=pizzaFlavors.map(f=>
   '<button type="button" class="pizza-flavor-option'+(f.id===p.id?' is-selected':'')+'" data-pizza-option="'+esc(f.id)+'" data-size="'+size+'" aria-pressed="'+String(f.id===p.id)+'">'+
   '<span class="pizza-flavor-name">'+esc(f.name)+'</span><strong class="pizza-flavor-value">'+brl(f.prices[size])+'</strong><span class="pizza-flavor-check" aria-hidden="true">'+(f.id===p.id?'✓':'')+'</span></button>'
  ).join("");
  return '<article class="product-card pizza-choice-card">'+
   '<div class="art pizza-choice-art"><span class="art-emoji pizza-only-icon" role="img" aria-label="Ícone de pizza">🍕</span><span class="art-label">'+(size==="P"?"TAMANHO P":"TAMANHO G")+'</span></div>'+
   '<div class="product-text pizza-choice-body"><h3>'+title+'</h3><p class="pizza-subtitle">Toque para escolher o sabor e conferir o preço.</p>'+
   '<div class="pizza-flavor-label" id="pizza-label-'+size+'">Sabor da pizza</div>'+
   '<details class="pizza-flavor-disclosure" data-pizza-disclosure="'+size+'">'+
   '<summary class="pizza-flavor-summary" aria-labelledby="pizza-label-'+size+' pizza-selected-'+size+'"><span class="pizza-selection-label" id="pizza-selected-'+size+'">'+esc(p.name)+'</span><span class="pizza-selection-price">'+brl(p.prices[size])+'</span><span class="pizza-chevron" aria-hidden="true">⌄</span></summary>'+
   '<div class="pizza-flavor-list" role="group" aria-label="Sabores de '+title+'">'+options+'</div></details>'+
   '<p class="pizza-ingredients" data-pizza-description>'+esc(p.description||"")+'</p>'+
   '<div class="pizza-price-label">Preço do sabor selecionado</div>'+
   '<div class="price-actions pizza-action"><strong data-pizza-price>'+brl(p.prices[size])+'</strong>'+
   '<button type="button" class="pizza-continue" data-pizza-size="'+size+'" aria-label="Continuar com '+title+' e escolher borda">ESCOLHER BORDA E PEDIR ↗</button></div></div></article>';
 };
 const groups=sections.map(([id,label,icon])=>({id,label,icon,items:found.filter(p=>p.category===id)})).filter(g=>g.items.length);
 $("#products").innerHTML=found.length?groups.map(g=>'<h3 class="group-title"><span class="group-icon">'+g.icon+'</span><span>'+esc(g.label)+'<small>'+(g.id==="pizzas"?pizzaFlavors.length+" sabores • escolha Pequena ou Grande":g.items.length+" itens")+'</small></span></h3>'+(g.id==="pizzas"?pizzaCard("P")+pizzaCard("G"):g.items.map(regularCard).join(""))).join(""):'<div class="empty">Nenhum produto encontrado. Experimente outra busca.</div>';
}
function show(kind){lastFocus=document.activeElement;activeDrawer=kind;$("#overlay").hidden=false;document.body.classList.add("drawer-open");["product","cart"].forEach(k=>{const e=$("#"+k+"-drawer");e.classList.toggle("open",k===kind);e.setAttribute("aria-hidden",String(k!==kind))});if(kind==="cart"){renderCart();nav("sacola")}$("#"+kind+"-drawer .close").focus()}
function close(){["product","cart"].forEach(k=>{const e=$("#"+k+"-drawer");e.classList.remove("open");e.setAttribute("aria-hidden","true")});$("#overlay").hidden=true;document.body.classList.remove("drawer-open");activeDrawer="";nav(activeNav==="sacola"?"inicio":activeNav);lastFocus?.focus?.()}
function chosenExtras(){return $$(".extra:checked").map(e=>({name:e.value,price:Number(e.dataset.price)}))}
function eachPrice(){
 if(!chosen)return 0;
 const base=chosen.prices?chosen.prices[selectedPizzaSize]:chosen.price;
 return base+(chosen.prices&&$('input[name="crust"]:checked')?.value?8:0)+chosenExtras().reduce((s,x)=>s+x.price,0);
}
function itemTotal(){$("#item-total").textContent=brl(eachPrice()*quantity)}
function choose(id,size="P"){
 const p=map.get(id);if(!p)return;
 chosen=p;selectedPizzaSize=p.prices?size:"P";quantity=1;$("#quantity").textContent="1";
 $("#product-title").textContent=p.prices?"Pizza "+(size==="P"?"Pequena":"Grande")+" • "+p.name:p.name;
 $("#detail-icon").textContent=itemIcon(p);$("#detail-desc").textContent=p.description||"Personalize seu produto.";$("#item-note").value="";
 $("#size-options").innerHTML=p.prices?
 '<h3 class="option-heading">Tamanho e sabor selecionados</h3><div class="pizza-selected"><strong>🍕 Pizza '+(size==="P"?"Pequena (P)":"Grande (G)")+'</strong><span>'+esc(p.name)+' — '+brl(p.prices[size])+'</span></div>'+
 '<h3 class="option-heading">Quer adicionar borda recheada?</h3><div class="option-pills"><label><input name="crust" type="radio" value="" checked> Sem borda</label><label><input name="crust" type="radio" value="Cheddar"> Cheddar +'+brl(8)+'</label><label><input name="crust" type="radio" value="Catupiry"> Catupiry +'+brl(8)+'</label></div>':"";
 const flavor=/^(Suco copo|Jarra de suco|Pastéis 170g|Nevada com fruta)/i.test(p.name);
 $("#flavor-options").innerHTML=flavor?'<h3 class="option-heading">Selecione o sabor</h3><label class="form-label">Sabor<select id="flavor" required><option value="">Escolha uma opção</option>'+(p.name.startsWith("Pastéis")?["Carne de sol","Frango","Queijo","Misto","Pizza","Calabresa"]:D.flavors).map(f=>'<option>'+esc(f)+'</option>').join("")+'</select></label>':"";
 $("#extras-options").innerHTML=p.category==="sanduiches"?'<h3 class="option-heading">Adicionais (opcionais)</h3><div class="extra-pills">'+D.extras.map(([name,price])=>'<label><input type="checkbox" class="extra" value="'+esc(name)+'" data-price="'+price+'">'+esc(name)+' +'+brl(price)+'</label>').join("")+'</div>':"";
 itemTotal();show("product");
}
function addProduct(){
 if(!chosen)return;
 if($("#flavor")&&!$("#flavor").value){$("#flavor").reportValidity();return}
 const size=chosen.prices?selectedPizzaSize:"",crust=$('input[name="crust"]:checked')?.value||"",flavor=$("#flavor")?.value||"",extras=chosenExtras(),note=$("#item-note").value.trim(),unitPrice=eachPrice();
 const key=JSON.stringify([chosen.id,size,crust,flavor,extras.map(x=>x.name).sort(),note]);
 const old=cart.find(x=>x.key===key);
 if(old)old.qty=Math.min(99,old.qty+quantity);else cart.push({key,id:chosen.id,name:chosen.name,size,crust,flavor,extras,note,unitPrice,qty:quantity});
 const name=chosen.name;save();badge();close();toast(name+" adicionado!");
}
function renderCart(){
 $("#cart-items").innerHTML=cart.length?cart.map((x,i)=>{
 const desc=[x.size?"Tamanho "+x.size:"",x.crust?"Borda "+x.crust:"",x.flavor,x.extras?.map(a=>a.name).join(", "),x.note].filter(Boolean).join(" • ");
 return '<div class="cart-line"><div class="cart-icon">'+itemIcon(map.get(x.id))+'</div><div class="cart-info"><strong>'+esc(x.name)+'</strong><small>'+esc(desc)+'</small><small>'+x.qty+' × '+brl(x.unitPrice)+' = '+brl(x.qty*x.unitPrice)+'</small></div><div class="cart-qty"><button type="button" data-minus="'+i+'" aria-label="Diminuir">−</button><b>'+x.qty+'</b><button type="button" data-plus="'+i+'" aria-label="Aumentar">+</button></div></div>';
 }).join(""):'<div class="empty-cart">Sua sacola está vazia. Escolha uma pizza ou outro item do cardápio para começar! 🍕</div>';
 $("#finish").disabled=cart.length===0;
 $("#subtotal").textContent=brl(subtotal());$("#shipping").textContent=brl(deliveryFee());$("#grand-total").textContent=brl(subtotal()+deliveryFee());badge();
}
function adjust(i,delta){const x=cart[i];if(!x)return;x.qty=Math.min(99,x.qty+delta);if(x.qty<1)cart.splice(i,1);save();renderCart()}
function setDelivery(){const pickup=$("#delivery").value==="Retirada";$("#address-label").hidden=pickup;$("#address").required=!pickup;renderCart()}
function checkout(e){
 e.preventDefault();if(!cart.length)return toast("Adicione itens antes de finalizar.");
 if(!$("#checkout-form").reportValidity())return;
 const name=$("#customer").value.trim(),delivery=$("#delivery").value,address=$("#address").value.trim(),payment=$("#payment").value,note=$("#order-note").value.trim();
 if(!name)return toast("Informe seu nome.");
 if(delivery==="Entrega"&&!address){$("#address").focus();return toast("Informe o endereço.");}
 const lines=[
 "🍕 *O BUTECO — PEDIDO DEMONSTRATIVO*",
 "⚠️ Encaminhado ao desenvolvedor, NÃO ao restaurante.","","*Cliente:* "+name,"*Itens:*",
 ...cart.map(x=>"• "+x.qty+"x "+x.name+(x.size?" — "+x.size:"")+(x.crust?" | Borda "+x.crust:"")+(x.flavor?" | "+x.flavor:"")+" — "+brl(x.unitPrice*x.qty)+(x.extras?.length?"\n Adicionais: "+x.extras.map(a=>a.name).join(", "):"")+(x.note?"\n Obs.: "+x.note:"")),
 "","*Subtotal:* "+brl(subtotal()),"*Entrega de referência:* "+brl(deliveryFee()),"*Total estimado:* "+brl(subtotal()+deliveryFee()),"*Recebimento:* "+delivery,address?"*Endereço:* "+address:"","*Pagamento:* "+payment,note?"*Observações:* "+note:"",
 "","Preços da foto sujeitos a confirmação. Nenhum pedido real foi registrado."].filter(Boolean).join("\n");
 window.location.href="https://wa.me/"+PHONE+"?text="+encodeURIComponent(lines);
}
document.addEventListener("click",e=>{
 const flavor=e.target.closest("[data-pizza-option]");
 if(flavor){
  const size=flavor.dataset.size,p=map.get(flavor.dataset.pizzaOption);
  if(!["P","G"].includes(size)||!p||!p.prices)return;
  pizzaSelected[size]=p.id;
  const card=flavor.closest(".pizza-choice-card");
  if(card){
   card.querySelector("[data-pizza-price]").textContent=brl(p.prices[size]);
   card.querySelector(".pizza-selection-price").textContent=brl(p.prices[size]);
   card.querySelector(".pizza-selection-label").textContent=p.name;
   card.querySelector("[data-pizza-description]").textContent=p.description||"";
   card.querySelectorAll("[data-pizza-option]").forEach(button=>{
    const selected=button.dataset.pizzaOption===p.id;
    button.classList.toggle("is-selected",selected);
    button.setAttribute("aria-pressed",String(selected));
    button.querySelector(".pizza-flavor-check").textContent=selected?"✓":"";
   });
   const disclosure=card.querySelector(".pizza-flavor-disclosure");
   if(disclosure)disclosure.open=false;
   card.querySelector(".pizza-flavor-summary")?.focus();
  }
  return;
 }
 const pizza=e.target.closest("[data-pizza-size]");if(pizza){const size=pizza.dataset.pizzaSize;return choose(pizzaSelected[size],size)}
 const product=e.target.closest("[data-product]");if(product)return choose(product.dataset.product);
 if(e.target.closest("[data-cart-open]"))return show("cart");
 if(e.target.closest("[data-close]")||e.target===$("#overlay"))return close();
 if(e.target.closest("#qty-plus")){quantity=Math.min(99,quantity+1);$("#quantity").textContent=quantity;return itemTotal()}
 if(e.target.closest("#qty-minus")){quantity=Math.max(1,quantity-1);$("#quantity").textContent=quantity;return itemTotal()}
 const plus=e.target.closest("[data-plus]");if(plus)return adjust(Number(plus.dataset.plus),1);
 const minus=e.target.closest("[data-minus]");if(minus)return adjust(Number(minus.dataset.minus),-1);
 const f=e.target.closest("[data-section]");if(f){category=f.dataset.section;return render()}
 if(e.target.closest("#reset")){category="all";query="";$("#search").value="";return render()}
 const n=e.target.closest("[data-nav]");if(n)nav(n.dataset.nav);
});
$("#search").addEventListener("input",e=>{query=e.target.value;render()});
$("#custom-form").addEventListener("submit",e=>{e.preventDefault();addProduct()});
$("#custom-form").addEventListener("change",itemTotal);
$("#delivery").addEventListener("change",setDelivery);
$("#checkout-form").addEventListener("submit",checkout);
document.addEventListener("keydown",e=>{
 if(!activeDrawer)return;if(e.key==="Escape")return close();if(e.key!=="Tab")return;
 const nodes=Array.from(document.querySelectorAll("#"+activeDrawer+"-drawer button:not(:disabled),#"+activeDrawer+"-drawer input:not(:disabled),#"+activeDrawer+"-drawer select:not(:disabled),#"+activeDrawer+"-drawer textarea:not(:disabled)")).filter(x=>x.getClientRects().length&&!x.closest("[hidden]"));
 if(!nodes.length)return;
 if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes[nodes.length-1].focus()}else if(!e.shiftKey&&document.activeElement===nodes[nodes.length-1]){e.preventDefault();nodes[0].focus()}
});
if("IntersectionObserver" in window){
 const o=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("visible");o.unobserve(entry.target)}}),{threshold:.05});
 $$(".reveal").forEach(x=>o.observe(x));
 const obs=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting&&!activeDrawer&&["inicio","cardapio","contato"].includes(entry.target.id))nav(entry.target.id)}),{rootMargin:"-20% 0px -65% 0px"});
 ["inicio","cardapio","contato"].forEach(id=>{const x=document.getElementById(id);if(x)obs.observe(x)});
}else $$(".reveal").forEach(x=>x.classList.add("visible"));
render();setDelivery();nav("inicio");
})();