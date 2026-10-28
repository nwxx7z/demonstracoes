(()=>{"use strict";
const D=window.CARDJAPA_DATA;if(!D){document.getElementById("result-count").textContent="Não foi possível carregar o cardápio.";return}
const PHONE="5582993188030",KEY="cardjapa_demo_cart_v1",P=D.items;
const CATS=[["jantar","Pratos do jantar","🍽️"],["sushis","Sushis & combinados","🍣"],["temakis","Temakis","🍙"],["pokes","Pokes & especiais","🥗"],["petiscos","Petiscos","🍤"],["bebidas","Bebidas","🥤"],["bar","Drinks & bar","🍹"]];
const $=(s,root=document)=>root.querySelector(s),$$=(s,root=document)=>Array.from(root.querySelectorAll(s));
const escape=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const normalize=s=>String(s??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const money=v=>Number(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const byId=new Map(P.map(p=>[p.id,p]));
const icons={shrimp:"🍤",beef:"🥩",chicken:"🍗",fish:"🐟",roll:"🍣",joy:"🍣",hot:"🍣",nigiri:"🍣",sashimi:"🍣",temaki:"🍙",combo:"🍱",poke:"🥗",salad:"🥒",noodle:"🍜",fries:"🍟",water:"💧",beer:"🍺",soda:"🥤",cocktail:"🍹",spirit:"🥃",wine:"🍷"};
const imageKinds=new Set(["roll","joy","hot","nigiri","sashimi"]);
let filter="all",search="",selected=null,qty=1,activeDialog="",lastFocus=null,navId="inicio",toastTimer;
let cart=[];try{const saved=JSON.parse(localStorage.getItem(KEY)||"[]");if(Array.isArray(saved))cart=saved.filter(x=>byId.has(x.id)&&Number.isInteger(x.qty)&&x.qty>0&&x.qty<=99&&Number.isFinite(x.price)&&x.price>=0)}catch{}
function save(){try{localStorage.setItem(KEY,JSON.stringify(cart))}catch{}}
function count(){return cart.reduce((a,p)=>a+p.qty,0)}
function subtotal(){return cart.reduce((a,p)=>a+p.qty*p.price,0)}
function fee(){return cart.length&&$("#delivery").value==="Entrega"?D.deliveryFee:0}
function toast(s){const node=$("#toast");node.textContent=s;node.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove("show"),2200)}
function setNav(id){navId=id;const n=id==="inicio"?0:id==="cardapio"?1:id==="sacola"?2:3;$(".homebar-indicator").style.transform="translateX("+(n*100)+"%)";$$(".home-tab").forEach(el=>{const match=id==="sacola"?el.hasAttribute("data-open-cart"):el.dataset.nav===id;el.classList.toggle("active",match);if(el.tagName==="A")match?el.setAttribute("aria-current","location"):el.removeAttribute("aria-current")})}
function badge(){$$("[data-cart-count]").forEach(el=>el.textContent=String(count()))}
function cardImage(p){if(p.image)return '<img loading="lazy" alt="Foto de '+escape(p.name)+'" src="'+escape(p.image)+'">';
if(imageKinds.has(p.kind))return '<img loading="lazy" alt="Ilustração genérica de sushi" src="./assets/sushi.svg">';
return '<span class="card-emoji" aria-label="Ícone ilustrativo" role="img">'+(icons[p.kind]||"🍱")+'</span>'}
function render(){
 const items=P.filter(p=>(filter==="all"||p.category===filter)&&normalize(p.name+" "+p.description).includes(normalize(search)));
 $("#filters").innerHTML='<button type="button" class="filter'+(filter==="all"?" active":"")+'" data-cat="all" aria-pressed="'+String(filter==="all")+'">✳ Todos <em>'+P.length+'</em></button>'+
 CATS.map(([id,title,icon])=>'<button type="button" class="filter'+(filter===id?" active":"")+'" data-cat="'+id+'" aria-pressed="'+String(filter===id)+'">'+icon+' '+escape(title)+' <em>'+P.filter(p=>p.category===id).length+'</em></button>').join("");
 $("#result-count").textContent=items.length+" produto"+(items.length===1?"":"s")+" • "+(filter==="all"?"Todas as categorias":CATS.find(c=>c[0]===filter)?.[1]||"Cardápio");
 const card=p=>'<article class="card"><div class="card-art">'+cardImage(p)+'<span class="card-tag">'+escape(CATS.find(c=>c[0]===p.category)?.[1]||"Especial")+'</span></div><div class="card-body"><h3>'+escape(p.name)+'</h3><p>'+escape(p.description||"Toque para incluir na sacola e adicionar observações.")+'</p><div class="card-foot"><strong class="card-price">'+money(p.price)+'</strong><button type="button" class="card-add" data-product="'+escape(p.id)+'" aria-label="Adicionar '+escape(p.name)+' à sacola">+</button></div></div></article>';
 const groups=CATS.map(([id,title,icon])=>({id,title,icon,products:items.filter(p=>p.category===id)})).filter(g=>g.products.length);
 $("#products").innerHTML=items.length?groups.map(g=>'<h3 class="category-title"><span class="category-icon" aria-hidden="true">'+g.icon+'</span><span>'+escape(g.title)+'<small>'+g.products.length+' '+(g.products.length===1?"opção":"opções")+'</small></span></h3>'+g.products.map(card).join("")).join(""):'<div class="no-results">Não encontramos esse item. Experimente outro termo ou escolha “Todos”.</div>';
}
function show(kind){
 lastFocus=document.activeElement;activeDialog=kind;$("#overlay").hidden=false;document.body.classList.add("drawer-open");
 for(const k of ["item","cart"]){const el=$("#"+k+"-drawer");el.classList.toggle("open",k===kind);el.setAttribute("aria-hidden",String(k!==kind))}
 if(kind==="cart"){renderCart();setNav("sacola")}
 $("#"+kind+"-drawer .close").focus();
}
function close(){
 for(const k of ["item","cart"]){const el=$("#"+k+"-drawer");el.classList.remove("open");el.setAttribute("aria-hidden","true")}
 $("#overlay").hidden=true;document.body.classList.remove("drawer-open");activeDialog="";setNav(navId==="sacola"?"inicio":navId);lastFocus?.focus?.();
}
function choose(id){
 selected=byId.get(id);if(!selected)return;qty=1;
 $("#item-title").textContent=selected.name;$("#item-icon").textContent=icons[selected.kind]||"🍱";
 $("#item-desc").textContent=selected.description||"Personalize e adicione este item à sacola.";
 $("#item-quantity").textContent="1";$("#item-notes").value="";
 $("#item-options").innerHTML=selected.options?.length?
 '<h3 class="choice-head">'+escape(selected.label||"Escolha uma opção")+'</h3><div class="choice-grid">'+selected.options.map((opt,i)=>'<label><input type="radio" name="item-option" value="'+escape(opt)+'"'+(i===0?' checked':'')+'>'+escape(opt)+'</label>').join("")+'</div>':"";
 $("#item-total").textContent=money(selected.price);
 show("item");
}
function addItem(){
 if(!selected)return;
 const option=$('input[name="item-option"]:checked')?.value||"",note=$("#item-notes").value.trim();
 const key=JSON.stringify([selected.id,option,note]);
 const existing=cart.find(x=>x.key===key);
 if(existing)existing.qty=Math.min(99,existing.qty+qty);
 else cart.push({key,id:selected.id,price:selected.price,qty,option,note});
 const name=selected.name;save();badge();close();toast(name+" adicionado à sacola!");
}
function cartRows(){
 if(!cart.length)return '<div class="cart-empty">Sua sacola está vazia. Escolha um item do cardápio para começar! 🍣</div>';
 return cart.map((x,i)=>{
 const p=byId.get(x.id);return '<div class="line-item"><div class="line-icon">'+(icons[p.kind]||"🍱")+'</div><div class="line-data"><strong>'+escape(p.name)+'</strong><small>'+escape([x.option,x.note].filter(Boolean).join(" • "))+'</small><small>'+x.qty+' × '+money(x.price)+' = '+money(x.qty*x.price)+'</small></div><div class="line-qty"><button type="button" data-minus="'+i+'" aria-label="Diminuir quantidade">−</button><b>'+x.qty+'</b><button type="button" data-plus="'+i+'" aria-label="Aumentar quantidade">+</button></div></div>';
 }).join("");
}
function renderCart(){
 $("#cart-items").innerHTML=cartRows();$("#checkout").disabled=!cart.length;
 $("#subtotal").textContent=money(subtotal());$("#shipping").textContent=money(fee());$("#grand-total").textContent=money(subtotal()+fee());badge();
}
function changeQty(i,delta){const x=cart[i];if(!x)return;x.qty=Math.min(99,x.qty+delta);if(x.qty<1)cart.splice(i,1);save();renderCart()}
function switchDelivery(){const take=$("#delivery").value==="Retirada";$("#address-label").hidden=take;$("#address").required=!take;renderCart()}
function checkout(e){
 e.preventDefault();if(!cart.length)return toast("Escolha algum item antes de finalizar.");
 if(!$("#checkout-form").reportValidity())return;
 const name=$("#customer").value.trim(),delivery=$("#delivery").value,address=$("#address").value.trim(),payment=$("#payment").value,notes=$("#order-notes").value.trim();
 if(!name){$("#customer").focus();return toast("Preencha o seu nome.")}
 if(delivery==="Entrega"&&!address){$("#address").focus();return toast("Informe o endereço de entrega.")}
 const lines=[
 "🍣 *TEMPERO DO JAPA — PEDIDO DEMONSTRATIVO*",
 "⚠️ Mensagem para o desenvolvedor, não para o restaurante.",
 "", "*Cliente:* "+name, "*Itens:*",
 ...cart.map(x=>{const p=byId.get(x.id);return "• "+x.qty+"x "+p.name+(x.option?" | "+x.option:"")+" — "+money(x.qty*x.price)+(x.note?"\n   Observação: "+x.note:"")}),
 "", "*Subtotal:* "+money(subtotal()),"*Entrega (referência do cardápio):* "+money(fee()),"*Total estimado:* "+money(subtotal()+fee()),
 "*Recebimento:* "+delivery,delivery==="Entrega"?"*Endereço:* "+address:"","*Pagamento:* "+payment,notes?"*Observações:* "+notes:"",
 "", "Demonstração independente. Não há pedido real; confirmar itens, preços e entrega diretamente com o estabelecimento."
 ].filter(Boolean).join("\n");
 window.location.href="https://wa.me/"+PHONE+"?text="+encodeURIComponent(lines);
}
document.addEventListener("click",e=>{
 const product=e.target.closest("[data-product]");if(product)return choose(product.dataset.product);
 if(e.target.closest("[data-open-cart]"))return show("cart");
 if(e.target.closest("[data-close]")||e.target===$("#overlay"))return close();
 if(e.target.closest("#item-plus")){qty=Math.min(99,qty+1);$("#item-quantity").textContent=qty;$("#item-total").textContent=money(selected.price*qty);return}
 if(e.target.closest("#item-minus")){qty=Math.max(1,qty-1);$("#item-quantity").textContent=qty;$("#item-total").textContent=money(selected.price*qty);return}
 const plus=e.target.closest("[data-plus]");if(plus)return changeQty(Number(plus.dataset.plus),1);
 const minus=e.target.closest("[data-minus]");if(minus)return changeQty(Number(minus.dataset.minus),-1);
 const cat=e.target.closest("[data-cat]");if(cat){filter=cat.dataset.cat;return render()}
 if(e.target.closest("#reset")){filter="all";search="";$("#search").value="";return render()}
 const nav=e.target.closest("[data-nav]");if(nav)setNav(nav.dataset.nav);
});
$("#search").addEventListener("input",e=>{search=e.target.value;render()});
$("#item-form").addEventListener("submit",e=>{e.preventDefault();addItem()});
$("#checkout-form").addEventListener("submit",checkout);
$("#delivery").addEventListener("change",switchDelivery);
document.addEventListener("keydown",e=>{
 if(!activeDialog)return;
 if(e.key==="Escape"){close();return}if(e.key!=="Tab")return;
 const nodes=$$('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]',$("#"+activeDialog+"-drawer")).filter(el=>el.getClientRects().length&&!el.closest("[hidden]"));
 if(!nodes.length)return;
 const first=nodes[0],last=nodes[nodes.length-1];
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
});
// The hashi transition only updates compositor-friendly transforms, once per animation frame.
// No layout/height tween or per-item scroll listeners: smooth on mid-range Android.
function initFlight(){
 const scene=$("#sushi-flight"),sushi=$(".flight-sushi"),hashi=$(".flight-hashi");
 if(!scene||!sushi||!hashi)return;
 if(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches){
  sushi.style.transform="translate3d(0,-31px,0) rotate(-12deg)";
  hashi.style.transform="translate3d(-20px,8px,0) rotate(2deg)";return;
 }
 let requested=false,visible=true,last=-1;
 function update(){
  requested=false;if(!visible)return;
  const rect=scene.getBoundingClientRect(),h=window.innerHeight||800;
  const progress=Math.max(0,Math.min(1,(h*.94-rect.top)/(h*.94+rect.height*.55)));
  if(Math.abs(last-progress)<.007)return;last=progress;
  // first the chopsticks descend; then they lift the sushi together
  const descend=Math.min(1,progress/.49),lift=Math.max(0,(progress-.49)/.51);
  const grip=descend*descend*(3-2*descend);
  const elevate=lift*lift*(3-2*lift);
  hashi.style.transform="translate3d("+(-18*grip-19*elevate).toFixed(1)+"px,"+(-129+145*grip-68*elevate).toFixed(1)+"px,0) rotate("+(8-7*grip+5*elevate).toFixed(1)+"deg)";
  sushi.style.transform="translate3d("+(-16*elevate).toFixed(1)+"px,"+(-69*elevate).toFixed(1)+"px,0) rotate("+(-12*elevate).toFixed(1)+"deg)";
 }
 function schedule(){if(!requested&&visible){requested=true;requestAnimationFrame(update)}}
 if("IntersectionObserver" in window){
  const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting||entries[0].boundingClientRect.top<(window.innerHeight||800)&&entries[0].boundingClientRect.bottom>0;if(visible)schedule()},{rootMargin:"140px 0px 140px 0px"});io.observe(scene)
 }
 window.addEventListener("scroll",schedule,{passive:true});window.addEventListener("resize",schedule,{passive:true});
 schedule();
}
function initReveal(){
 if("IntersectionObserver" in window){const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("visible");observer.unobserve(e.target)}}),{threshold:.05});$$(".reveal").forEach(x=>observer.observe(x))}
 else $$(".reveal").forEach(x=>x.classList.add("visible"));
}
function initNav(){
 if(!("IntersectionObserver" in window))return;
 const ob=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting&&!activeDialog&&["inicio","cardapio","contato"].includes(e.target.id))setNav(e.target.id)}),{rootMargin:"-18% 0px -66% 0px"});
 for(const id of ["inicio","cardapio","contato"]){const el=document.getElementById(id);if(el)ob.observe(el)}
}
render();switchDelivery();setNav("inicio");initReveal();initNav();initFlight();
})();