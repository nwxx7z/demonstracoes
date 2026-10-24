/* Painel isolado - ZERO solicitações ao servidor Big Lanche ou impressoras. */
(() => {
"use strict";
const d=window.BIG_DEMO_DATA;
const ORDER_KEY="biglanche_demo_orders_v1",MENU_KEY="biglanche_demo_availability_v1",MODE_KEY="biglanche_demo_mode_v1",EDIT_KEY="biglanche_demo_custom_v1",HIDDEN_KEY="biglanche_demo_hidden_sections_v1";
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const money=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
let orders=read(ORDER_KEY,[]),availability=read(MENU_KEY,{}),custom=read(EDIT_KEY,{}),hidden=read(HIDDEN_KEY,{});
if(!Array.isArray(orders))orders=[];
if(!availability||typeof availability!=="object"||Array.isArray(availability))availability={};
if(!custom||typeof custom!=="object"||Array.isArray(custom))custom={};
if(!hidden||typeof hidden!=="object"||Array.isArray(hidden))hidden={};
let currentTab="orders",editing=null;
function listProducts(){
 return Object.entries(d.products).map(([id,p])=>({id,...p,...custom[id],section:custom[id]?.section??Number(id.split("-")[0])}))
 .concat(Object.entries(custom).filter(([id])=>id.startsWith("custom-")).map(([id,p])=>({id,...p,section:Number(p.section),price:Number(p.price)})))
 .filter(p=>p.name&&Number.isFinite(Number(p.price))).sort((a,b)=>a.section-b.section||String(a.name).localeCompare(String(b.name),"pt-BR"));
}
function ordersRender(){
 $("#order-count").textContent=orders.length;
 $("#order-list").innerHTML=orders.length?orders.map((o,index)=>'<article class="order">'+
 '<div class="order-top"><h3>#'+esc(o.id)+'</h3><span class="status '+(o.status==="pronto"?"pronto":"")+'">'+esc(o.status||"recebido")+'</span></div>'+
 '<p class="meta">'+esc(o.customer||"Cliente")+' • '+new Date(o.createdAt).toLocaleString("pt-BR")+'<br>'+esc(o.delivery||"")+(o.locality?" — "+esc(o.locality):"")+'</p>'+
 '<div class="order-items">'+(Array.isArray(o.items)?o.items.map(item=>'<p><strong>'+Number(item.qty)+'× '+esc(item.name)+'</strong>'+(
 item.addons?.length?"<br>+ "+item.addons.map(a=>esc(a.name)).join(", "):"")+(item.flavor?"<br>"+esc(item.flavor):"")+(item.note?"<br>Obs: "+esc(item.note):"")+'</p>').join(""):"")+'</div>'+
 '<p class="meta">Pagamento: '+esc(o.payment||"")+' • '+esc(o.address||"")+'</p><div class="price">'+money(Number(o.total)||0)+'</div>'+
 '<div class="actions"><button class="progress" type="button" data-step="'+index+'">'+(o.status==="recebido"?"Em preparo":o.status==="preparo"?"Pronto":o.status==="pronto"?"Entregue":"Reabrir")+'</button>'+
 '<button type="button" data-print="'+index+'">Prévia do cupom</button><button class="delete" type="button" data-remove="'+index+'">Excluir teste</button></div>'+
 '</article>').join(""):'<div class="empty">Nenhum pedido de demonstração. Monte um pedido no cardápio e selecione “Testar cozinha demo”.</div>';
}
function menuRender(){
 const search=$("#menu-search").value.toLocaleLowerCase("pt-BR");
 $("#sections").innerHTML=d.sections.map((section,i)=>'<label><input type="checkbox" data-section="'+i+'" '+(hidden[i]===true?"":"checked")+'> '+esc(section)+'</label>').join("");
 $("#available-list").innerHTML=listProducts().filter(p=>(p.name+" "+(p.description||"")).toLocaleLowerCase("pt-BR").includes(search)).map(p=>
 '<div class="availability-card"><div><strong>'+esc(p.name)+'</strong><small>'+esc(d.sections[p.section]||"Adicionados")+' • '+money(Number(p.price))+'</small></div>'+
 '<div class="tools"><button type="button" data-edit="'+esc(p.id)+'" aria-label="Editar '+esc(p.name)+'">Editar</button><label><input type="checkbox" data-availability="'+esc(p.id)+'" '+(availability[p.id]===false?"":"checked")+'> Ativo</label></div></div>'
 ).join("");
}
function showEditor(id){
 editing=id;
 const p=listProducts().find(item=>item.id===id);
 $("#editor-title").textContent=id?"Editar item":"Adicionar item de demonstração";
 $("#editor-section").innerHTML=d.sections.map((s,i)=>'<option value="'+i+'">'+esc(s)+'</option>').join("");
 $("#editor-section").value=String(p?.section??0);
 $("#editor-name").value=p?.name||"";
 $("#editor-price").value=p?.price??"";
 $("#editor-description").value=p?.description||"";
 $("#edit-modal").hidden=false;$("#editor-name").focus();
}
function closeEditor(){$("#edit-modal").hidden=true;editing=null;}
function changeTab(tab){currentTab=tab;$("#orders-panel").hidden=tab!=="orders";$("#menu-panel").hidden=tab!=="menu";$$("[data-tab]").forEach(button=>button.classList.toggle("active",button.dataset.tab===tab));}
document.addEventListener("click",event=>{
 const tab=event.target.closest("[data-tab]");if(tab)return changeTab(tab.dataset.tab);
 const step=event.target.closest("[data-step]");if(step){const o=orders[Number(step.dataset.step)];if(!o)return;o.status={recebido:"preparo",preparo:"pronto",pronto:"entregue",entregue:"recebido"}[o.status]||"recebido";save(ORDER_KEY,orders);return ordersRender()}
 const rem=event.target.closest("[data-remove]");if(rem){orders.splice(Number(rem.dataset.remove),1);save(ORDER_KEY,orders);return ordersRender()}
 const print=event.target.closest("[data-print]");if(print){const o=orders[Number(print.dataset.print)];if(!o)return;const summary=o.items.map(x=>x.qty+"× "+x.name+(x.note?" ("+x.note+")":"")).join("\n");window.alert("PRÉVIA DO CUPOM (NÃO IMPRESSO)\n"+o.id+"\nCliente: "+o.customer+"\n"+summary+"\nTotal: "+money(Number(o.total)||0));return}
 const edit=event.target.closest("[data-edit]");if(edit)return showEditor(edit.dataset.edit);
});
document.addEventListener("change",event=>{
 const av=event.target.closest("[data-availability]");if(av){availability[av.dataset.availability]=av.checked;save(MENU_KEY,availability);return}
 const sec=event.target.closest("[data-section]");if(sec){hidden[sec.dataset.section]=!sec.checked;save(HIDDEN_KEY,hidden);return}
});
$("#menu-search").addEventListener("input",menuRender);
$("#mode").value=read(MODE_KEY,"auto");
$("#mode").addEventListener("change",event=>save(MODE_KEY,event.target.value));
$("#add-product").addEventListener("click",()=>showEditor(null));
$("#cancel-editor").addEventListener("click",closeEditor);
$("#edit-modal").addEventListener("click",event=>{if(event.target===$("#edit-modal"))closeEditor()});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!$("#edit-modal").hidden)closeEditor()});
$("#editor-form").addEventListener("submit",event=>{
 event.preventDefault();
 if(!$("#editor-form").reportValidity())return;
 const name=$("#editor-name").value.trim(),price=Number($("#editor-price").value),description=$("#editor-description").value.trim(),section=Number($("#editor-section").value);
 if(!name||!Number.isFinite(price)||price<0||price>1000||!Number.isInteger(section)||section<0||section>=d.sections.length)return;
 const id=editing||"custom-"+Date.now().toString(36);
 custom[id]={name,price,description,section};save(EDIT_KEY,custom);closeEditor();menuRender();
});
$("#reset-demo").addEventListener("click",()=>{
 if(!window.confirm("Excluir apenas os pedidos de teste salvos neste navegador?"))return;
 orders=[];save(ORDER_KEY,orders);ordersRender();
});
window.addEventListener("storage",event=>{
 if(event.key===ORDER_KEY){orders=read(ORDER_KEY,[]);ordersRender()}
 if(event.key===MENU_KEY||event.key===EDIT_KEY||event.key===HIDDEN_KEY){availability=read(MENU_KEY,{});custom=read(EDIT_KEY,{});hidden=read(HIDDEN_KEY,{});menuRender()}
});
ordersRender();menuRender();changeTab("orders");
})();