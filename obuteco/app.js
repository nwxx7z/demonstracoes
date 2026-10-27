(()=>{"use strict";
const D=window.BUTECO_DATA;if(!D)return;
const P=D.items,PHONE="5582993188030",KEY="obuteco_demo_cart_v1",sections=[["pizzas","Pizzas","🍕"],["sanduiches","Sanduíches","🍔"],["petiscos","Petiscos","🍟"],["drinks","Drinks","🍹"],["torres","Torres de Chopp","🍺"],["bebidas","Bebidas e Sucos","🥤"],["destilados","Doses, Vinhos e Garrafas","🥃"]];
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const brl=n=>Number(n).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=s=>String(s??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const map=new Map(P.map(p=>[p.id,p])),icons=Object.fromEntries(sections.map(x=>[x[0],x[2]]));
let category="all",query="",chosen=null,quantity=1,activeDrawer="",lastFocus=null,activeNav="inicio",toastTimeout;
let cart;try{cart=JSON.parse(localStorage.getItem(KEY)||"[]")}catch{cart=[]}
if(!Array.isArray(cart))cart=[];
cart=cart.filter(x=>map.has(x.id)&&Number.isInteger(x.qty)&&x.qty>0&&Number.isFinite(x.unitPrice));
function save(){try{localStorage.setItem(KEY,JSON.stringify(cart))}catch{}}
function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("show");clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove("show"),2400)}
function nav(id){activeNav=id;const idx=id==="inicio"?0:id==="cardapio"?1:id==="sacola"?2:3;$(".mobile-indicator").style.transform="translateX("+(idx*100)+"%)";$$(".mobile-tab").forEach(el=>{const selected=id==="sacola"?el.hasAttribute("data-cart-open"):el.dataset.nav===id;el.classList.toggle("active",selected);if(el.tagName==="A"){if(selected)el.setAttribute("aria-current","location");else el.removeAttribute("aria-current")}})}
function count(){return cart.reduce((n,x)=>n+x.qty,0)}
function subtotal(){return cart.reduce((n,x)=>n+x.unitPrice*x.qty,0)}
function deliveryFee(){return $("#delivery").value==="Entrega"?D.deliveryFee:0}
function badge(){$$("[data-cart-count]").forEach(x=>x.textContent=count())}
function picture(p){if(p.image)return '<img src="'+esc(p.image)+'" alt="'+esc(p.name)+'" loading="lazy">';if(["pizzas","sanduiches"].includes(p.category))return '<img src="./assets/hero.svg" alt="Ilustração gastronômica" loading="lazy">';return '<span class="art-emoji" role="img" aria-label="Ícone do item">'+icons[p.category]+'</span>'}
function render(){
 const found=P.filter(p=>(category==="all"||p.category===category)&&norm(p.name+" "+p.description).includes(norm(query)));
 $("#filters").innerHTML='<button type="button" class="filter'+(category==="all"?" active":"")+'" data-section="all">✳ Todos <em>'+P.length+'</em></button>'+sections.map(([id,name,icon])=>'<button type="button" class="filter'+(category===id?" active":"")+'" data-section="'+id+'">'+icon+" "+esc(name)+' <em>'+P.filter(p=>p.category===id).length+"</em></button>").join("");
 $("#result-count").textContent=found.length+" produto"+(found.length===1?"":"s")+" encontrados";
 const card=p=>'<article class="product-card"><div class="art">'+picture(p)+'<span class="art-label">'+esc(sections.find(s=>s[0]===p.category)?.[1]||p.category)+'</span></div><div class="product-text"><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||"Toque para escolher e personalizar.")+'</p><div class="price-actions"><strong>'+(p.prices?"desde "+brl(p.prices.P):brl(p.price))+'</strong><button type="button" data-product="'+esc(p.id)+'" aria-label="Personalizar '+esc(p.name)+'">+</button></div></div></article>';
 const groups=sections.map(([id,label,icon])=>({id,label,icon,items:found.filter(p=>p.category===id)})).filter(g=>g.items.length);
 $("#products").innerHTML=found.length?groups.map(g=>'<h3 class="group-title"><span class="group-icon">'+g.icon+'</span><span>'+esc(g.label)+'<small>'+g.items.length+' itens</small></span></h3>'+g.items.map(card).join("")).join(""):'<div class="empty">Nenhum produto encontrado. Experimente outra busca.</div>';
}
function show(kind){lastFocus=document.activeElement;activeDrawer=kind;$("#overlay").hidden=false;document.body.classList.add("drawer-open");["product","cart"].forEach(k=>{const e=$("#"+k+"-drawer");e.classList.toggle("open",k===kind);e.setAttribute("aria-hidden",String(k!==kind))});if(kind==="cart"){renderCart();nav("sacola")}$("#"+kind+"-drawer .close").focus()}
function close(){["product","cart"].forEach(k=>{const e=$("#"+k+"-drawer");e.classList.remove("open");e.setAttribute("aria-hidden","true")});$("#overlay").hidden=true;document.body.classList.remove("drawer-open");activeDrawer="";nav(activeNav==="sacola"?"inicio":activeNav);lastFocus?.focus?.()}
function chosenExtras(){return $$(".extra:checked").map(e=>({name:e.value,price:Number(e.dataset.price)}))}
function eachPrice(){
 if(!chosen)return 0;
 const sz=$('input[name="size"]:checked')?.value||"P",base=chosen.prices?chosen.prices[sz]:chosen.price;
 return base+($('input[name="crust"]:checked')?.value?8:0)+chosenExtras().reduce((s,x)=>s+x.price,0);
}
function itemTotal(){$("#item-total").textContent=brl(eachPrice()*quantity)}
function choose(id){
 const p=map.get(id);if(!p)return;
 chosen=p;quantity=1;$("#quantity").textContent="1";$("#product-title").textContent=p.name;$("#detail-icon").textContent=icons[p.category];$("#detail-desc").textContent=p.description||"Personalize seu produto.";$("#item-note").value="";
 $("#size-options").innerHTML=p.prices?'<h3 class="option-heading">Tamanho da pizza</h3><div class="option-pills"><label><input type="radio" name="size" value="P" checked> Pequena — '+brl(p.prices.P)+'</label><label><input type="radio" name="size" value="G"> Grande — '+brl(p.prices.G)+'</label></div><h3 class="option-heading">Borda recheada (opcional)</h3><div class="option-pills"><label><input name="crust" type="radio" value="" checked> Sem borda</label><label><input name="crust" type="radio" value="Cheddar"> Cheddar +R$ 8,00</label><label><input name="crust" type="radio" value="Catupiry"> Catupiry +R$ 8,00</label></div>':"";
 const flavor=/^(Suco copo|Jarra de suco|Pastéis 170g|Nevada com fruta)/i.test(p.name);
 $("#flavor-options").innerHTML=flavor?'<h3 class="option-heading">Selecione o sabor</h3><label class="form-label">Sabor<select id="flavor" required><option value="">Escolha uma opção</option>'+(p.name.startsWith("Pastéis")?["Carne de sol","Frango","Queijo","Misto","Pizza","Calabresa"]:D.flavors).map(f=>'<option>'+esc(f)+'</option>').join("")+'</select></label>':"";
 $("#extras-options").innerHTML=p.category==="sanduiches"?'<h3 class="option-heading">Adicionais (opcionais)</h3><div class="extra-pills">'+D.extras.map(([name,price])=>'<label><input type="checkbox" class="extra" value="'+esc(name)+'" data-price="'+price+'">'+esc(name)+' +'+brl(price)+'</label>').join("")+'</div>':"";
 itemTotal();show("product");
}
function addProduct(){
 if(!chosen)return;
 if($("#flavor")&&!$("#flavor").value){$("#flavor").reportValidity();return}
 const size=chosen.prices?$('input[name="size"]:checked')?.value||"P":"",crust=$('input[name="crust"]:checked')?.value||"",flavor=$("#flavor")?.value||"",extras=chosenExtras(),note=$("#item-note").value.trim(),unitPrice=eachPrice();
 const key=JSON.stringify([chosen.id,size,crust,flavor,extras.map(x=>x.name).sort(),note]);
 const old=cart.find(x=>x.key===key);
 if(old)old.qty=Math.min(99,old.qty+quantity);else cart.push({key,id:chosen.id,name:chosen.name,size,crust,flavor,extras,note,unitPrice,qty:quantity});
 const name=chosen.name;save();badge();close();toast(name+" adicionado!");
}
function renderCart(){
 $("#cart-items").innerHTML=cart.length?cart.map((x,i)=>{
 const desc=[x.size?"Tamanho "+x.size:"",x.crust?"Borda "+x.crust:"",x.flavor,x.extras?.map(a=>a.name).join(", "),x.note].filter(Boolean).join(" • ");
 return '<div class="cart-line"><div class="cart-icon">'+icons[map.get(x.id)?.category]+'</div><div class="cart-info"><strong>'+esc(x.name)+'</strong><small>'+esc(desc)+'</small><small>'+x.qty+' × '+brl(x.unitPrice)+' = '+brl(x.qty*x.unitPrice)+'</small></div><div class="cart-qty"><button type="button" data-minus="'+i+'" aria-label="Diminuir">−</button><b>'+x.qty+'</b><button type="button" data-plus="'+i+'" aria-label="Aumentar">+</button></div></div>';
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