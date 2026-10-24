(() => {
  'use strict';
  const WHATSAPP = '5582993188030';
  const STORAGE = 'quintino-demo-cart-v1';
  const proteins = {
    especial: ['Parmegiana de frango', 'Frango recheado', 'Bife acebolado', 'Carne de sol'],
    tradicional: ['Fígado acebolado', 'Frango empanado', 'Frango grelhado', 'Galinha guisada', 'Boi guisado', 'Bisteca de porco', 'Peixe frito', 'Calabresa defumada']
  };
  const sides = ['Arroz', 'Macarrão', 'Batata frita', 'Feijão caseiro', 'Feijão tropeiro', 'Salada'];
  const products = [
    {id:'parmegiana',title:'Parmegiana de frango',kind:'marmitas',group:'especial',image:0,tag:'Queridinho'},
    {id:'recheado',title:'Frango recheado',kind:'marmitas',group:'especial',image:1,tag:'Especial'},
    {id:'bife',title:'Bife acebolado',kind:'marmitas',group:'especial',image:2,tag:'Caseiro'},
    {id:'carne-sol',title:'Carne de sol',kind:'marmitas',group:'especial',image:3,tag:'Regional'},
    {id:'figado',title:'Fígado acebolado',kind:'marmitas',group:'tradicional',image:4,tag:'Tradicional'},
    {id:'empanado',title:'Frango empanado',kind:'marmitas',group:'tradicional',image:5,tag:'Crocante'},
    {id:'grelhado',title:'Frango grelhado',kind:'marmitas',group:'tradicional',image:6,tag:'Levinho'},
    {id:'galinha',title:'Galinha guisada',kind:'marmitas',group:'tradicional',image:7,tag:'Receita da casa'},
    {id:'boi',title:'Boi guisado',kind:'marmitas',group:'tradicional',image:8,tag:'Caseiro'},
    {id:'bisteca',title:'Bisteca de porco',kind:'marmitas',group:'tradicional',image:9,tag:'Saboroso'},
    {id:'peixe',title:'Peixe frito',kind:'marmitas',group:'tradicional',image:10,tag:'Na medida'},
    {id:'calabresa',title:'Calabresa defumada',kind:'marmitas',group:'tradicional',image:11,tag:'Clássico'},
    {id:'cavalo',title:'Bife a cavalo com ovos fritos',kind:'marmitas',group:'cavalo',image:15,tag:'O clássico'},
    {id:'batata',title:'Batata frita',kind:'porcoes',group:'batata',image:12,tag:'Crocante'},
    {id:'batata-com',title:'Batata frita com calabresa e catupiry',kind:'porcoes',group:'batata-com',image:13,tag:'Para dividir'},
    {id:'feijoada',title:'Feijoada',kind:'feijoada',group:'feijoada',image:14,tag:'Sábados e domingos'}
  ];
  const catalog = new Map(products.map(p => [p.id,p]));
  const fees = {retirada:0,centro:5,brasilia:6,capiata:7,primavera:8};
  const deliveryNames = {retirada:'Retirada demonstrativa',centro:'Centro (Arapiraca)',brasilia:'Brasília (Arapiraca)',capiata:'Capiatã (Arapiraca)',primavera:'Primavera (Arapiraca)'};
  const prices = {especial:{p:18,g:23},tradicional:{p:17,g:22},cavalo:{p:19,g:24},batata:{p:14,g:25},'batata-com':{p:17,g:28},feijoada:{unico:28}};
  const qs = s => document.querySelector(s);
  const qsa = (s,root=document) => Array.from(root.querySelectorAll(s));
  const price = v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const normalize = t => t.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const imageStyle = img => `--x:${(img%4)/3*100}%;--y:${Math.floor(img/4)/3*100}%`;
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let cart = [];
  let activeFilter = 'todos';
  let draft = null;
  let lastFocus = null;
  let toastTimer = null;
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE) || '[]');
    if (Array.isArray(data)) cart = data.filter(x=>x&&catalog.has(x.id)&&Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=50&&['p','g','unico'].includes(x.size)&&Array.isArray(x.sides)).map(x=>({id:x.id,size:x.size,second:String(x.second||''),sides:x.sides.filter(s=>sides.includes(s)),quantity:x.quantity}));
  } catch { /* Storage indisponível no modo privado; o carrinho funciona em memória. */ }

  function saveCart(){try{localStorage.setItem(STORAGE,JSON.stringify(cart));}catch{}}
  function getUnit(item){const p=catalog.get(item.id);return p?prices[p.group]?.[item.size]||0:0;}
  function quantity(){return cart.reduce((s,x)=>s+x.quantity,0);}
  function subtotal(){return cart.reduce((s,x)=>s+x.quantity*getUnit(x),0);}
  function key(item){return [item.id,item.size,item.second,[...item.sides].sort().join('+')].join('|');}
  function toast(message){const node=qs('#toast');node.textContent=message;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),2300);}

  function itemCard(p){
    const minimum=prices[p.group].p??prices[p.group].unico;
    const about=p.kind==='marmitas' ? p.group==='cavalo'?'Marmita com bife e ovos fritos.':'Marmita com escolha de proteína e acompanhamentos.' : p.kind==='porcoes'?'Escolha a porção pequena ou grande.':'Feijoada de fim de semana.';
    return `<article class="food-card"><div class="food-img" style="${imageStyle(p.image)}" role="img" aria-label="Ilustração de ${esc(p.title)}"><span class="food-tag">${esc(p.tag)}</span></div><div class="food-content"><h4>${esc(p.title)}</h4><p>${about}</p><div class="food-footer"><span class="food-price"><small>${p.kind==='feijoada'?'Preço anunciado':'A partir de'}</small>${price(minimum)}</span><button type="button" class="add-product" data-product="${p.id}" aria-label="Escolher ${esc(p.title)}">+</button></div></div></article>`;
  }
  function renderMenu(){
    const q=normalize(qs('#search').value.trim());
    const visible=products.filter(p=>(activeFilter==='todos'||p.kind===activeFilter)&&normalize(p.title+' '+p.tag).includes(q));
    const groups=[['marmitas','🍱 Marmitas','Escolha uma ou duas opções de proteína'],['porcoes','🍟 Porções','Pequena ou grande, do jeito que você gosta'],['feijoada','🥘 Feijoada','Disponível aos sábados e domingos']];
    qs('#menu-results').innerHTML=visible.length?groups.map(([group,title,note])=>{
      const items=visible.filter(p=>p.kind===group);
      return items.length?`<section class="category-block" aria-label="${title}"><div class="category-heading"><h3>${title}</h3><small>${note}</small></div><div class="food-grid">${items.map(itemCard).join('')}</div></section>`:'';
    }).join(''):'<p class="no-results">Não encontramos esse prato. Tente outra busca ou escolha “Tudo”.</p>';
  }

  function showOverlay(id){
    const node=qs('#'+id);
    lastFocus=document.activeElement;
    node.hidden=false;
    document.body.classList.add('is-modal');
    const focus=node.querySelector('button:not([disabled]),input:not([disabled]),select:not([disabled])');
    if(focus)focus.focus({preventScroll:true});
    if(id==='cart-overlay')setTab('carrinho');
  }
  function hideOverlay(id){
    qs('#'+id).hidden=true;
    if(qs('#cart-overlay').hidden&&qs('#product-overlay').hidden)document.body.classList.remove('is-modal');
    if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});
    if(id==='cart-overlay')restoreTab();
  }
  function activeSize(){return qs('input[name="product-size"]:checked')?.value||'p';}
  function updateCustomization(){
    if(!draft)return;
    const p=catalog.get(draft.id);
    const size=activeSize();
    qs('#product-total').textContent=price(prices[p.group][size]);
    const secondBox=qs('#second-protein');
    if(secondBox){secondBox.hidden=size!=='g';const select=qs('#extra-protein');if(select)select.required=size==='g';}
  }
  function openProduct(id){
    const p=catalog.get(id);if(!p)return;
    draft={id};
    qs('#product-heading').textContent=p.title;
    const isMeal=p.kind==='marmitas';
    const flavorChoices=proteins[p.group]||[];
    const choices=isMeal&&p.group!=='cavalo';
    qs('#product-options').innerHTML=`<div class="choice-label">${p.kind==='feijoada'?'Especialidade':'Escolha o tamanho'}</div>`+
      (p.kind==='feijoada'?'<p class="choice-hint">Feijoada por R$ 28,00 — servida aos sábados e domingos, conforme o cardápio.</p><input type="radio" name="product-size" value="unico" checked hidden>':
      `<div class="option-list size-list"><div class="option"><input id="size-p" type="radio" name="product-size" value="p" checked><label for="size-p"><strong>P · ${price(prices[p.group].p)}</strong><small>${isMeal?'Uma opção':'Porção pequena'}</small></label></div><div class="option"><input id="size-g" type="radio" name="product-size" value="g"><label for="size-g"><strong>G · ${price(prices[p.group].g)}</strong><small>${isMeal?'Duas opções':'Porção grande'}</small></label></div></div>`)+
      (choices?`<div id="second-protein" hidden><div class="choice-label">Segunda proteína (marmita G)</div><p class="choice-hint">A primeira opção é ${esc(p.title)}. Escolha mais uma do mesmo grupo.</p><label class="field" for="extra-protein">Complementar com<select id="extra-protein"><option value="">Selecione a segunda opção</option>${flavorChoices.filter(name=>name!==p.title).map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('')}</select></label></div>`:'')+
      (isMeal?`<div class="choice-label">Preferências de acompanhamento</div><p class="choice-hint">Selecione as opções desejadas para constarem na mensagem. Não altera o preço exibido nesta demonstração.</p><div class="addon-list">${sides.map(s=>`<label><input type="checkbox" value="${esc(s)}" ${['Arroz','Feijão caseiro','Salada'].includes(s)?'checked':''}><span>${esc(s)}</span></label>`).join('')}</div>`:'');
    showOverlay('product-overlay');
    updateCustomization();
  }
  function confirmProduct(){
    if(!draft)return;
    const p=catalog.get(draft.id);const size=activeSize();let second='';
    if(size==='g'&&p.group!=='cavalo'&&p.kind==='marmitas'){
      second=qs('#extra-protein')?.value||'';
      if(!second){toast('Escolha a segunda proteína da marmita G.');qs('#extra-protein')?.focus();return;}
    }
    const pickedSides=p.kind==='marmitas'?qsa('#product-options .addon-list input:checked').map(c=>c.value):[];
    const item={id:p.id,size,second,sides:pickedSides,quantity:1};
    const prev=cart.find(x=>key(x)===key(item));
    if(prev)prev.quantity=Math.min(50,prev.quantity+1);else cart.push(item);
    saveCart();renderCart();hideOverlay('product-overlay');toast(p.title+' adicionado à sacola!');
  }
  function changeQuantity(index,delta){
    if(!cart[index])return;
    cart[index].quantity=Math.min(50,cart[index].quantity+delta);
    if(cart[index].quantity<=0)cart.splice(index,1);
    saveCart();renderCart();
  }
  function renderCart(){
    const container=qs('#cart-items');
    container.innerHTML=cart.length?cart.map((item,i)=>{
      const p=catalog.get(item.id);
      const size=item.size==='unico'?'Única':item.size.toUpperCase();
      const opts=[size,item.second?'+ '+item.second:'',item.sides.length?item.sides.join(', '):''].filter(Boolean).join(' · ');
      return `<div class="cart-row"><div class="cart-img" style="${imageStyle(p.image)}" aria-hidden="true"></div><div class="cart-row-info"><strong>${esc(p.title)}</strong><small>${esc(opts)}</small><b>${price(getUnit(item)*item.quantity)}</b></div><div class="qty"><button type="button" data-dec="${i}" aria-label="Diminuir quantidade de ${esc(p.title)}">−</button><span>${item.quantity}</span><button type="button" data-inc="${i}" aria-label="Aumentar quantidade de ${esc(p.title)}">+</button></div></div>`;
    }).join(''):'<p class="empty-cart">Sua sacola está vazia. ✳<br>Explore o cardápio e escolha uma delícia.</p>';
    qsa('[data-count]').forEach(b=>b.textContent=quantity());
    qs('#checkout').disabled=!cart.length;
    updateTotals();
  }
  function updateTotals(){
    const ship=fees[qs('#delivery').value]||0;
    qs('#subtotal').textContent=price(subtotal());
    qs('#shipping').textContent=price(ship);
    qs('#grand-total').textContent=price(subtotal()+ship);
    const needsAddress=qs('#delivery').value!=='retirada';
    qs('#address-field').hidden=!needsAddress;
    qs('#address').required=needsAddress;
  }
  function checkout(e){
    e.preventDefault();
    if(!cart.length)return toast('Adicione um prato à sacola primeiro.');
    if(!qs('#checkout-form').reportValidity())return;
    const customer=qs('#customer').value.trim();
    const addr=qs('#address').value.trim();
    const method=qs('#delivery').value;
    if(!customer||(method!=='retirada'&&!addr))return toast('Preencha os dados do pedido.');
    const lines=cart.map(item=>{
      const p=catalog.get(item.id);
      const options=[item.size==='unico'?'Unidade':item.size.toUpperCase(),item.second?'2ª proteína: '+item.second:'',item.sides.length?'Acompanhamentos: '+item.sides.join(', '):''].filter(Boolean).join('; ');
      return `• ${item.quantity}x *${p.title}* (${options}) — ${price(getUnit(item)*item.quantity)}`;
    });
    const message=[
      '🍽️ *QUINTINO — PEDIDO DEMONSTRATIVO*','',
      '*Cliente:* '+customer,'',...lines,'',
      '*Entrega:* '+deliveryNames[method],...(method==='retirada'?[]:['*Endereço:* '+addr]),
      '*Subtotal:* '+price(subtotal()),'*Taxa ilustrativa:* '+price(fees[method]),'*Total ilustrativo:* '+price(subtotal()+fees[method]),
      qs('#note').value.trim()?'*Observações:* '+qs('#note').value.trim():'',
      '', '⚠️ *DEMONSTRAÇÃO DE SITE.* Pedido e taxas fictícios; confira com o estabelecimento. Mensagem direcionada ao desenvolvedor, não ao restaurante.'
    ].filter(x=>x!=='').join('\n');
    const url='https://wa.me/'+WHATSAPP+'?text='+encodeURIComponent(message);
    const popup=window.open(url,'_blank','noopener,noreferrer');
    if(!popup)window.location.assign(url);
  }

  // Evento delegado para que cards recriados pela busca continuem interativos.
  document.addEventListener('click',e=>{
    const card=e.target.closest('[data-product]');if(card){openProduct(card.dataset.product);return;}
    const filter=e.target.closest('[data-filter]');if(filter){activeFilter=filter.dataset.filter;qsa('[data-filter]').forEach(btn=>{const isCurrent=btn===filter;btn.classList.toggle('active',isCurrent);btn.setAttribute('aria-pressed',String(isCurrent));});renderMenu();return;}
    const dec=e.target.closest('[data-dec]');if(dec){changeQuantity(Number(dec.dataset.dec),-1);return;}
    const inc=e.target.closest('[data-inc]');if(inc){changeQuantity(Number(inc.dataset.inc),1);return;}
    if(e.target.closest('[data-open-cart]')){renderCart();showOverlay('cart-overlay');return;}
    if(e.target.closest('[data-close-product]')){hideOverlay('product-overlay');return;}
    if(e.target.closest('[data-close-cart]')){hideOverlay('cart-overlay');return;}
    if(e.target.id==='product-overlay'){hideOverlay('product-overlay');return;}
    if(e.target.id==='cart-overlay'){hideOverlay('cart-overlay');return;}
  });
  qs('#add-custom').addEventListener('click',confirmProduct);
  qs('#product-options').addEventListener('change',updateCustomization);
  qs('#search').addEventListener('input',renderMenu);
  qs('#delivery').addEventListener('change',updateTotals);
  qs('#checkout-form').addEventListener('submit',checkout);
  function setTab(name){const index={inicio:0,cardapio:1,carrinho:2,contato:3}[name]??0;qs('#toolbar').style.setProperty('--active',index);qsa('[data-tab]').forEach(btn=>{btn.classList.toggle('selected',btn.dataset.tab===name);if(btn.tagName==='A'){if(btn.dataset.tab===name)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');}});}
  function restoreTab(){const target=['inicio','cardapio','contato'].findLast(id=>{const el=qs('#'+id);const box=el.getBoundingClientRect();return box.top<=window.innerHeight*.5&&box.bottom>=window.innerHeight*.25;})||'inicio';setTab(target);}
  qsa('.tool-tab[href]').forEach(a=>a.addEventListener('click',()=>setTab(a.dataset.tab)));
  document.addEventListener('keydown',e=>{
    const overlay=!qs('#product-overlay').hidden?qs('#product-overlay'):!qs('#cart-overlay').hidden?qs('#cart-overlay'):null;
    if(!overlay)return;
    if(e.key==='Escape'){hideOverlay(overlay.id);return;}
    if(e.key!=='Tab')return;
    const nodes=qsa('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)',overlay).filter(el=>el.getClientRects().length&&!el.closest('[hidden]')&&getComputedStyle(el).visibility!=='hidden');
    if(!nodes.length)return;
    if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1).focus();}
    else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus();}
  });
  if('IntersectionObserver' in window){
    const obs=new IntersectionObserver(entries=>entries.forEach(ent=>{if(ent.isIntersecting){ent.target.classList.add('visible');obs.unobserve(ent.target);}}),{threshold:.06});
    qsa('.reveal').forEach(el=>obs.observe(el));
    const secObs=new IntersectionObserver(entries=>{if(!qs('#cart-overlay').hidden)return;entries.forEach(entry=>{if(entry.isIntersecting)setTab(entry.target.id==='sobre'?'inicio':entry.target.id);});},{rootMargin:'-25% 0px -60% 0px'});
    ['inicio','cardapio','contato'].forEach(id=>secObs.observe(qs('#'+id)));
  }else{qsa('.reveal').forEach(el=>el.classList.add('visible'));}
  renderMenu();renderCart();updateTotals();
})();