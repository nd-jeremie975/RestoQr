/* ===== PERSONNALISATION =====
   Images : déposez assets/img/produits/R001.jpg, B001.jpg… (nom = code produit)
   ou renseignez image_url dans le catalogue. Sans image : motif de remplacement.
   Aperçu rapide : ouvrez index.html?perso=1 pour changer une image depuis le navigateur
   (stockage local, test uniquement). Couleurs, nom, frais : ci-dessous. */
const CONFIG={
  nom:"Nom du restaurant",            // à confirmer avec le restaurant (cadrage 2.3)
  slogan:"Saisissez le code de votre plat, nous nous occupons du reste.",
  apiBase:"/api/v1",
  mock:true,                          // false = vraie API PHP
  fraisLivraison:500,                 // indicatif : le serveur fait foi (RG04, RG16)
  devise:"FCFA",
  imgDir:"assets/img/produits/",
  couleurs:{terre:"#B5482A",ocre:"#E0A526",vert:"#1F5E3B",indigo:"#1D2B53",creme:"#FBF3E4"}
};
const ST={PENDING_PAYMENT:"En attente de paiement",PAYMENT_FAILED:"Paiement échoué",PAID:"Payée",ACCEPTED:"Acceptée",PREPARING:"En préparation",READY:"Prête",OUT_FOR_DELIVERY:"En livraison",DELIVERED:"Livrée",CANCELLED:"Annulée",REFUND_PENDING:"Remboursement en attente",REFUNDED:"Remboursée"};
const PAYFR={FAILED:"échec",CANCELLED:"annulé",EXPIRED:"expiré"};
const $=(s,e=document)=>e.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>new Intl.NumberFormat("fr-FR").format(n)+" "+CONFIG.devise;
const LS={get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
const PERSO=new URLSearchParams(location.search).has("perso");
const normPhone=p=>{let d=String(p||"").replace(/\D/g,"");if(d.length===9)d="237"+d;return /^2376\d{8}$/.test(d)?"+"+d:null};

/* ===== API (contrat section 9) ===== */
async function api(path,o={}){
  if(CONFIG.mock)return new Promise((ok,ko)=>setTimeout(()=>{try{ok(mroute(path,o))}catch(e){ko(e)}},250));
  const r=await fetch(CONFIG.apiBase+path,{headers:{"Content-Type":"application/json"},...o});
  const j=await r.json().catch(()=>({success:false,error:{message:"Réponse invalide du serveur"}}));
  if(!j.success)throw j.error;return j.data;
}
/* Simulateur (données fictives, cadrage 14.2) */
const DB={products:[
 {id:1,code:"R001",name:"Poulet et frites",description:"Poulet braisé accompagné de frites dorées.",price:3000,currency:"XAF",available:true,category:"Plats"},
 {id:2,code:"R002",name:"Poulet et plantain",description:"Poulet mijoté, plantains mûrs frits.",price:3500,currency:"XAF",available:true,category:"Plats"},
 {id:3,code:"R003",name:"Ndolé et plantain",description:"Ndolé aux arachides, viande et crevettes.",price:4000,currency:"XAF",available:true,category:"Plats"},
 {id:4,code:"B001",name:"Boisson gazeuse",description:"Bouteille 50 cl bien fraîche.",price:500,currency:"XAF",available:true,category:"Boissons"},
 {id:5,code:"S001",name:"Portion de frites",description:"Portion supplémentaire de frites.",price:500,currency:"XAF",available:true,category:"Suppléments"},
 {id:6,code:"R004",name:"Poisson braisé",description:"Disponible prochainement.",price:4500,currency:"XAF",available:false,category:"Plats"}],
 orders:LS.get("mo",{}),pays:LS.get("mp",{})};
const uid=()=>Math.random().toString(36).slice(2,8).toUpperCase(),sv=()=>{LS.set("mo",DB.orders);LS.set("mp",DB.pays)};
function mroute(path,o){
  const b=o.body?JSON.parse(o.body):{};let r;
  if(r=path.match(/^\/products\/code\/(.+)$/)){const p=DB.products.find(x=>x.code===decodeURIComponent(r[1]).trim().toUpperCase());
    if(!p)throw{code:"PRODUCT_NOT_FOUND",message:"Aucun produit ne correspond à ce code"};
    if(!p.available)throw{code:"PRODUCT_UNAVAILABLE",message:"Ce plat n’est pas disponible pour le moment"};return p}
  if(path==="/products")return DB.products;
  if(path==="/orders"&&o.method==="POST"){
    const items=b.items.map(i=>{const p=DB.products.find(x=>x.id===i.product_id);if(!p||!p.available||!(i.quantity>0))throw{code:"INVALID_ITEM",message:"Un article n’est plus disponible"};return{code:p.code,name:p.name,unit_price:p.price,quantity:i.quantity}});
    const sub=items.reduce((s,i)=>s+i.unit_price*i.quantity,0),ref="CMD-2026-"+uid();
    DB.orders[ref]={order_id:Object.keys(DB.orders).length+1,reference:ref,status:"PENDING_PAYMENT",items,subtotal:sub,delivery_fee:CONFIG.fraisLivraison,total:sub+CONFIG.fraisLivraison,currency:"XAF"};sv();return DB.orders[ref]}
  if(r=path.match(/^\/orders\/(.+)$/)){const x=DB.orders[decodeURIComponent(r[1])];if(!x)throw{code:"ORDER_NOT_FOUND",message:"Commande introuvable"};return x}
  if(path==="/payments/initiate"){const x=DB.orders[b.order_reference];if(!x)throw{code:"ORDER_NOT_FOUND",message:"Commande introuvable"};
    const n=Object.values(DB.pays).filter(p=>p.o===x.reference).length+1,ref="PAY-2026-"+x.reference.slice(9)+"-0"+n;DB.pays[ref]={o:x.reference,t:Date.now()};sv();
    return{payment_reference:ref,status:"PENDING",message:"Validez la demande de paiement sur votre téléphone"}}
  if(r=path.match(/^\/payments\/(.+)$/)){const p=DB.pays[r[1]];if(!p)throw{code:"PAYMENT_NOT_FOUND",message:"Paiement introuvable"};
    const ok=Date.now()-p.t>4000;if(ok){DB.orders[p.o].status="PAID";sv()}return{payment_reference:r[1],status:ok?"SUCCEEDED":"PENDING"}}
  throw{code:"NOT_FOUND",message:"Route inconnue"};
}

/* ===== Images ===== */
const PAL=[["#B5482A","#E0A526"],["#1F5E3B","#F2D48A"],["#1D2B53","#E0A526"],["#7A2E1B","#EBC27A"]];
function ph(code){const [a,b]=PAL[[...code].reduce((s,c)=>s+c.charCodeAt(0),0)%4];
  const d=[0,1,2,3,4].map(i=>`<path d="M${i*30+15} 8l13 13-13 13-13-13z"/><path d="M${i*30} 70l15-13 15 13-15 13z"/>`).join("");
  return "data:image/svg+xml,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 90"><rect width="150" height="90" fill="${a}"/><g fill="none" stroke="${b}" stroke-width="2.5">${d}</g><text x="75" y="52" text-anchor="middle" font-family="Georgia,serif" font-size="22" font-weight="700" fill="${b}">${esc(code)}</text></svg>`)}
const imgSrc=p=>LS.get("img:"+p.code,null)||p.image_url||CONFIG.imgDir+p.code+".jpg";
const IMG=p=>`<img src="${esc(imgSrc(p))}" alt="${esc(p.name)}" loading="lazy" onerror="this.onerror=null;this.src=ph('${esc(p.code)}')">`;

/* ===== Panier ===== */
const P={},cart=LS.get("cart",{});
function save(){LS.set("cart",cart);$("#cnt").textContent=Object.values(cart).reduce((s,i)=>s+i.q,0)}
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove("on"),1800)}
const card=p=>`<article class="card${p.available?"":" off"}">${IMG(p)}<div class="body"><span class="code">${esc(p.code)}</span><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="row"><b>${fmt(p.price)}</b>${p.available?`<button class="btn" data-add="${esc(p.code)}">Ajouter</button>`:"<em>Indisponible</em>"}</div>${PERSO?`<label class="perso">Changer l’image<input type="file" accept="image/*" data-img="${esc(p.code)}"></label>`:""}</div></article>`;
document.addEventListener("click",e=>{
  const a=e.target.dataset.add,q=e.target.dataset.q;
  if(a&&P[a]&&P[a].available){(cart[a]??={p:P[a],q:0}).q=Math.min(20,cart[a].q+1);save();toast(P[a].name+" ajouté au panier")}
  if(q&&cart[q]){cart[q].q+=+e.target.dataset.d;if(cart[q].q<=0)delete cart[q];save();render()}
});
document.addEventListener("change",e=>{const c=e.target.dataset.img;if(!c)return;const im=new Image();
  im.onload=()=>{const k=Math.min(1,640/im.width),cv=document.createElement("canvas");cv.width=im.width*k;cv.height=im.height*k;cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height);LS.set("img:"+c,cv.toDataURL("image/jpeg",.8));render()};
  im.src=URL.createObjectURL(e.target.files[0])});

/* ===== Vues ===== */
const view=$("#view");
async function home(){
  view.innerHTML=`<section class="hero"><h1>${esc(CONFIG.nom)}</h1><p>${esc(CONFIG.slogan)}</p><form id="cf"><label for="code">Code du plat</label><div class="row"><input id="code" placeholder="Ex. R001" autocomplete="off" maxlength="12"><button class="btn">Chercher</button></div></form><div id="res"></div></section><h2 class="sec">Ou parcourez le menu</h2><div id="tabs" class="tabs"></div><div id="grid" class="grid">Chargement…</div>`;
  $("#cf").onsubmit=async e=>{e.preventDefault();const c=$("#code").value.trim().toUpperCase();if(!c)return;$("#res").textContent="Recherche…";
    try{const p=await api("/products/code/"+encodeURIComponent(c));P[p.code]=p;$("#res").innerHTML=card(p)}catch(x){$("#res").innerHTML=`<p class="err" style="color:#fff">${esc(x.message||"Erreur")}</p>`}};
  try{const list=await api("/products");list.forEach(p=>P[p.code]=p);
    const cats=[...new Set(list.map(p=>p.category).filter(Boolean))],draw=c=>{$("#grid").innerHTML=list.filter(p=>!c||p.category===c).map(card).join("")};
    $("#tabs").innerHTML=cats.length?["Tout",...cats].map(c=>`<button class="tab" data-cat="${esc(c)}">${esc(c)}</button>`).join(""):"";
    $("#tabs").onclick=e=>{const c=e.target.dataset.cat;if(c)draw(c==="Tout"?"":c)};draw()}
  catch(x){$("#grid").innerHTML=`<p class="err">Menu indisponible : ${esc(x.message||"réessayez")}</p>`}
}
function cartView(){
  const L=Object.values(cart);
  if(!L.length)return view.innerHTML=`<section class="box"><h1>Votre panier</h1><p>Il est vide. <a href="#/">Choisir un plat</a></p></section>`;
  const sub=L.reduce((s,i)=>s+i.p.price*i.q,0);
  view.innerHTML=`<section class="box"><h1>Votre panier</h1>${L.map(i=>`<div class="line">${IMG(i.p)}<div><b>${esc(i.p.name)}</b><small>${esc(i.p.code)} · ${fmt(i.p.price)}</small></div><div class="qty"><button data-q="${esc(i.p.code)}" data-d="-1" aria-label="Retirer un">−</button><span>${i.q}</span><button data-q="${esc(i.p.code)}" data-d="1" aria-label="Ajouter un">+</button></div><b>${fmt(i.p.price*i.q)}</b></div>`).join("")}<dl class="tot"><dt>Sous-total</dt><dd>${fmt(sub)}</dd><dt>Livraison (indicatif)</dt><dd>${fmt(CONFIG.fraisLivraison)}</dd><dt>Total</dt><dd>${fmt(sub+CONFIG.fraisLivraison)}</dd></dl><p class="note">Prix et frais sont revérifiés par le serveur au moment de la commande.</p><a class="btn" href="#/commande">Continuer</a><a class="lnk" href="#/">Ajouter un autre code</a></section>`;
}
function checkout(){
  if(!Object.keys(cart).length)return location.hash="#/panier";
  const pr=LS.get("profil",{});
  view.innerHTML=`<section class="box"><h1>Votre commande</h1><p class="note">Aucun compte n’est nécessaire. Se faire reconnaître sur cet appareil est facultatif.</p><form id="of" novalidate><label>Nom<input name="name" required value="${esc(pr.name)}" autocomplete="name"></label><label>Téléphone<input name="phone" inputmode="tel" required placeholder="6XX XX XX XX" value="${esc(pr.phone)}" autocomplete="tel"></label><label>Adresse de livraison<textarea name="address" rows="2" required>${esc(pr.address)}</textarea></label><label>Indication complémentaire (facultatif)<input name="instr"></label><fieldset><legend>Paiement</legend><label class="radio"><input type="radio" checked disabled> Orange Money</label><label>Numéro à débiter<input name="pay" inputmode="tel" placeholder="Identique au téléphone si vide"></label><p class="note">Vous validerez la demande sur votre téléphone. Ne communiquez jamais votre code secret sur ce site.</p></fieldset><label class="chk"><input type="checkbox" name="mem" ${pr.name?"checked":""}> Retenir mes informations sur cet appareil (facultatif)</label><p id="fe" class="err"></p><button class="btn">Confirmer et payer</button></form></section>`;
  $("#of").onsubmit=async e=>{e.preventDefault();
    const f=Object.fromEntries(new FormData(e.target)),tel=normPhone(f.phone),pp=normPhone(f.pay||f.phone),er=$("#fe");
    if(f.name.trim().length<2||!f.address.trim())return er.textContent="Le nom et l’adresse sont obligatoires.";
    if(!tel||!pp)return er.textContent="Numéro invalide. Format attendu : 6XX XX XX XX.";
    const b=e.submitter;b.disabled=true;er.textContent="";
    try{const o=await api("/orders",{method:"POST",body:JSON.stringify({items:Object.values(cart).map(i=>({product_id:i.p.id,quantity:i.q})),customer:{name:f.name.trim(),phone:tel},delivery:{address:f.address.trim(),instructions:f.instr.trim()}})});
      LS.set("profil",f.mem?{name:f.name,phone:f.phone,address:f.address}:{});
      LS.set("mes",[o.reference,...LS.get("mes",[]).filter(r=>r!==o.reference)].slice(0,10));
      for(const k in cart)delete cart[k];save();sessionStorage.setItem("pp:"+o.reference,pp);location.hash="#/paiement/"+o.reference}
    catch(x){er.textContent=x.message||"Erreur";b.disabled=false}};
}
async function pay(ref){
  view.innerHTML=`<section class="box"><h1>Paiement</h1><div id="ps">Préparation…</div></section>`;
  let o;try{o=await api("/orders/"+encodeURIComponent(ref))}catch(x){return $("#ps").innerHTML=`<p class="err">${esc(x.message)}</p>`}
  if(!["PENDING_PAYMENT","PAYMENT_FAILED"].includes(o.status))return location.hash="#/suivi/"+ref;
  const sum=`<p>Commande <b>${esc(o.reference)}</b> : total <b>${fmt(o.total)}</b> (dont livraison ${fmt(o.delivery_fee)}).</p>`;
  const fail=m=>{$("#ps").innerHTML=sum+`<p class="err">${esc(m)}</p><button class="btn" id="rt">Réessayer le paiement</button>`;$("#rt").onclick=start};
  const poll=async pr=>{for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,3000));if(!location.hash.endsWith(ref))return;
    try{const s=await api("/payments/"+pr);if(s.status==="SUCCEEDED")return location.hash="#/suivi/"+ref;
      if(PAYFR[s.status])return fail("Le paiement n’a pas abouti ("+PAYFR[s.status]+").")}catch{}}
    fail("Aucune confirmation reçue dans le délai prévu.")};
  async function start(){
    const phone=sessionStorage.getItem("pp:"+ref)||normPhone(prompt("Numéro Orange Money à débiter (6XX XX XX XX) :"));
    if(!phone)return fail("Numéro Orange Money manquant.");sessionStorage.setItem("pp:"+ref,phone);
    $("#ps").innerHTML=sum+"<p>Envoi de la demande à Orange Money…</p>";
    try{const r=await api("/payments/initiate",{method:"POST",body:JSON.stringify({order_reference:ref,operator:"ORANGE",phone})});
      $("#ps").innerHTML=sum+`<p class="wait">${esc(r.message)}</p><p class="note">Gardez cette page ouverte. Le paiement n’est validé que lorsque le serveur reçoit la confirmation d’Orange.</p>`;poll(r.payment_reference)}
    catch(x){fail(x.message||"Erreur")}}
  start();
}
async function track(ref){
  view.innerHTML=`<section class="box"><h1>Suivi de commande</h1><form id="tf" class="row"><input id="tr" placeholder="Référence, ex. CMD-2026-XXXXXX" value="${esc(ref)}"><button class="btn">Voir</button></form><div id="to"></div><p id="mine" class="note"></p></section>`;
  $("#tf").onsubmit=e=>{e.preventDefault();location.hash="#/suivi/"+encodeURIComponent($("#tr").value.trim().toUpperCase())};
  const m=LS.get("mes",[]);if(m.length)$("#mine").innerHTML="Mes commandes sur cet appareil : "+m.map(r=>`<a href="#/suivi/${esc(r)}">${esc(r)}</a>`).join(" · ");
  if(!ref)return;
  try{const o=await api("/orders/"+encodeURIComponent(ref)),S=["PAID","ACCEPTED","PREPARING","READY","OUT_FOR_DELIVERY","DELIVERED"],k=S.indexOf(o.status);
    $("#to").innerHTML=`<p>Commande <b>${esc(o.reference)}</b> : ${fmt(o.total)}</p>`+(k<0?`<p class="badge">${esc(ST[o.status]||o.status)}</p>`:`<ol class="steps">${S.map((s,i)=>`<li class="${i<k?"done":i===k?"now":""}">${ST[s]}</li>`).join("")}</ol>`)+(o.items?`<ul>${o.items.map(i=>`<li>${i.quantity} × ${esc(i.name)}</li>`).join("")}</ul>`:"")}
  catch(x){$("#to").innerHTML=`<p class="err">${esc(x.message||"Erreur")}</p>`}
}
function render(){
  const [a,b]=location.hash.slice(2).split("/"),id=decodeURIComponent(b||"");window.scrollTo(0,0);
  ({"":home,panier:cartView,commande:checkout,paiement:()=>pay(id),suivi:()=>track(id)}[a]||home)();
}
for(const[k,v]of Object.entries(CONFIG.couleurs))document.documentElement.style.setProperty("--"+k,v);
$("#brand").textContent=CONFIG.nom;document.title=CONFIG.nom+" · Commande en ligne";
addEventListener("hashchange",render);save();render();
