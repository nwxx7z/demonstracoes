/* Fogazza da Nice — cardápio parcial baseado em capturas enviadas pelo usuário.
   Valores observados nos prints (não confirmados em tempo real).
   Itens indisponíveis nos prints permanecem visíveis, porém bloqueados.
   Canal WhatsApp do desenvolvedor: esta é uma demonstração, não um canal oficial do restaurante.
*/
(() => {
  "use strict";

  const WHATSAPP_DEMO = "5582993188030";
  const OFFICIAL_MENU = "https://whatsmenu.com.br/fogazzadanice";
  const categories = [
    {id:"todos",label:"Todos"},
    {id:"fogazza",label:"Fogazza"},
    {id:"doce",label:"Fogazza Doce"},
    {id:"especial",label:"Fogazza Especial"},
    {id:"bebidas",label:"Bebidas"},
    {id:"tres",label:"Especial 3 Sabores"},
    {id:"quatro",label:"Especial 4 Sabores"},
    {id:"massas",label:"Massas e Guloseimas"},
    {id:"passaporte",label:"Passaporte"},
    {id:"combo",label:"Combo"}
  ];
  // Cada linha: id, nome, descrição, categoria, preço R$, emoji ilustrativo, indisponível, informação incompleta.
  const raw = [
    ["f-pizza","Pizza","Queijo, presunto, molho e orégano","fogazza",7,"🍕",false,false],
    ["f-queijo","Queijo","","fogazza",7,"🧀",false,false],
    ["f-frango","Frango","","fogazza",7,"🍗",false,false],

    ["d-chocolate","Chocolate","","doce",7,"🍫",false,false],
    ["d-beijinho","Beijinho","","doce",7,"🥥",false,false],
    ["d-romeu","Romeu e Julieta","Queijo e goiabada","doce",7,"❤️",false,false],
    ["d-leite","Doce de Leite","Chocolate e beijinho (descrição exibida no print; confirmar)","doce",7,"🍯",false,true],

    ["e-alagoas-m","Alagoas Média","Frango, queijo, charque e dueto","especial",15,"🥟",false,false],
    ["e-alagoas-g","Alagoas Grande","Frango, queijo, charque e dueto","especial",19,"🥟",false,false],
    ["e-alagoas-t","Alagoas Turbo","Frango, queijo, charque e dueto","especial",23,"🥟",false,false],
    ["e-nordeste-m","Nordeste Média","Carne de sol, coalho, cebola e dueto","especial",15,"🥟",false,false],

    ["b-h2o500","H2O 500ml","","bebidas",7.5,"🥤",true,false],
    ["b-antarctica","Caçulinha Antarctica","","bebidas",3,"🥤",false,false],
    ["b-pepsi","Caçulinha Pepsi","","bebidas",3,"🥤",false,false],
    ["b-h2o350","H2O lata 350ml","","bebidas",6,"🥤",false,false],

    ["t-media","Fogazza Média","Especial 3 sabores — composição a combinar","tres",15,"🥟",false,true],
    ["t-grande","Grande","Especial 3 sabores — composição a combinar","tres",19,"🥟",false,true],
    ["t-turbo","Turbo","Especial 3 sabores — composição a combinar","tres",23,"🥟",false,true],

    ["q-media","Fogazza Média","Especial 4 sabores — composição a combinar","quatro",17,"🥟",false,true],
    ["q-grande","Grande","Especial 4 sabores — composição a combinar","quatro",21,"🥟",false,true],
    ["q-turbo","Turbo","Especial 4 sabores — composição a combinar","quatro",25,"🥟",false,true],

    ["m-coxinha","Coxinha de frango","","massas",7,"🍗",true,false],
    ["m-bolo-choc","Bolo no Copo 300ml Chocolate","","massas",10,"🍰",false,false],
    ["m-bolo-branco","Bolo no Copo 300ml Branco","","massas",10,"🍰",true,false],
    ["m-batata","Batatinha","","massas",11,"🍟",false,false],

    ["p-carne-alho","Passaporte de Carne com Molho de Alho","Pão seda, salsicha, carne moída, tomate e milho; demais ingredientes não visíveis","passaporte",22,"🥪",false,true],
    ["p-frango-alho","Passaporte de Frango com Molho de Alho","Pão seda, salsicha, frango, tomate e milho; demais ingredientes não visíveis","passaporte",22,"🥪",false,true],
    ["p-carne-sem","Passaporte de Carne sem Salsicha","Nome e descrição do molho cortados no print","passaporte",23,"🥪",false,true],

    ["c-pizza","3 Fogazzas de Pizza","Combo com 3 unidades","combo",18,"🥟",false,false],
    ["c-frango","3 Fogazzas de Frango","Combo com 3 unidades","combo",18,"🥟",true,false],
    ["c-frango-cat","3 Fogazzas de Frango Catupiry","Combo com 3 unidades","combo",21,"🥟",false,false],
    ["c-passaporte","Passaporte Especial com Molho de Alho + …","Nome do combo cortado no print","combo",26,"🥪",true,true]
  ];
  const products=raw.map(([id,name,desc,cat,price,emoji,unavailable,partial])=>({id,name,desc,cat,price,emoji,unavailable,partial}));
  const productMap=new Map(products.map(p=>[p.id,p]));
  const storageKey="fogazza-nice-demo-cart-screenshots-v2";
  const $=(sel,root=document)=>root.querySelector(sel);
  const $$=(sel,root=document)=>Array.from(root.querySelectorAll(sel));
  const brl=value=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
  const norm=value=>String(value).toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const escapeHTML=value=>String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  let cart={};
  try{
    const stored=JSON.parse(localStorage.getItem(storageKey)||"{}");
    if(stored&&typeof stored==="object"&&!Array.isArray(stored)){
      for(const [id,qty] of Object.entries(stored)){
        if(productMap.has(id)&&!productMap.get(id).unavailable&&Number.isInteger(qty)&&qty>0) cart[id]=Math.min(99,qty);
      }
    }
  }catch(e){/* localStorage pode estar indisponível; a sacola continua funcional */}
  let filter="todos",previousFocus=null,toastTimer=null,activeNav="inicio";

  function save(){try{localStorage.setItem(storageKey,JSON.stringify(cart))}catch(e){}}
  function toast(message){
    const el=$("#toast");el.textContent=message;el.classList.add("show");
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2500);
  }
  function count(){return Object.values(cart).reduce((sum,qty)=>sum+qty,0)}
  function subtotal(){return products.reduce((sum,p)=>sum+(cart[p.id]||0)*p.price,0)}
  function productArtwork(p){
    if(p.cat==="bebidas"||p.cat==="massas"||p.cat==="passaporte"){
      return '<div class="art-emoji" aria-hidden="true">'+p.emoji+'</div>';
    }
    return '<img src="./assets/fogazza.svg" alt="Ilustração genérica de fogazza; não é foto deste produto" loading="lazy">';
  }
  function drawCategories(){
    const target=$("#filters");
    target.innerHTML=categories.map(c=>
      '<button type="button" data-filter="'+c.id+'" aria-pressed="'+String(c.id===filter)+'" class="'+(c.id===filter?"selected":"")+'">'+escapeHTML(c.label)+'</button>'
    ).join("");
  }
  function drawProducts(){
    const query=norm($("#search").value.trim());
    const filtered=products.filter(p=>(filter==="todos"||p.cat===filter)&&norm(p.name+" "+p.desc+" "+p.cat).includes(query));
    $("#products").innerHTML=filtered.length?filtered.map(p=>
      '<article class="product-card'+(p.unavailable?" unavailable":"")+'">'+
        '<div class="product-image">'+
          '<span class="product-tag">'+escapeHTML(categories.find(c=>c.id===p.cat)?.label||"Item")+'</span>'+
          productArtwork(p)+
          (p.unavailable?'<span class="unavailable-flag">Indisponível no print</span>':'')+
        '</div>'+
        '<div class="product-body"><h3>'+escapeHTML(p.name)+'</h3>'+
          '<p>'+escapeHTML(p.desc||"Descrição não informada no print.")+(p.partial?' <span class="partial-label">Detalhes a confirmar.</span>':'')+'</p>'+
          '<div class="product-end"><div class="product-price"><small>Valor no print</small>'+brl(p.price)+'</div>'+
          (p.unavailable?'<button class="add" type="button" disabled aria-label="'+escapeHTML(p.name)+' indisponível">×</button>':
          '<button class="add" type="button" data-add="'+p.id+'" aria-label="Adicionar '+escapeHTML(p.name)+' à sacola">+</button>')+
          '</div></div>'+
      '</article>'
    ).join(""):'<p class="empty-results">Nenhum item encontrado. Experimente outro termo ou escolha “Todos”.</p>';
  }
  function updateCount(){
    $$("[data-count]").forEach(el=>el.textContent=String(count()));
  }
  function drawCart(){
    const items=products.filter(p=>cart[p.id]);
    $("#cart-items").innerHTML=items.length?items.map(p=>
      '<div class="cart-item">'+
      '<div class="cart-thumb">'+productArtwork(p)+'</div>'+
      '<div class="cart-detail"><strong>'+escapeHTML(p.name)+'</strong><small>'+cart[p.id]+' × '+brl(p.price)+' = '+brl(cart[p.id]*p.price)+'</small></div>'+
      '<div class="qty-controls"><button type="button" data-dec="'+p.id+'" aria-label="Diminuir '+escapeHTML(p.name)+'">−</button>'+
      '<span>'+cart[p.id]+'</span>'+
      '<button type="button" data-inc="'+p.id+'" aria-label="Aumentar '+escapeHTML(p.name)+'">+</button></div>'+
      '</div>'
    ).join(""):'<div class="cart-empty">Sua sacola está vazia. Escolha um sabor no cardápio para começar! 🥟</div>';
    $("#subtotal").textContent=brl(subtotal());
    $("#checkout").disabled=items.length===0;
    updateCount();
  }
  function changeQuantity(id,change){
    const item=productMap.get(id);
    if(!item||item.unavailable)return;
    const qty=Math.max(0,Math.min(99,(cart[id]||0)+change));
    if(qty===0)delete cart[id];else cart[id]=qty;
    save();drawCart();
    if(change>0)toast(item.name+" adicionado à sacola ✓");
  }
  function setPill(index){
    const pill=$(".active-pill");
    if(pill)pill.style.transform="translateX("+(index*100)+"%)";
  }
  function selectNav(id){
    activeNav=id;
    const cartTab=$('.mobile-toolbar [data-open-cart]');
    if(cartTab)cartTab.classList.remove("active");
    $$("[data-nav]").forEach(a=>{
      const selected=a.dataset.nav===id;
      a.classList.toggle("active",selected);
      if(selected)a.setAttribute("aria-current","location");else a.removeAttribute("aria-current");
    });
    setPill(id==="inicio"?0:id==="cardapio"?1:3);
  }
  function openCart(){
    previousFocus=document.activeElement;
    const drawer=$("#drawer"),overlay=$("#overlay");
    overlay.hidden=false;overlay.classList.add("open");
    drawer.classList.add("open");drawer.setAttribute("aria-hidden","false");
    document.body.classList.add("modal-open");
    $$(".toolbar-link").forEach(a=>a.classList.remove("active"));
    const cartTab=$('.mobile-toolbar [data-open-cart]');
    if(cartTab)cartTab.classList.add("active");
    setPill(2);
    $(".close").focus();
  }
  function closeCart(){
    const drawer=$("#drawer"),overlay=$("#overlay");
    drawer.classList.remove("open");drawer.setAttribute("aria-hidden","true");
    overlay.classList.remove("open");overlay.hidden=true;
    document.body.classList.remove("modal-open");
    selectNav(activeNav);
    if(previousFocus&&typeof previousFocus.focus==="function")previousFocus.focus();
  }
  document.addEventListener("click",event=>{
    const add=event.target.closest("[data-add]"),inc=event.target.closest("[data-inc]"),dec=event.target.closest("[data-dec]");
    if(add)return changeQuantity(add.dataset.add,1);
    if(inc)return changeQuantity(inc.dataset.inc,1);
    if(dec)return changeQuantity(dec.dataset.dec,-1);
    const category=event.target.closest("[data-filter]");
    if(category){
      filter=category.dataset.filter;
      drawCategories();drawProducts();
      return;
    }
    if(event.target.closest("[data-open-cart]"))return openCart();
    if(event.target.closest("[data-close-cart]")||event.target===$("#overlay"))return closeCart();
    const link=event.target.closest("[data-nav]");
    if(link)selectNav(link.dataset.nav);
  });
  $("#search").addEventListener("input",drawProducts);
  document.addEventListener("keydown",event=>{
    if(!$("#drawer").classList.contains("open"))return;
    if(event.key==="Escape")return closeCart();
    if(event.key!=="Tab")return;
    const items=$$('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)', $("#drawer"))
      .filter(el=>el.getClientRects().length>0);
    if(!items.length)return;
    if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items[items.length-1].focus()}
    else if(!event.shiftKey&&document.activeElement===items[items.length-1]){event.preventDefault();items[0].focus()}
  });
  $("#order-form").addEventListener("submit",event=>{
    event.preventDefault();
    if(count()===0)return toast("Adicione algum item antes de continuar.");
    if(!$("#order-form").reportValidity())return;
    const name=$("#customer").value.trim(),address=$("#address").value.trim(),note=$("#note").value.trim();
    if(!name)return toast("Preencha seu nome.");
    const orderLines=products.filter(p=>cart[p.id]).map(p=>"• "+cart[p.id]+"x "+p.name+" — "+brl(cart[p.id]*p.price));
    const message=[
      "🥟 *FOGAZZA DA NICE — PEDIDO DEMONSTRATIVO*",
      "Esta mensagem é destinada ao desenvolvedor, NÃO à loja.",
      "",
      "*Nome:* "+name,
      "*Itens capturados nos prints:*",
      ...orderLines,"",
      "*Subtotal nos prints:* "+brl(subtotal()),
      "*Entrega ou retirada:* a consultar",
      address?"*Bairro/endereço:* "+address:"",
      note?"*Observações:* "+note:"",
      "",
      "⚠️ PRÉVIA: disponibilidade, opções e preços devem ser confirmados no cardápio original.",
      OFFICIAL_MENU
    ].filter(Boolean).join("\n");
    const url="https://wa.me/"+WHATSAPP_DEMO+"?text="+encodeURIComponent(message);
    const win=window.open(url,"_blank","noopener,noreferrer");
    if(!win)window.location.href=url;
  });
  if("IntersectionObserver" in window){
    const revealObserver=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){entry.target.classList.add("visible");revealObserver.unobserve(entry.target)}
      });
    },{threshold:.07});
    $$(".reveal").forEach(el=>revealObserver.observe(el));
    const navObserver=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{if(entry.isIntersecting)selectNav(entry.target.id)});
    },{rootMargin:"-15% 0px -65% 0px"});
    ["inicio","cardapio","informacoes"].forEach(id=>{
      const section=document.getElementById(id);
      if(section)navObserver.observe(section);
    });
  }else{
    $$(".reveal").forEach(el=>el.classList.add("visible"));
  }
  drawCategories();drawProducts();drawCart();selectNav("inicio");
})();