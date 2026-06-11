// ══ CONFIG ══
const SUPABASE_URL = 'https://gsunfwmembmketvvrjfy.supabase.co/rest/v1/';
const SUPABASE_KEY = 'sb_publishable_gn-xpz9KYJ3-7b2TkNSNeQ_v7OcMZhj';
const LS_USER  = 'lm_user_v2';
const POLL_MS  = 12000;
const APP_PWD  = 'LM2026'; // ← Mot de passe de l'application
const DATA_VERSION = 2; // Incrementer pour forcer le rechargement des rayons par défaut

const TEAM = [
  {name:'Sami',   color:'#e05a28'},
  {name:'Karim',  color:'#2660a8'},
  {name:'Evan',   color:'#7c3aed'},
  {name:'Thomas', color:'#0891b2'},
  {name:'Sammy',  color:'#c97c10'},
  {name:'Laura',  color:'#c2276b'},
  {name:'Hugo',   color:'#0f766e'},
  {name:'LOG SRM', color:'#f59e0b', role:'logistique'},
];

const C_COLORS = ['#3d9142','#2d8a5e','#4a7e3e','#2e8a72','#5aab5e'];
const R_COLORS = ['#2660a8','#1e5580','#3a72c0','#2650a0','#4a62b8'];
const C_EMOJIS = ['🍳','🍽️','🥘','🥄','🫙','🧑‍🍳'];
const R_EMOJIS = ['📦','🗄️','🧺','🪣','🗂️','🪜'];
const STATUS_OPTS = ['À faire','En cours','Bloqué','Fait'];


const SUBTASKS_SHOWROOM = [
  {label:'Passer les commandes Pyxis et renseigner les numéros de commande dans Notes', done:false},
  {label:'Imprimer les documents relatifs au showroom concerné', done:false},
  {label:'Demander le balisage des produits', done:false},
  {label:'Programmer les étiquettes électroniques', done:false},
];
const SUBTASKS_FOND_RAYON = [
  {label:'Imprimer les plans Agencement, Produits et Balisage', done:false},
  {label:"Imprimer la logique d’implantation Merch", done:false},
  {label:'Programmer les étiquettes électroniques', done:false},
];

const DEFAULT_RAYONS = [
  {id:'r01',name:'01 - PORTES DE PLACARD',emoji:'🚪',color:'#2660a8',universe:'RANGEMENT',status:'bientot',members:[],tasks:[]},
  {id:'r03',name:'03 - AMGT PLACARD / PIÈCE À VIVRE',emoji:'🗄️',color:'#1e5580',universe:'RANGEMENT',status:'bientot',members:[],tasks:[]},
  {id:'r04',name:'04 - ACCESSOIRES DE RANGEMENT',emoji:'📦',color:'#3a72c0',universe:'RANGEMENT',status:'bientot',members:[],tasks:[]},
  {id:'r07',name:'07 - MEUBLES',emoji:'🛋️',color:'#4a62b8',universe:'RANGEMENT',status:'bientot',members:[],tasks:[]},
  {id:'r10',name:'10 - CUISINE ENTRÉE DE GAMME',emoji:'🍳',color:'#3d9142',universe:'CUISINE',status:'bientot',members:[],tasks:[]},
  {id:'r11',name:'11 - CUISINES DELINIA ID',emoji:'🍽️',color:'#2d8a5e',universe:'CUISINE',status:'bientot',members:[],tasks:[]},
  {id:'r13',name:'13 - PLANS DE TRAVAIL CUISINE',emoji:'🔲',color:'#4a7e3e',universe:'CUISINE',status:'bientot',members:[],tasks:[]},
  {id:'r14',name:'14 - ACCESSOIRES DE CUISINE',emoji:'🥄',color:'#2e8a72',universe:'CUISINE',status:'bientot',members:[],tasks:[]},
  {id:'r15',name:'15 - ÉLECTROMÉNAGER',emoji:'⚡',color:'#5aab5e',universe:'CUISINE',status:'bientot',members:[],tasks:[]},
  {id:'r20',name:'20 - ÉVIER',emoji:'🚿',color:'#1e5580',universe:'CUISINE',status:'bientot',members:[],tasks:[]},
  {id:'r22',name:'22 - ROBINETTERIE CUISINE',emoji:'🔧',color:'#3a72c0',universe:'CUISINE',status:'bientot',members:[],tasks:[]},
];

// ══ STATE ══
let sheetId = '1h4mL4P-RE2TbjLCnHnzprLpe40wIkWRA-k2czgK_-Q4';
let currentUser = null;
let selectedId = null;
let _selUni = 'CUISINE';
let _mt = [];
let pollTimer = null;
let lastHash = '';
let isSaving = false;
let state = {rayons:[], log:[]};
let openTaskIds = new Set(); // tâches dont le détail est ouvert

// ══ HELPERS ══
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function taskPct(t){
  const subs = t.subtasks||[];
  if(subs.length===0) return t.done?100:0;
  return Math.round(subs.filter(s=>s.done).length/subs.length*100);
}
function pct(r){
  const tasks = r.tasks||[];
  if(!tasks.length) return 0;
  const total = tasks.reduce((s,t)=>s+taskPct(t),0);
  return Math.round(total/tasks.length);
}
function barColor(p, u, col){
  // Toujours utiliser la couleur du rayon
  if(col) return col;
  if(p===100)return'#2d9e4f';
  if(u==='CUISINE')return'#3d9142';
  if(u==='RANGEMENT')return'#2660a8';
  return'#c8d2cd';
}
function teamColor(n){return(TEAM.find(m=>m.name===n)||{color:'#8fa89a'}).color;}
function rayonsOf(u){return(state.rayons||[]).filter(r=>r.universe===u);}
function univPct(u){const rs=rayonsOf(u);if(!rs.length)return 0;const t=rs.reduce((s,r)=>s+r.tasks.length,0);if(!t)return 0;return Math.round(rs.reduce((s,r)=>s+r.tasks.filter(t=>t.done).length,0)/t*100);}
function isTaskFinalized(t){ return t.implante && t.micromerch && t.adressage; }
function isRayonFinalized(r){ return (r.tasks||[]).length>0 && (r.tasks||[]).every(t=>isTaskFinalized(t)); }
function finalizedCount(r){
  const tasks = r.tasks||[];
  return tasks.filter(t=>isTaskFinalized(t)).length+'/'+tasks.length;
}
function statusBadge(r){
  const p=pct(r);
  if(isRayonFinalized(r)) return '<span class="rc-badge finalized">🏁 Finalisé</span>';
  if(p===100) return '<span class="rc-badge done">✓ Prêt à implanter</span>';
  if((r.tasks||[]).some(t=>t.implante)) return '<span class="rc-badge live">🏗️ En cours implant.</span>';
  if(r.status==='live') return '<span class="rc-badge live">● Live</span>';
  return '<span class="rc-badge soon">Bientôt</span>';
}
function makeTask(label, taskType){
  taskType = taskType || 'showroom';
  const template = taskType === 'fond_rayon' ? SUBTASKS_FOND_RAYON : SUBTASKS_SHOWROOM;
  return {
    id: 't' + Date.now() + Math.random().toString(36).slice(2,5),
    label: label, taskType: taskType,
    done: false, status: 'À faire', assign: '', urgent: false, notes: '', pdfs: [],
    subtasks: template.map(s => ({label: s.label, done: false}))
  };
}
function migrate(r){
  r.universe=r.universe||'CUISINE';
  (r.tasks||[]).forEach(t=>{
    t.urgent=t.urgent||false; t.notes=t.notes||''; if(!t.subtasks)t.subtasks=[];
    t.subtasks=t.subtasks.map(s=>typeof s==='string'?{label:s,done:false}:s);
    if(!t.taskType)t.taskType='showroom'; // migration ancienne tâche
    if(!t.pdfs)t.pdfs=[];
    if(!t.cmds)t.cmds=[];
    if(t.implante===undefined) t.implante=false;
    if(t.micromerch===undefined) t.micromerch=false;
    if(t.adressage===undefined) t.adressage=false;
    t.cmds.forEach(c=>{ if(c.status&&c.status!=='En attente'&&c.status!=='Reçue') c.status='En attente'; });
  });
}

let isOfflineMode = false;

// ══ SUPABASE ══
let lastKnownVersion = null;

async function checkSupabaseVersion() {
  // Requête ultra-légère qui ne télécharge QUE le numéro de version, pas les données
  const r = await fetch(SUPABASE_URL + 'app_state?id=eq.1&select=data->version', {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
    cache: 'no-store'
  });
  if(r.ok) {
    const rows = await r.json();
    if(rows && rows.length > 0 && rows[0].version !== undefined) {
      return rows[0].version;
    }
  }
  return null;
}

async function sheetRead(){
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  try {
    const r = await fetch(SUPABASE_URL + 'app_state?id=eq.1&select=data', {
      headers: { 
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if(r.ok){
      const rows = await r.json();
      if(rows && rows.length > 0) {
        const d = rows[0].data;
        if(d && d.rayons) {
          lastKnownVersion = d.version || Date.now();
          return d;
        }
        // La ligne existe mais pas de données valides (initialisation)
        return null; 
      }
      // Aucune ligne (initialisation)
      return null;
    }
    throw new Error('Supabase HTTP erreur ' + r.status);
  } catch (error) {
    clearTimeout(timeoutId);
    throw new Error('Erreur de connexion (Timeout ou réseau)');
  }
}

async function writeToSupabase(data){
  data.version = Date.now(); // Mise à jour de la version à chaque sauvegarde
  lastKnownVersion = data.version;
  const resp = await fetch(SUPABASE_URL + 'app_state', {
    method: 'POST',
    headers: { 
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates, return=minimal'
    },
    body: JSON.stringify({ id: 1, data: data })
  });
  if(!resp.ok) throw new Error('Supabase HTTP ' + resp.status);
}

let _syncErrorCount = 0;
async function sheetWrite(data){
  // Sauvegarde locale immédiate
  const payload = JSON.stringify(data);
  try { localStorage.setItem('lm_state_bk', payload); } catch(e){}

  // Sauvegarde Supabase
  try {
    await writeToSupabase(data);
    _syncErrorCount = 0;
  } catch(e) {
    _syncErrorCount++;
    if(_syncErrorCount > 2) console.error("Échecs répétés Cloud:", e);
    throw e;
  }
}

// ══ CONFIG ══
function doConfig(){
  let id=document.getElementById('cfg-sheet-id').value.trim();
  if(!id){showCfgErr('Collez l\'ID du Google Sheet.');return;}
  const m=id.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if(m)id=m[1];
  sheetId=id;
  localStorage.setItem(LS_SHEET,id);
  document.getElementById('config-overlay').classList.remove('show');
  showAuth();
}
function showCfgErr(m){const el=document.getElementById('cfg-err');el.innerHTML=m;el.style.display='block';}
function reconfigure(){localStorage.removeItem(LS_SHEET);clearInterval(pollTimer);document.getElementById('app').style.display='none';document.getElementById('config-overlay').classList.add('show');}

// ══ AUTH ══
function showAuth(){
  document.getElementById('auth-overlay').classList.add('show');
  const commerce = TEAM.filter(m=>!m.role);
  const logistique = TEAM.filter(m=>m.role==='logistique');
  document.getElementById('auth-grid').innerHTML=
    '<div style="grid-column:1/-1;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text3);padding-bottom:4px">Commerce</div>'
    + commerce.map(m=>`
    <button class="auth-btn" onclick="selectUser('${m.name}')">
      <div class="auth-av" style="background:${m.color}">${m.name.slice(0,2).toUpperCase()}</div>
      ${esc(m.name)}
    </button>`).join('')
    + '<div style="grid-column:1/-1;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text3);padding:12px 0 4px">Logistique</div>'
    + logistique.map(m=>`
    <button class="auth-btn" style="grid-column:1/-1;border-color:#f59e0b22;background:#fffbeb" onclick="selectUser('${m.name}')">
      <div class="auth-av" style="background:${m.color}">🚚</div>
      ${esc(m.name)}
    </button>`).join('');
}
function selectUser(name){
  currentUser=name; localStorage.setItem(LS_USER,name);
  document.getElementById('auth-overlay').classList.remove('show');
  const c=teamColor(name);
  document.getElementById('topbar-av').style.background=c;
  document.getElementById('topbar-av').textContent=name.slice(0,2).toUpperCase();
  document.getElementById('topbar-name').textContent=name;
  document.getElementById('loading').style.display='flex';
  hideSplash(); // Masquer le splash dès que l'utilisateur est sélectionné
  loadData();
}
function logout(){clearInterval(pollTimer);currentUser=null;document.getElementById('app').style.display='none';showAuth();}

// ══ LOAD ══
function ldMsg(m){document.getElementById('ld-msg').textContent=m;}
function ldErr(m){
  const el=document.getElementById('ld-err');el.innerHTML=m;el.style.display='block';
  document.getElementById('ld-retry').style.display='block';
  document.getElementById('ld-msg').style.display='none';
  hideSplash();
}

async function loadData(){
  document.getElementById('ld-err').style.display='none';
  document.getElementById('ld-retry').style.display='none';
  document.getElementById('ld-msg').style.display='block';
  ldMsg('Synchronisation avec le Cloud en cours...');
  hideSplash(); // Sécurité — masquer le splash dans tous les cas

  function startWithLocalData(){
    const bk=localStorage.getItem('lm_state_bk');
    if(bk){try{state=JSON.parse(bk);}catch(e){}}
    if(!state.rayons){state={version:DATA_VERSION,rayons:JSON.parse(JSON.stringify(DEFAULT_RAYONS)),log:[]};}
    if(!state.log)state.log=[];
    state.rayons.forEach(migrate);
    if(!state.retro)state.retro=[];
    document.getElementById('loading').style.display='none';
    document.getElementById('app').style.display='flex';
    render();startPolling();hideSplash();
  }

  try{
    let data=null;
    try{
      data = await sheetRead();
    }catch(e){
      // Échec de la lecture cloud
      if (confirm("Le serveur Cloud est injoignable.\\n\\nVoulez-vous charger vos données locales en Mode Hors-ligne ?\\n\\nAttention : Si vous modifiez des données en hors-ligne, elles ne seront pas envoyées au Cloud pour éviter d'écraser le travail de vos collègues.")) {
        isOfflineMode = true;
        setSyncStatus('offline');
        startWithLocalData();
        return;
      } else {
        throw e; // Laisse l'erreur s'afficher pour forcer le retry
      }
    }
    if(data&&data.rayons){
      state=data;
      // Vérifier la version — si absente ou ancienne, fusionner les rayons manquants
      if(!state.version || state.version < DATA_VERSION){
        const existingIds = new Set(state.rayons.map(r=>r.id));
        const missing = DEFAULT_RAYONS.filter(r=>!existingIds.has(r.id));
        if(missing.length > 0){
          state.rayons = [...state.rayons, ...missing.map(r=>JSON.parse(JSON.stringify(r)))];
        }
        state.version = DATA_VERSION;
        await sheetWrite(state);
      }
    }
    else{
      state={version:DATA_VERSION, rayons:JSON.parse(JSON.stringify(DEFAULT_RAYONS)),log:[]};
      await sheetWrite(state);
    }
    if(!state.log)state.log=[];
    state.rayons.forEach(migrate);
    if(!state.retro)state.retro=[];
    lastHash=JSON.stringify(state);
    setTimeout(()=>{document.getElementById('loading').style.display='none';document.getElementById('app').style.display='flex';render();startPolling();hideSplash();},300);
  }catch(e){
    document.getElementById('ld-retry').style.display='inline-block';
    ldErr('<strong>Erreur de synchronisation</strong><br>Impossible de charger les données du Cloud.<br><br>Vérifiez votre connexion internet.');
  }
}

// ══ SAVE ══
async function save(msg){
  if(msg){if(!state.log)state.log=[];state.log.unshift({user:currentUser,msg,time:new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})});if(state.log.length>50)state.log=state.log.slice(0,50);}
  
  if(isOfflineMode) {
    try { localStorage.setItem('lm_state_bk', JSON.stringify(state)); } catch(e){}
    render();
    return;
  }

  render(); isSaving=true; setSyncStatus('syncing');
  let success=false;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      await sheetWrite(state);
      lastHash=JSON.stringify(state);
      setSyncStatus('ok');
      success=true;
      break;
    } catch(e){
      if(attempt<3){
        await new Promise(r=>setTimeout(r,1500*attempt)); // attendre avant retry
      }
    }
  }
  if(!success) {
    setSyncStatus('error');
    alert("⚠️ ERREUR DE SYNCHRONISATION ⚠️\\n\\nImpossible d'enregistrer vos modifications sur le Cloud.\\nVérifiez votre connexion internet.\\n\\n(Vos modifications ont été sauvegardées sur cet appareil uniquement)");
  }
  isSaving=false;
}

function startPolling(){
  clearInterval(pollTimer);
  pollTimer=setInterval(async()=>{
    if(isOfflineMode || isSaving) return;
    if(document.activeElement && document.activeElement.classList.contains('td-notes')) return;
    try {
      // 1. Vérification ultra-légère
      const remoteVersion = await checkSupabaseVersion();
      if (!remoteVersion) return; // Erreur ou aucune donnée
      
      // 2. Ne télécharger que si la version distante est plus récente
      if (remoteVersion !== lastKnownVersion) {
        const r = await sheetRead();
        if(!r || !r.rayons) return;
        const h = JSON.stringify(r);
        if(h !== lastHash){
          lastHash = h;
          state = r;
          if(!state.log) state.log = [];
          state.rayons.forEach(migrate);
          render();
        }
      }
      setSyncStatus('ok');
    }
    catch(e){setSyncStatus('error');}
  }, POLL_MS);
}
function setSyncStatus(s){
  const dot=document.getElementById('sync-dot'),lbl=document.getElementById('sync-label');
  if(s==='ok'){dot.className='sync-dot';lbl.textContent='Connecté';}
  else if(s==='syncing'){dot.className='sync-dot syncing';lbl.textContent='Sync…';}
  else if(s==='offline'){dot.className='sync-dot error';lbl.textContent='Hors-ligne'; dot.style.background='var(--orange)';}
  else{dot.className='sync-dot error';lbl.textContent='Erreur Sync'; dot.style.background='var(--red)';}
}

// ══ RENDER ══
function render(){
  if(!state.rayons)return;
  // Migration dynamique : Forcer t.done basé sur l'implantation finale
  state.rayons.forEach(r=>{
    (r.tasks||[]).forEach(t=>{
      t.done = !!(t.implante && t.micromerch && t.adressage);
      if(t.done) t.status = 'Fait';
    });
  });

  const total=(state.rayons||[]).length;
  const totalT=(state.rayons||[]).reduce((s,r)=>s+(r.tasks||[]).length,0);
  const doneT=(state.rayons||[]).reduce((s,r)=>s+(r.tasks||[]).filter(t=>t.done).length,0);
  const deployed=(state.rayons||[]).filter(r=>pct(r)===100).length;
  const finalized=(state.rayons||[]).filter(r=>isRayonFinalized(r)).length;
  const gp=totalT?Math.round(doneT/totalT*100):0;
  const gc=barColor(gp,'');

  // Hero Dashboard
  const ring = document.getElementById('stat-global-ring');
  if(ring) {
    ring.style.strokeDasharray = `${gp}, 100`;
    ring.style.stroke = gp>=100?'#2d9e4f':gp>=50?'#3d9142':'#4aab57';
  }
  const pctEl = document.getElementById('hero-pct');
  if(pctEl) {
    pctEl.textContent = gp + '%';
    pctEl.style.color = gp>=100?'#2d9e4f':gp>=50?'#3d9142':'#4aab57';
  }

  document.getElementById('hero-stats').innerHTML=`
    <div class="hd-stat"><div class="hd-stat-num">${doneT}/${totalT}</div><div class="hd-stat-lbl">Tâches</div></div>
    <div class="hd-stat"><div class="hd-stat-num">${total}</div><div class="hd-stat-lbl">Rayons</div></div>
    <div class="hd-stat" title="Sous-rayons : Implanté + Micro-merch OK + Adressage OK"><div class="hd-stat-num" style="color:#1a6b32">${finalized}</div><div class="hd-stat-lbl">🏁 Finalisés</div></div>`;

  const cp=univPct('CUISINE'),rp=univPct('RANGEMENT');
  const cn=rayonsOf('CUISINE').length,rn=rayonsOf('RANGEMENT').length;
  document.getElementById('hero-univs').innerHTML=`
    <div class="hd-univ-card cuisine">
      <span class="hd-univ-lbl">🍳 Cuisine</span>
      <span class="hd-univ-pct">${cp}%</span>
    </div>
    <div class="hd-univ-card rangement">
      <span class="hd-univ-lbl">📦 Rangement</span>
      <span class="hd-univ-pct">${rp}%</span>
    </div>`;

  // Sidebar
  const sl=document.getElementById('sidebar-list'); sl.innerHTML='';
  ['CUISINE','RANGEMENT'].forEach(u=>{
    const rs=rayonsOf(u), up=univPct(u), uSlug=u==='CUISINE'?'cuisine':'rangement';
    const sec=document.createElement('div');
    sec.innerHTML=`<div class="ss-header ${uSlug}">
      <span class="ss-lbl ${uSlug}">${u==='CUISINE'?'🍳 CUISINE':'📦 RANGEMENT'}</span>
      <span class="ss-badge ${uSlug}">${up}% · ${rs.length}</span>
    </div>`;
    sl.appendChild(sec);
    if(!rs.length){const e=document.createElement('div');e.style.cssText='padding:13px 16px;font-size:13px;color:var(--text3);font-style:italic;';e.textContent='Aucun sous-rayon';sl.appendChild(e);}
    rs.forEach(r=>{
      const p=pct(r),c=barColor(p,r.universe,r.color);
      const div=document.createElement('div');
      div.className='rayon-card-side'+(selectedId===r.id?` active-${uSlug}`:'');
      // Fond coloré léger selon r.color
      if(r.color){
        div.style.background = r.color + '12'; // ~7% opacité
        div.style.borderColor = r.color + '60'; // bordure légère
      }
      if(selectedId===r.id&&r.color){
        div.style.background = r.color + '22'; // plus marqué si actif
        div.style.borderColor = r.color;
      }
      div.onclick=()=>{selectedId=r.id;render();mobileOnRayonSelect();};
      div.innerHTML=`
        <div class="rc-top">
          <div class="rc-icon" style="background:${r.color}18;color:${r.color}">${r.emoji||'📦'}</div>
          <span class="rc-name">${esc(r.name)}</span>
          ${statusBadge(r)}${(r.tasks||[]).some(t=>isTaskFinalized(t))?`<span style="font-size:11px;font-weight:700;color:#1a6b32;background:#e8f5ec;padding:2px 7px;border-radius:99px;">🏁 ${finalizedCount(r)}</span>`:'' }
        </div>
        <div class="rc-bar-row">
          <div style="font-size:11px;font-weight:600;color:var(--text3);">Préparation implantation</div>
          <div style="display:flex;align-items:center;gap:10px;width:100%;">
            <div class="rc-track"><div class="rc-fill" style="width:${p}%;background:${c}"></div></div>
            <span class="rc-pct" style="color:${c}">${p}%</span>
          </div>
        </div>
        <button class="rc-del" onclick="event.stopPropagation();delRayon('${r.id}')">×</button>`;
      sl.appendChild(div);
    });
  });

  renderDetail();

  // Rétroplanning
  renderRetro();
  // Mobile
  updateMobileBadge();
  mobileEnforce();
  // Mes tâches
  renderMyTasks();
  // Tâches équipe
  renderTeamTasks();
  // Logistique
  renderLogistique();

  // Log
  const lb=document.getElementById('log-bar');
  if(state.log&&state.log.length)lb.innerHTML=state.log.slice(0,10).map(e=>`<span><span class="log-user">${esc(e.user)}</span> — ${esc(e.msg)} <span class="log-time">${e.time}</span></span>`).join('<span style="color:var(--text3);margin:0 6px">·</span>');
  else lb.innerHTML='<span style="color:var(--text3)">Aucune activité récente.</span>';
}

function renderDetail(){
  if(document.activeElement && document.activeElement.classList.contains('td-notes')) return;
  // Mémoriser les détails actuellement ouverts avant de recréer le HTML
  document.querySelectorAll('.task-detail.open').forEach(el=>{
    openTaskIds.add(el.id.replace('td-',''));
  });
  const det=document.getElementById('detail');
  if(!selectedId){det.innerHTML='<div class="detail-empty"><div class="detail-empty-icon">📋</div><div class="detail-empty-txt">Sélectionnez un sous-rayon</div></div>';return;}
  const r=(state.rayons||[]).find(x=>x.id===selectedId);
  if(!r){det.innerHTML='<div class="detail-empty"><div class="detail-empty-icon">❓</div><div class="detail-empty-txt">Introuvable</div></div>';return;}
  const p=pct(r),c=barColor(p,r.universe,r.color),doneC=(r.tasks||[]).filter(t=>t.done).length;
  const uc=r.universe==='CUISINE'?'cuisine':'rangement';
  const urgC=(r.tasks||[]).filter(t=>t.urgent&&!t.done).length;
  const membersH=(r.members||[]).map(m=>`<div class="av-av" style="background:${teamColor(m)}">${m.slice(0,2).toUpperCase()}</div>`).join('');
  const assignOpts=TEAM.map(m=>`<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('');

  const tasksH=(r.tasks||[]).map(t=>{
    const stH=(t.subtasks||[]).map((st,i)=>`
      <div class="subtask-row">
        <div class="subtask-cb ${st.done?'done':''}" onclick="toggleSubtask('${r.id}','${t.id}',${i})"></div>
        <span class="subtask-lbl ${st.done?'done':''}">${esc(st.label)}</span>
        <button class="subtask-del" onclick="delSubtask('${r.id}','${t.id}',${i})">×</button>
      </div>`).join('');
    const stDone=(t.subtasks||[]).filter(s=>s.done).length;
    const stTotal=(t.subtasks||[]).length;
    const assignSel=`<option value="" ${!t.assign?'selected':''}>— Personne —</option>`+TEAM.map(m=>`<option value="${esc(m.name)}" ${t.assign===m.name?'selected':''}>${esc(m.name)}</option>`).join('');
    return`<div class="task-card ${t.urgent&&!t.done?'urgent':''} ${t.done?'done':''}">
      <div class="task-main" onclick="toggleTD('${t.id}',event)">
        
        <div class="task-main-top">
          <!-- Case à cocher désactivée au profit des boutons d'implantation -->
          <div class="task-title-row">
            <div style="display:flex;flex-direction:column;gap:4px">
              <span class="task-title ${t.done?'done':''}" id="tlbl-${t.id}" onclick="event.stopPropagation();startRename('${r.id}','${t.id}')">${esc(t.label)}</span>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="font-size:10px;font-weight:800;padding:2px 6px;border-radius:4px;background:${t.taskType==='fond_rayon'?'var(--rangement-bg)':'var(--cuisine-bg)'};color:${t.taskType==='fond_rayon'?'var(--rangement-dark)':'var(--cuisine-dark)'};border:1px solid ${t.taskType==='fond_rayon'?'var(--rangement-border)':'var(--cuisine-border)'};text-transform:uppercase;">${t.taskType==='fond_rayon'?'📦 Fond de rayon':'🛋 Showroom'}</span>
                ${t.assign?`<span class="task-assign-pill" style="background:${teamColor(t.assign)};padding:2px 7px;font-size:10px">${esc(t.assign)}</span>`:''}
                ${t.notes?`<span style="font-size:12px;cursor:help;" title="${esc(t.notes)}">📝 Notes</span>`:''}
                ${(t.pdfs&&t.pdfs.length)?`<span style="font-size:12px;" title="${t.pdfs.length} document${t.pdfs.length>1?'s':''}">📎 Docs (${t.pdfs.length})</span>`:''}
              </div>
            </div>
            <span class="task-urgent-flag ${t.urgent?'active':''}" title="Marquer comme Urgent" onclick="event.stopPropagation();setUrgent('${r.id}','${t.id}',${!t.urgent})">🚩</span>
          </div>
        </div>

        <div class="task-steps">
          <div class="ts-btn ${t.implante?'active':''}" onclick="event.stopPropagation();setImplante('${r.id}','${t.id}',${!t.implante})">
            ${t.implante?'✅':'🏗️'} Implanté
          </div>
          <div class="ts-btn ${t.micromerch?'active':''} ${t.implante?'':'disabled'}" onclick="event.stopPropagation();${t.implante?`setMicromerch('${r.id}','${t.id}',${!t.micromerch})`:''}">
            ${t.micromerch?'✅':'🔒'} Micro-merch
          </div>
          <div class="ts-btn ${t.adressage?'active':''} ${t.implante?'':'disabled'}" onclick="event.stopPropagation();${t.implante?`setAdressage('${r.id}','${t.id}',${!t.adressage})`:''}">
            ${t.adressage?'✅':'🔒'} Adressage
          </div>
        </div>

      </div>
      <div class="task-detail" id="td-${t.id}" >
        <div class="td-row" style="padding-bottom:12px;border-bottom:1px solid var(--border)">
          <span class="td-lbl" style="padding-top:8px">Actions</span>
          <button class="task-del-btn" style="opacity:1;background:var(--red-bg);color:var(--red);border:1px solid var(--red-border);font-weight:700;padding:6px 12px;margin-left:auto;font-size:12px" onclick="event.stopPropagation();delTask('${r.id}','${t.id}')">🗑 Supprimer Tâche</button>
        </div>
        <div class="td-row">
          <span class="td-lbl">Assigné à</span>
          <select class="td-sel" onchange="setTaskAssign('${r.id}','${t.id}',this.value)">${assignSel}</select>
        </div>
        <div class="td-row" style="flex-direction:column;gap:5px;width:100%">
          <span class="td-lbl" style="padding-top:0">Notes</span>
          <textarea class="td-notes" placeholder="Notes techniques…" oninput="setNotes('${r.id}','${t.id}',this.value)">${esc(t.notes||'')}</textarea>
        </div>
        <div class="td-row" style="flex-direction:column;gap:6px;width:100%">
          <span class="td-lbl" style="padding-top:0">Sous-tâches <span style="font-size:11px;color:var(--text3);font-weight:400;text-transform:none;letter-spacing:0">(toutes requises pour terminer)</span></span>
          <div class="subtasks-wrap">${stH||'<span style="font-size:13px;color:var(--text3);font-style:italic">Aucune sous-tâche</span>'}</div>
          <div class="subtask-add">
            <input class="subtask-inp" type="text" id="sti-${t.id}" placeholder="Ajouter une sous-tâche…" onkeydown="if(event.key==='Enter'){addSub('${r.id}','${t.id}');}"/>
            <button class="subtask-add-btn" onclick="addSub('${r.id}','${t.id}')">+</button>
          </div>
        </div>
        <div class="td-row" style="flex-direction:column;gap:6px;width:100%">
          <span class="td-lbl" style="padding-top:0">📄 Documents <span style="font-size:11px;color:var(--text3);font-weight:400;text-transform:none;letter-spacing:0">(liens Google Drive)</span></span>
          <div class="td-pdf-list" id="pdfl-${t.id}">${(t.pdfs||[]).map((p,i)=>`
            <div class="td-pdf-item">
              <div class="td-pdf-top">
                <span class="td-pdf-icon">📄</span>
                <span class="td-pdf-name" title="${esc(p.url)}">${esc(p.name)}</span>
              </div>
              <div class="td-pdf-actions">
                <a class="td-pdf-open" href="${esc(p.url)}" target="_blank">Ouvrir</a>
                <button class="td-pdf-del" onclick="delPdf('${r.id}','${t.id}',${i})">×</button>
              </div>
            </div>`).join('')||'<span style="font-size:13px;color:var(--text3);font-style:italic">Aucun document</span>'}
          </div>
          <div class="td-pdf-add" id="pdfadd-${t.id}">
            <input class="td-pdf-name-inp" type="text" id="pdfname-${t.id}" placeholder="Nom du document"/>
            <input class="td-pdf-url" type="text" id="pdfurl-${t.id}" placeholder="Lien Google Drive…" onkeydown="if(event.key==='Enter')addPdf('${r.id}','${t.id}')"/>
            <button class="td-pdf-add-btn" onclick="addPdf('${r.id}','${t.id}')">+ Ajouter</button>
          </div>
        </div>
        <div class="td-row" style="flex-direction:column;gap:6px;width:100%">
          <span class="td-lbl" style="padding-top:0">🚚 Commandes <span style="font-size:11px;color:var(--text3);font-weight:400;text-transform:none;letter-spacing:0">(n° et date d'arrivage)</span></span>
          <div class="td-cmd-list" id="cmdl-${t.id}">${(t.cmds||[]).length===0?'<span style="font-size:13px;color:var(--text3);font-style:italic">Aucune commande</span>':(t.cmds||[]).map((c,i)=>`
            <div class="td-cmd-item" style="flex-direction:column;align-items:flex-start;gap:6px;">
              <div style="display:flex;align-items:center;gap:8px;width:100%">
                <span class="td-cmd-num">${esc(c.num)}</span>
                <span class="td-cmd-date">${c.date?formatCmdDate(c.date):'-'}</span>
                <button class="td-cmd-status ${cmdStatusClass(c.status)}" onclick="cycleCmdStatus('${r.id}','${t.id}',${i})">${c.status||'En attente'}</button>
                <button class="td-cmd-del" style="margin-left:auto" onclick="delCmd('${r.id}','${t.id}',${i})">×</button>
              </div>
              <div class="td-cmd-rdv" style="margin-top:2px;">
                <span class="td-cmd-rdv-label">🏷️ Type :</span>
                <select class="td-cmd-inp" style="font-size:13px;padding:5px 10px;width:auto;" onchange="setCmdCategorie('${r.id}','${t.id}',${i},this.value)">
                  <option value="" ${!c.categorie?'selected':''}>— Choisir</option>
                  <option value="showroom" ${c.categorie==='showroom'?'selected':''}>🖼️ Showroom</option>
                  <option value="implantation" ${c.categorie==='implantation'?'selected':''}>🏗️ Implantation</option>
                </select>
              </div>
            </div>`).join('')}
          </div>
          <div class="td-cmd-add">
            <input class="td-cmd-inp td-cmd-inp-num" type="text" id="cmdnum-${t.id}" placeholder="N° commande…"/>
            <input class="td-cmd-inp td-cmd-inp-date" type="date" id="cmddate-${t.id}"/>
            <button class="td-cmd-add-btn" onclick="addCmd('${r.id}','${t.id}')">+ Ajouter</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  det.innerHTML=`
    <div class="dt-header">
      <div class="dt-icon-name">
        <div class="dt-icon" style="background:${r.color}18;color:${r.color}">${r.emoji||'📦'}</div>
        <div>
          <div class="dt-name">
          <span id="rayon-name-${r.id}">${esc(r.name)}</span>
          <button onclick="startRenameRayon(this)" data-rid="${r.id}" style="background:var(--bg3);border:1px solid var(--border2);color:var(--text2);font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;cursor:pointer;font-family:var(--font);margin-left:8px;vertical-align:middle;">✏️ Renommer</button>
          ${statusBadge(r)} ${urgC?`<span class="badge-urgent">⚡ ${urgC} urgent${urgC>1?'s':''}</span>`:''}</div>
          <div class="dt-meta">
            <span class="dt-utag ${uc}">${r.universe==='CUISINE'?'🍳 Cuisine':'📦 Rangement'}</span>
            <button onclick="switchUniverse('${r.id}')" style="background:var(--bg3);border:1px solid var(--border2);color:var(--text2);font-size:11px;font-weight:600;padding:3px 10px;border-radius:5px;cursor:pointer;font-family:var(--font);" title="Changer d'univers">⇄ Changer</button>
            <span style="color:var(--text3)">Leroy Merlin Livry-Gargan</span>
          </div>
          <div class="color-picker-row">
            <span class="color-picker-label">Couleur</span>
            ${[['#3d9142','🟢'],['#2660a8','🔵'],['#7c3aed','🟣'],['#e87722','🟠'],['#c94040','🔴']].map(([col,emoji])=>`
              <button data-rid="${r.id}" data-col="${col}" onclick="setRayonColorEl(this)"
                style="width:34px;height:34px;border-radius:50%;background:${col};border:${r.color===col?'3px solid #111':'2px solid transparent'};cursor:pointer;font-size:0;transition:transform .12s;flex-shrink:0;"
                title="${col}" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
              </button>`).join('')}
          </div>
        </div>
      </div>
      <select class="status-sel" onchange="setRayonStatus('${r.id}',this.value)">
        <option value="live" ${r.status==='live'?'selected':''}>● Live</option>
        <option value="bientot" ${r.status==='bientot'?'selected':''}>Bientôt</option>
        <option value="termine" ${r.status==='termine'?'selected':''}>Terminé</option>
      </select>
    </div>
    <div class="av-box">
      <div class="av-row">
        <span class="av-lbl">Avancement</span>
        <div class="av-track"><div class="av-fill" style="width:${p}%;background:${c}"></div></div>
        <span class="av-pct" style="color:${c}">${p}%</span>
      </div>
      <div class="eq-row"><span class="eq-lbl">Équipe :</span>${membersH}</div>
    </div>
    <div class="tasks-header-card"><span class="tasks-title">Sous-rayons</span><span class="tasks-count">${doneC}/${(r.tasks||[]).length} complétés</span></div>
    <div>
      ${tasksH||'<div style="padding:24px;text-align:center;color:var(--text3);font-size:15px;font-weight:600;">Aucun sous-rayon — ajoutez-en ci-dessous</div>'}
    </div>
    <div class="add-task-card">
      <input class="add-task-inp" type="text" id="add-task-${r.id}" placeholder="+ Nouveau sous-rayon…" onkeydown="if(event.key==='Enter')addTask('${r.id}')"/>
      <select id="task-type-${r.id}" style="background:var(--bg3);border:2px solid var(--border2);color:var(--text);font-size:13px;font-weight:700;padding:8px 12px;border-radius:10px;cursor:pointer;font-family:var(--font);outline:none;flex-shrink:0;" title="Type de sous-rayon">
        <option value="showroom">🛋 Showroom</option>
        <option value="fond_rayon">📦 Fond de rayon</option>
      </select>
      <button class="add-task-btn" onclick="addTask('${r.id}')">Ajouter</button>
    </div>`;
  // Rouvrir les détails qui étaient ouverts
  openTaskIds.forEach(tid=>{
    const el=document.getElementById('td-'+tid);
    if(el) el.classList.add('open');
  });
}

function toggleTD(tid, e){
  if(e){
    const t=e.target;
    const tag=t.tagName.toLowerCase();
    if(['select','input','textarea','button','a'].includes(tag)) return;
    if(t.classList.contains('task-cb')) return;
    if(t.classList.contains('task-lbl')) return;
    if(t.classList.contains('task-del-btn')) return;
    if(t.classList.contains('badge-urgent')) return;
    if(t.classList.contains('task-assign-pill')) return;
    if(t.classList.contains('task-subtask-count')) return;
    const detail=document.getElementById('td-'+tid);
    if(detail && detail.contains(t)) return;
  }
  const el=document.getElementById('td-'+tid);
  if(!el) return;
  el.classList.toggle('open');
  // Mémoriser l'état
  if(el.classList.contains('open')) openTaskIds.add(tid);
  else openTaskIds.delete(tid);
}

// ══ ACTIONS ══
function toggleTask(rid,tid){
  alert("L'avancement de la tâche se fait désormais via les étapes d'implantation (Implanté, Micro-merch, Adressage).");
}
function toggleSubtask(rid,tid,idx){
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  const t=(r.tasks||[]).find(x=>x.id===tid);if(!t||!t.subtasks)return;
  const st=t.subtasks[idx];if(!st)return;
  st.done=!st.done;
  const allDone=t.subtasks.length>0&&t.subtasks.every(s=>s.done);
  save(`${st.done?'✓':'○'} Sous-tâche "${st.label}"`);
}
function setTaskStatus(rid,tid,v){const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;const t=(r.tasks||[]).find(x=>x.id===tid);if(!t)return;t.status=v;t.done=(v==='Fait');save(`Statut "${t.label}" → ${v}`);}
function setTaskAssign(rid,tid,v){const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;const t=(r.tasks||[]).find(x=>x.id===tid);if(!t)return;t.assign=v;save(`Assigné "${t.label}" → ${v||'—'}`);}
function resetAssign(){if(confirm("Voulez-vous réinitialiser toutes les attributions de l'équipe ?")){ (state.rayons||[]).forEach(r=>(r.tasks||[]).forEach(t=>t.assign='')); save("Attributions réinitialisées"); render(); }}
function setUrgent(rid,tid,v){const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;const t=(r.tasks||[]).find(x=>x.id===tid);if(!t)return;t.urgent=v;save(`${v?'⚡ Urgent':'Urgence retirée'} : "${t.label}"`);}


// ══ IMPLANTATION ══
function updateTaskCompletion(t) {
  const isDone = !!(t.implante && t.micromerch && t.adressage);
  if (t.done !== isDone) {
    t.done = isDone;
    t.status = isDone ? 'Fait' : (t.status === 'Fait' ? 'En cours' : t.status);
  }
}

function setImplante(rid, tid, v){
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  const t=(r.tasks||[]).find(x=>x.id===tid);if(!t)return;
  t.implante=v;
  if(!v){ t.micromerch=false; t.adressage=false; }
  updateTaskCompletion(t);
  save(v?'🏗️ Implanté : '+t.label:'🏗️ Implantation retirée : '+t.label);
}
function setMicromerch(rid, tid, v){
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  const t=(r.tasks||[]).find(x=>x.id===tid);if(!t)return;
  t.micromerch=v; updateTaskCompletion(t); save('✅ Micro-merch "'+t.label+'" : '+(v?'OK':'retiré'));
}
function setAdressage(rid, tid, v){
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  const t=(r.tasks||[]).find(x=>x.id===tid);if(!t)return;
  t.adressage=v; updateTaskCompletion(t); save('✅ Adressage "'+t.label+'" : '+(v?'OK':'retiré'));
}


// ══ CATÉGORIE COMMANDE (manuelle) ══
function cycleCmdCategorie(rid, tid, idx){
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  const t=(r.tasks||[]).find(x=>x.id===tid);if(!t||!t.cmds)return;
  const c=t.cmds[idx];if(!c)return;
  const ordre=['','showroom','implantation'];
  const cur=ordre.indexOf(c.categorie||'');
  c.categorie=ordre[(cur+1)%ordre.length];
  save('🏷️ "'+c.num+'" → '+(c.categorie||'Non défini'));
}
function setCmdCategorie(rid, tid, idx, v){
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  const t=(r.tasks||[]).find(x=>x.id===tid);if(!t||!t.cmds)return;
  const c=t.cmds[idx];if(!c)return;
  c.categorie=v;
  save('🏷️ Catégorie commande "'+c.num+'" → '+v);
}
function cmdCatBadge(cat){
  if(cat==='showroom') return '<span class="logi-cat-badge showroom">🖼️ Showroom</span>';
  if(cat==='implantation') return '<span class="logi-cat-badge implantation">🏗️ Implantation</span>';
  return '<span class="logi-cat-badge" style="background:var(--bg3);color:var(--text3);border:1px dashed var(--border2);">— Non défini</span>';
}
// ══ COMMANDES ══
const CMD_STATUSES = ['En attente','Reçue'];
let _logiQuery = '';

function logiSearch(v){
  _logiQuery = v.trim().toLowerCase();
  renderLogistique();
}
function logiClearSearch(){
  _logiQuery = '';
  const inp = document.getElementById('logi-search');
  if(inp) inp.value = '';
  renderLogistique();
}

function cmdStatusClass(s){
  if(s==='Reçue') return 'recue';
  return 'attente';
}

function formatCmdDate(d){
  if(!d) return '-';
  const parts = d.split('-');
  if(parts.length!==3) return d;
  return parts[2]+'/'+parts[1]+'/'+parts[0];
}

function addCmd(rid,tid){
  const numInp = document.getElementById('cmdnum-'+tid);
  const dateInp = document.getElementById('cmddate-'+tid);
  if(!numInp) return;
  const num = numInp.value.trim();
  if(!num){alert('Saisissez un numéro de commande.');return;}
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  const t=(r.tasks||[]).find(x=>x.id===tid);if(!t)return;
  if(!t.cmds)t.cmds=[];
  t.cmds.push({num, date: dateInp?dateInp.value:'', status:'En attente'});
  numInp.value=''; if(dateInp)dateInp.value='';
  save('🚚 Commande "'+num+'" ajoutée à "'+t.label+'"');
}

function delCmd(rid,tid,idx){
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  const t=(r.tasks||[]).find(x=>x.id===tid);if(!t||!t.cmds)return;
  const num=t.cmds[idx]?t.cmds[idx].num:'';
  t.cmds.splice(idx,1);
  save('🗑 Commande "'+num+'" supprimée');
}

function cycleCmdStatus(rid,tid,idx){
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  const t=(r.tasks||[]).find(x=>x.id===tid);if(!t||!t.cmds)return;
  const c=t.cmds[idx];if(!c)return;
  const cur=CMD_STATUSES.indexOf(c.status||'En attente');
  c.status=CMD_STATUSES[(cur+1)%CMD_STATUSES.length];
  save('🚚 Statut commande "'+c.num+'" → '+c.status);
}


function renderLogistique(){
  const body = document.getElementById('logi-body');
  if(!body) return;

  // Collecter toutes les commandes
  const all = [];
  (state.rayons||[]).forEach(r=>{
    (r.tasks||[]).forEach(t=>{
      (t.cmds||[]).forEach((c,i)=>{
        all.push({cmd:c, idx:i, task:t, rayon:r});
      });
    });
  });

  if(!_logiQuery){
    body.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:var(--text3); font-size:15px; font-weight:600; line-height:1.5;">
        <div style="font-size:32px; margin-bottom:12px;">🔍</div>
        Saisissez un numéro de commande dans la barre de recherche ci-dessus pour retrouver ses détails (rayon, sous-rayon, statut d'arrivage).
      </div>
    `;
    return;
  }

  const filtered = all.filter(({cmd})=>
    cmd.num.toLowerCase().includes(_logiQuery)
  );

  if(!filtered.length){
    body.innerHTML = `<div class="logi-empty">Aucune commande correspondante pour "${esc(_logiQuery)}".</div>`;
    return;
  }

  // Trier par date d'arrivage
  const today = new Date(); today.setHours(0,0,0,0);
  filtered.sort((a,b)=>{
    const da=a.cmd.date?new Date(a.cmd.date):new Date('9999-12-31');
    const db=b.cmd.date?new Date(b.cmd.date):new Date('9999-12-31');
    return da-db;
  });

  function cardClass(cmd){
    if(cmd.status==='Reçue') return 'recue';
    if(!cmd.date) return 'avenir';
    const d=new Date(cmd.date);d.setHours(0,0,0,0);
    if(d<today) return 'retard';
    if(d.getTime()===today.getTime()) return 'auj';
    return 'avenir';
  }

  body.innerHTML = `
    <div style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:var(--text3); padding:6px 0 10px 2px; border-bottom:1px solid var(--border); margin-bottom:10px;">
      Résultats de recherche (${filtered.length})
    </div>
    ` + filtered.map(({cmd,idx,task,rayon})=>`
      <div class="logi-card ${cardClass(cmd)}">
        <div class="logi-card-header">
          <span onclick="cycleCmdCategorie('${rayon.id}','${task.id}',${idx})" style="cursor:pointer" title="Cliquer pour changer">${cmdCatBadge(cmd.categorie)}</span>
          <span class="logi-cmd-num">${esc(cmd.num)}</span>
          <span class="logi-date ${cardClass(cmd)}" style="margin-left:auto;flex-shrink:0">${cmd.date?formatCmdDate(cmd.date):'—'}</span>
          <button class="logi-status-btn ${cmdStatusClass(cmd.status)}" onclick="cycleCmdStatus('${rayon.id}','${task.id}',${idx})">${cmd.status||'En attente'}</button>
        </div>
        <div class="logi-detail">📋 ${esc(task.label)} &nbsp;·&nbsp; 📍 ${esc(rayon.name)}</div>
      </div>`).join('');
}




let _notesTimer=null;
function setNotes(rid,tid,v){
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  const t=(r.tasks||[]).find(x=>x.id===tid);if(!t)return;
  t.notes=v;
  clearTimeout(_notesTimer);
  _notesTimer=setTimeout(()=>{ save('ℹ Note sur "'+t.label+'"'); }, 1500);
}
function addPdf(rid,tid){
  const nameInp=document.getElementById('pdfname-'+tid);
  const urlInp=document.getElementById('pdfurl-'+tid);
  if(!nameInp||!urlInp)return;
  const name=nameInp.value.trim();
  const url=urlInp.value.trim();
  if(!url){alert('Collez un lien Google Drive.');return;}
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  const t=(r.tasks||[]).find(x=>x.id===tid);if(!t)return;
  if(!t.pdfs)t.pdfs=[];
  t.pdfs.push({name:name||'Document',url});
  nameInp.value='';urlInp.value='';
  save(`📄 Document "${name||'Document'}" ajouté à "${t.label}"`);
}
function delPdf(rid,tid,idx){
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  const t=(r.tasks||[]).find(x=>x.id===tid);if(!t||!t.pdfs)return;
  const name=t.pdfs[idx]?.name||'';
  t.pdfs.splice(idx,1);
  save(`📄 Document "${name}" supprimé`);
}
function addSub(rid,tid){
  const inp=document.getElementById('sti-'+tid);if(!inp)return;
  const v=inp.value.trim();if(!v)return;
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  const t=(r.tasks||[]).find(x=>x.id===tid);if(!t)return;
  if(!t.subtasks)t.subtasks=[];
  t.subtasks.push({label:v,done:false}); inp.value='';
  save(`+ Sous-tâche : "${v}"`);
}
function delSubtask(rid,tid,idx){const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;const t=(r.tasks||[]).find(x=>x.id===tid);if(!t)return;t.subtasks.splice(idx,1);save('− Sous-tâche supprimée');}
function addTask(rid){
  const inp=document.getElementById('add-task-'+rid);if(!inp)return;
  const v=inp.value.trim();if(!v)return;
  const typeSel=document.getElementById('task-type-'+rid);
  const taskType=typeSel?typeSel.value:'showroom';
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  if(!r.tasks)r.tasks=[];
  r.tasks.push(makeTask(v, taskType)); inp.value='';
  save(`+ Sous-rayon "${v}" [${taskType==='showroom'?'Showroom':'Fond de rayon'}] (${r.name})`);
}
function delTask(rid,tid){const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;const t=(r.tasks||[]).find(x=>x.id===tid);r.tasks=(r.tasks||[]).filter(x=>x.id!==tid);save(`− Tâche "${t?t.label:''}" supprimée`);}
function delRayon(rid){const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;if(!confirm(`Supprimer "${r.name}" ?`))return;if(selectedId===rid)selectedId=null;state.rayons=(state.rayons||[]).filter(x=>x.id!==rid);save(`− Rayon "${r.name}" supprimé`);}
function setRayonStatus(rid,v){const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;r.status=v;save(`Rayon "${r.name}" → ${v}`);}
function setRayonColorEl(btn){
  const rid=btn.dataset.rid, color=btn.dataset.col;
  setRayonColor(rid, color);
}
function setRayonColor(rid, color){
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  r.color=color;
  save(`🎨 Couleur de "${r.name}" → ${color}`);
}
function switchUniverse(rid){
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  const oldU=r.universe;
  r.universe=oldU==='CUISINE'?'RANGEMENT':'CUISINE';
  save(`↔ "${r.name}" : ${oldU} → ${r.universe}`);
}

function startRenameRayon(btn){
  if(event) event.stopPropagation();
  const rid = btn.dataset.rid;
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  const span=document.getElementById('rayon-name-'+rid);if(!span)return;
  const old=r.name;
  const inp=document.createElement('input');
  inp.value=old;
  inp.style.cssText='font-size:24px;font-weight:700;font-family:var(--font);border:none;border-bottom:2px solid var(--green);outline:none;background:var(--bg3);padding:2px 8px;border-radius:6px;color:var(--text);width:100%;letter-spacing:-.3px;';
  span.replaceWith(inp); inp.focus(); inp.select();
  function commit(){
    const v=inp.value.trim();
    if(v&&v!==old){r.name=v;save(`✎ Rayon renommé : "${old}" → "${v}"`);}
    else{renderDetail();}
  }
  inp.addEventListener('blur',commit);
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();inp.blur();}if(e.key==='Escape'){inp.value=old;inp.blur();}});
}

function startRename(rid,tid){
  const r=(state.rayons||[]).find(x=>x.id===rid);if(!r)return;
  const t=(r.tasks||[]).find(x=>x.id===tid);if(!t)return;
  const span=document.getElementById('tlbl-'+tid);if(!span)return;
  const old=t.label;
  const inp=document.createElement('input');
  inp.value=old;
  inp.style.cssText='flex:1;font-size:16px;font-weight:500;font-family:var(--font);border:none;border-bottom:2px solid var(--green);outline:none;background:var(--bg3);padding:2px 6px;border-radius:4px;color:var(--text);width:100%;';
  span.replaceWith(inp); inp.focus(); inp.select();
  function commit(){const v=inp.value.trim();if(v&&v!==old){t.label=v;save(`✎ "${old}" → "${v}"`);}else{render();}}
  inp.addEventListener('blur',commit);
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();inp.blur();}if(e.key==='Escape'){inp.value=old;inp.blur();}});
  inp.addEventListener('click',e=>e.stopPropagation());
}


// ══ VISIONNEUSE PLANS ══
let planScale=1, planX=0, planY=0, planDragging=false;
let planDragStartX=0, planDragStartY=0, planDragOriginX=0, planDragOriginY=0;
let planCurrentIdx=0;
let planLastDist=0;

function openPlans(){
  document.getElementById('plans-overlay').classList.add('open');
  planReset();
}
function closePlans(){
  document.getElementById('plans-overlay').classList.remove('open');
}
function switchPlan(idx){
  document.querySelectorAll('.plans-tab').forEach((t,i)=>t.classList.toggle('active',i===idx));
  document.querySelectorAll('#plans-img-wrap img').forEach((img,i)=>img.style.display=i===idx?'block':'none');
  planCurrentIdx=idx;
  planReset();
}
function planReset(){
  planScale=1; planX=0; planY=0;
  applyPlanTransform();
}
function planZoom(factor){
  planScale=Math.min(8, Math.max(0.3, planScale*factor));
  applyPlanTransform();
}
function applyPlanTransform(){
  const img=document.querySelector('#plans-img-wrap img[style*="block"]');
  if(img) img.style.transform=`translate(calc(-50% + ${planX}px), calc(-50% + ${planY}px)) scale(${planScale})`;
}

// ── Drag souris ──
const wrap=()=>document.getElementById('plans-img-wrap');
document.addEventListener('DOMContentLoaded',()=>{
  const w=wrap();
  if(!w)return;
  w.addEventListener('mousedown',e=>{
    planDragging=true;
    planDragStartX=e.clientX; planDragStartY=e.clientY;
    planDragOriginX=planX; planDragOriginY=planY;
    e.preventDefault();
  });
  document.addEventListener('mousemove',e=>{
    if(!planDragging)return;
    planX=planDragOriginX+(e.clientX-planDragStartX);
    planY=planDragOriginY+(e.clientY-planDragStartY);
    applyPlanTransform();
  });
  document.addEventListener('mouseup',()=>planDragging=false);

  // ── Molette zoom ──
  w.addEventListener('wheel',e=>{
    e.preventDefault();
    planZoom(e.deltaY<0?1.15:0.87);
  },{passive:false});

  // ── Touch : pinch + drag ──
  w.addEventListener('touchstart',e=>{
    if(e.touches.length===1){
      planDragging=true;
      planDragStartX=e.touches[0].clientX; planDragStartY=e.touches[0].clientY;
      planDragOriginX=planX; planDragOriginY=planY;
    } else if(e.touches.length===2){
      planDragging=false;
      planLastDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
    }
    e.preventDefault();
  },{passive:false});
  w.addEventListener('touchmove',e=>{
    if(e.touches.length===1&&planDragging){
      planX=planDragOriginX+(e.touches[0].clientX-planDragStartX);
      planY=planDragOriginY+(e.touches[0].clientY-planDragStartY);
      applyPlanTransform();
    } else if(e.touches.length===2){
      const dist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
      if(planLastDist>0) planZoom(dist/planLastDist);
      planLastDist=dist;
    }
    e.preventDefault();
  },{passive:false});
  w.addEventListener('touchend',e=>{planDragging=false;planLastDist=0;});
});

// Fermer avec Échap
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePlans();});

// ══ MOT DE PASSE ══
function showPwd(){
  document.getElementById('pwd-overlay').classList.add('show');
  setTimeout(()=>document.getElementById('pwd-input').focus(), 100);
}
function hidePwd(){
  document.getElementById('pwd-overlay').classList.remove('show');
}
function checkPwd(){
  const val = document.getElementById('pwd-input').value;
  const err = document.getElementById('pwd-err');
  if(val === APP_PWD){
    err.textContent = '';
    document.getElementById('pwd-input').value = '';
    hidePwd();
    // Si prénom déjà connu, charger directement
    const savedUser = localStorage.getItem(LS_USER);
    if(savedUser && TEAM.find(m=>m.name===savedUser)){
      selectUser(savedUser);
    } else {
      showAuth();
    }
  } else {
    err.textContent = '❌ Mot de passe incorrect';
    document.getElementById('pwd-input').value = '';
    document.getElementById('pwd-input').focus();
    // Petite vibration sur mobile
    if(navigator.vibrate) navigator.vibrate(200);
  }
}

// ══ RÉTROPLANIFICATION ══
function openRetroModal(){
  document.getElementById('retro-modal-overlay').classList.add('open');
  document.getElementById('retro-label-inp').value='';
  document.getElementById('retro-date-inp').value='';
  setTimeout(()=>document.getElementById('retro-date-inp').focus(),50);
}
function closeRetroModal(){document.getElementById('retro-modal-overlay').classList.remove('open');}
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('retro-modal-overlay').addEventListener('click',e=>{
    if(e.target===document.getElementById('retro-modal-overlay'))closeRetroModal();
  });
  document.getElementById('retro-label-inp').addEventListener('keydown',e=>{if(e.key==='Enter')confirmAddDate();});
});
function confirmAddDate(){
  const date=document.getElementById('retro-date-inp').value;
  const label=document.getElementById('retro-label-inp').value.trim();
  if(!date||!label){alert('Renseignez la date et la description.');return;}
  if(!state.retro)state.retro=[];
  state.retro.push({id:'rd'+Date.now(),date,label});
  closeRetroModal();
  save(`📅 Date ajoutée : "${label}"`);
}
function delRetroDate(id){
  if(!state.retro)return;
  state.retro=state.retro.filter(d=>d.id!==id);
  save('📅 Date supprimée');
}
function getDateClass(dateStr){
  const today=new Date(); today.setHours(0,0,0,0);
  const d=new Date(dateStr); d.setHours(0,0,0,0);
  const diff=Math.round((d-today)/(1000*60*60*24));
  if(diff<0)return'past';
  if(diff<=7)return'urgent';
  if(diff<=30)return'soon';
  return'future';
}
function getCountdown(dateStr){
  const today=new Date(); today.setHours(0,0,0,0);
  const d=new Date(dateStr); d.setHours(0,0,0,0);
  const diff=Math.round((d-today)/(1000*60*60*24));
  if(diff<0)return`Il y a ${Math.abs(diff)} jour${Math.abs(diff)>1?'s':''}`;
  if(diff===0)return"Aujourd'hui !";
  if(diff===1)return'Demain';
  return`Dans ${diff} jour${diff>1?'s':''}`;
}
function formatDate(dateStr){
  const d=new Date(dateStr+'T00:00:00');
  return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
}
function renderRetro(){
  const body=document.getElementById('retro-body');
  if(!body)return;
  if(!state.retro||!state.retro.length){
    body.innerHTML='<div class="retro-empty">Aucune date clé.<br>Ajoutez vos jalons.</div>';
    return;
  }
  // Trier du plus proche au plus lointain (futur d'abord, puis passé)
  const today=new Date(); today.setHours(0,0,0,0);
  const sorted=[...state.retro].sort((a,b)=>{
    const da=new Date(a.date), db=new Date(b.date);
    const fa=da>=today, fb=db>=today;
    if(fa&&fb)return da-db; // deux futurs : plus proche d'abord
    if(!fa&&!fb)return db-da; // deux passés : plus récent d'abord
    return fa?-1:1; // futur avant passé
  });
  body.innerHTML=sorted.map((item,i)=>{
    const cls=getDateClass(item.date);
    const countdown=getCountdown(item.date);
    const isLast=i===sorted.length-1;
    return`<div class="retro-item">
      <div class="retro-spine">
        <div class="retro-dot ${cls}"></div>
        ${!isLast?'<div class="retro-line"></div>':''}
      </div>
      <div class="retro-content">
        <div class="retro-card ${cls}">
          <button class="retro-del" onclick="delRetroDate('${item.id}')">×</button>
          <div class="retro-date ${cls}">${formatDate(item.date)}</div>
          <div class="retro-label">${esc(item.label)}</div>
          <div class="retro-countdown ${cls}">${countdown}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ══ MES TÂCHES ══
function toggleMyTasks(){
  const body=document.getElementById('mytasks-body');
  const toggle=document.getElementById('mytasks-toggle');
  if(!body)return;
  const isOpen=body.style.display!=='none';
  body.style.display=isOpen?'none':'grid';
  if(toggle)toggle.className='mytasks-head-toggle'+(isOpen?'':' open');
}

function renderMyTasks(){
  const body=document.getElementById('mytasks-body');
  const countEl=document.getElementById('mytasks-count');
  if(!body||!currentUser)return;

  // Collecter toutes les tâches assignées à l'utilisateur connecté
  const myTasks=[];
  (state.rayons||[]).forEach(r=>{
    (r.tasks||[]).forEach(t=>{
      if(t.assign===currentUser && !t.done){
        myTasks.push({task:t, rayon:r});
      }
    });
  });

  // Trier : urgentes d'abord, puis en cours, puis à faire, puis faites
  const order={'Bloqué':0,'En cours':1,'À faire':2,'Fait':3};
  myTasks.sort((a,b)=>{
    if(a.task.urgent&&!a.task.done&&!(b.task.urgent&&!b.task.done))return -1;
    if(b.task.urgent&&!b.task.done&&!(a.task.urgent&&!a.task.done))return 1;
    return (order[a.task.status]||2)-(order[b.task.status]||2);
  });

  // Mettre à jour le compteur (tâches non faites)
  const pending=myTasks.filter(m=>!m.task.done).length;
  if(countEl)countEl.textContent=pending;

  if(!myTasks.length){
    body.innerHTML='<div class="mytask-empty">Aucun sous-rayon assigné.</div>';
    return;
  }

  body.innerHTML=myTasks.map(({task:t, rayon:r})=>{
    const stDone=(t.subtasks||[]).filter(s=>s.done).length;
    const stTotal=(t.subtasks||[]).length;
    const statusClass=t.status==='Fait'?'fait':t.status==='En cours'?'en-cours':t.status==='Bloqué'?'bloque':'a-faire';
    const ucSlug=r.universe==='CUISINE'?'cuisine':'rangement';
    return`<div class="mytask-card ${t.done?'done-card':''}" onclick="goToTask('${r.id}','${t.id}')">
      <div class="mytask-left">
        <div class="mytask-name ${t.done?'done':''}">${t.urgent&&!t.done?'⚡ ':''}${esc(t.label)}</div>
        <div class="mytask-rayon">${r.universe==='CUISINE'?'🍳':'📦'} ${esc(r.name)}</div>
      </div>
      <div class="mytask-right">
        <span class="mytask-status ${statusClass}">${esc(t.status)}</span>
        <span class="mytask-prog">${stDone}/${stTotal}</span>
      </div>
    </div>`;
  }).join('');
}

function goToTask(rayonId, taskId){
  selectedId=rayonId;
  if(isMobile()){
    // Sur mobile : naviguer vers col-detail EN PREMIER, avant tout render
    switchView('operationnel');
    openMobileSheet();
    // Puis faire un render léger : juste renderDetail() sans mobileEnforce()
    openTaskIds.add(taskId);
    renderDetail();
    // Scroll vers la tâche
    setTimeout(()=>{
      const el=document.getElementById('td-'+taskId);
      if(el){
        el.classList.add('open');
        openTaskIds.add(taskId);
        const card=el.closest('.task-card');
        if(card) card.scrollIntoView({behavior:'smooth', block:'center'});
      }
    }, 150);
  } else {
    // Desktop : render complet normal
    render();
    setTimeout(()=>{
      const el=document.getElementById('td-'+taskId);
      if(el){
        el.classList.add('open');
        openTaskIds.add(taskId);
        const card=el.closest('.task-card');
        if(card) card.scrollIntoView({behavior:'smooth', block:'center'});
      }
    }, 100);
  }
}

// ══ TÂCHES ÉQUIPE ══
function toggleTeamTasks(){
  const body=document.getElementById('teamtasks-body');
  const toggle=document.getElementById('teamtasks-toggle');
  if(!body)return;
  const isOpen=body.style.display!=='none';
  body.style.display=isOpen?'none':'grid';
  if(toggle)toggle.className='teamtasks-head-toggle'+(isOpen?'':' open');
}

function renderTeamTasks(){
  const body=document.getElementById('teamtasks-body');
  if(!body)return;

  // Regrouper toutes les tâches assignées par membre
  const byMember={};
  TEAM.forEach(m=>{ byMember[m.name]=[]; });

  (state.rayons||[]).forEach(r=>{
    (r.tasks||[]).forEach(t=>{
      if(t.assign && byMember[t.assign]!==undefined && !t.done){
        byMember[t.assign].push({task:t, rayon:r});
      }
    });
  });

  const statusOrder={'Bloqué':0,'En cours':1,'À faire':2,'Fait':3};

  // Filtrer les membres qui ont au moins une tâche
  const members=TEAM.filter(m=>byMember[m.name].length>0);

  if(!members.length){
    body.innerHTML=`<div class="teamtasks-empty">Aucun sous-rayon assigné dans l'équipe.</div>`;
    return;
  }

  body.innerHTML=members.map(m=>{
    const tasks=byMember[m.name].sort((a,b)=>{
      if(a.task.urgent&&!a.task.done&&!(b.task.urgent&&!b.task.done))return -1;
      if(b.task.urgent&&!b.task.done&&!(a.task.urgent&&!a.task.done))return 1;
      return (statusOrder[a.task.status]||2)-(statusOrder[b.task.status]||2);
    });
    const pending=tasks.filter(x=>!x.task.done).length;
    const isMe=m.name===currentUser;
    const borderColor=isMe?'var(--cuisine)':'var(--border2)';

    const taskCards=tasks.map(({task:t,rayon:r})=>{
      const statusClass=t.status==='Fait'?'fait':t.status==='En cours'?'en-cours':t.status==='Bloqué'?'bloque':'a-faire';
      const stDone=(t.subtasks||[]).filter(s=>s.done).length;
      const stTotal=(t.subtasks||[]).length;
      return`<div class="teamtask-card ${t.done?'done-card':''}" style="border-left-color:${m.color}" onclick="goToTask('${r.id}','${t.id}')">
        <div class="teamtask-info">
          <div class="teamtask-name ${t.done?'done':''}">${t.urgent&&!t.done?'⚡ ':''}${esc(t.label)}</div>
          <div class="teamtask-rayon">${r.universe==='CUISINE'?'🍳':'📦'} ${esc(r.name)}</div>
        </div>
        <div class="teamtask-badges">
          <span class="teamtask-status ${statusClass}">${esc(t.status)}</span>
          <span style="font-size:11px;color:var(--text3);font-family:var(--mono);font-weight:600;">${stDone}/${stTotal}</span>
        </div>
      </div>`;
    }).join('');

    return`<div class="team-member-block">
      <div class="team-member-header">
        <div class="team-member-av" style="background:${m.color}">${m.name.slice(0,2).toUpperCase()}</div>
        <span class="team-member-name" style="${isMe?'color:var(--cuisine-dark)':''}">${esc(m.name)}${isMe?' (moi)':''}</span>
        <span class="team-member-count">${pending} en cours · ${tasks.length} total</span>
      </div>
      ${taskCards}
    </div>`;
  }).join('');
}

// ══ MODAL ══
function selUni(u){_selUni=u;document.getElementById('uni-c').className='uni-btn'+(u==='CUISINE'?' sel-cuisine':'');document.getElementById('uni-r').className='uni-btn'+(u==='RANGEMENT'?' sel-rangement':'');}
function openAddModal(){_mt=[];_selUni='CUISINE';document.getElementById('new-rayon-name').value='';document.getElementById('new-task-field').value='';document.getElementById('modal-tlist').innerHTML='';selUni('CUISINE');document.getElementById('add-modal').classList.add('open');setTimeout(()=>document.getElementById('new-rayon-name').focus(),50);}
function closeModal(){document.getElementById('add-modal').classList.remove('open');}
function addModalTask(){const inp=document.getElementById('new-task-field');const v=inp.value.trim();if(!v)return;_mt.push(v);inp.value='';document.getElementById('modal-tlist').innerHTML=_mt.map(t=>`<div class="modal-titem">· ${esc(t)}</div>`).join('');inp.focus();}
function confirmAddRayon(){
  const name=document.getElementById('new-rayon-name').value.trim();if(!name){alert('Entrez un nom.');return;}
  const isCuis=_selUni==='CUISINE';
  const colors=isCuis?C_COLORS:R_COLORS, emojis=isCuis?C_EMOJIS:R_EMOJIS;
  const idx=rayonsOf(_selUni).length;
  const tasks=_mt.map(l=>makeTask(l));
  const nr={id:'r'+Date.now(),name,emoji:emojis[idx%emojis.length],color:colors[idx%colors.length],universe:_selUni,status:'bientot',members:[],tasks};
  (state.rayons=state.rayons||[]).push(nr); selectedId=nr.id;
  closeModal(); save(`+ Rayon "${name}" [${_selUni}] créé`);
}
document.getElementById('new-task-field').addEventListener('keydown',e=>{if(e.key==='Enter')addModalTask();});
document.getElementById('new-rayon-name').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('new-task-field').focus();});
document.getElementById('add-modal').addEventListener('click',e=>{if(e.target===document.getElementById('add-modal'))closeModal();});
document.getElementById('cfg-sheet-id').addEventListener('keydown',e=>{if(e.key==='Enter')doConfig();});

// ══ INIT ══

// ══ COLLAPSE COLONNES ══
function toggleCollapse(colId){
  if(isMobile()) return; // Pas de collapse sur mobile
  const col = document.getElementById(colId);
  if(!col) return;
  col.classList.toggle('collapsed');
  // Restaurer la flex:1 sur col-detail si on collapse/déploie une autre colonne
  const isCollapsed = col.classList.contains('collapsed');
  try { localStorage.setItem('col_collapsed_'+colId, isCollapsed?'1':'0'); } catch(e){}
}

function restoreCollapseState(){
  if(isMobile()) return;
  ['col-sidebar','col-retro','col-mytasks','col-teamtasks','col-logi'].forEach(id=>{
    try {
      if(localStorage.getItem('col_collapsed_'+id)==='1'){
        const col=document.getElementById(id);
        if(col) col.classList.add('collapsed');
      }
    } catch(e){}
  });
}

// Sur petit écran desktop (< 1100px), auto-collapse les colonnes secondaires si pas de préférence sauvegardée
function autoCollapseForSmallDesktop(){
  if(isMobile()) return;
  if(window.innerWidth >= 1100) return;
  const secondary = ['col-retro','col-mytasks','col-teamtasks','col-logi'];
  secondary.forEach(id=>{
    try {
      // Seulement si l'utilisateur n'a pas de préférence explicite
      if(localStorage.getItem('col_collapsed_'+id) === null){
        const col=document.getElementById(id);
        if(col) col.classList.add('collapsed');
      }
    } catch(e){
      const col=document.getElementById(id);
      if(col) col.classList.add('collapsed');
    }
  });
}

// ══ NAVIGATION MOBILE ══
let mobileCurrentCol = 'col-sidebar';

function isMobile(){ return window.innerWidth <= 600; }

let currentView = 'operationnel';

function switchView(viewName) {
  currentView = viewName;
  
  // Hide all views
  document.querySelectorAll('.app-view').forEach(v => {
    v.classList.remove('active');
    v.style.display = 'none';
  });
  
  // Show target view
  const view = document.getElementById('view-' + viewName);
  if (view) {
    view.classList.add('active');
    view.style.display = 'flex';
  }
  
  // Update Top Nav (Desktop)
  document.querySelectorAll('.top-nav-btn').forEach(b => b.classList.remove('active'));
  let deskTab = document.getElementById(
    viewName === 'operationnel' ? 'desk-tab-op' :
    viewName === 'pilotage' ? 'desk-tab-pil' : 
    viewName === 'plan' ? 'desk-tab-plan' : 'desk-tab-log'
  );
  if(deskTab) deskTab.classList.add('active');
  
  // Update Bottom Nav (Mobile)
  document.querySelectorAll('.mobile-tab').forEach(b => b.classList.remove('active'));
  let mobTab = document.getElementById(
    viewName === 'operationnel' ? 'tab-op' :
    viewName === 'pilotage' ? 'tab-pil' : 
    viewName === 'plan' ? 'tab-plan' : 'tab-log'
  );
  if(mobTab) mobTab.classList.add('active');
}

function mobileEnforce(){
  switchView(currentView);
}

function mobileInit(){
  switchView('operationnel');
}

function openMobileSheet() {
  const detail = document.getElementById('col-detail');
  if (detail) detail.classList.add('sheet-open');
}

function closeMobileSheet() {
  const detail = document.getElementById('col-detail');
  if (detail) detail.classList.remove('sheet-open');
}

// Quand on sélectionne un rayon sur mobile → ouvrir le bottom sheet
const _origRender = null;
function mobileOnRayonSelect(){
  if(isMobile() && selectedId){
    openMobileSheet();
  }
}

// Mettre à jour le badge "Mes tâches"
function updateMobileBadge(){
  const badge = document.getElementById('mobile-badge-moi');
  const count = document.getElementById('mytasks-count');
  if(!badge||!count) return;
  const n = parseInt(count.textContent)||0;
  if(n>0){ badge.textContent=n; badge.style.display='flex'; }
  else { badge.style.display='none'; }
}

// ══ RESIZE — poignées glissables ══
function initDragHandles(){
  document.querySelectorAll('.drag-handle').forEach(handle=>{
    const targetId = handle.dataset.target;
    const dir = handle.dataset.dir; // 'right' = la colonne à gauche grandit, 'left' = celle à droite
    const target = document.getElementById(targetId);
    if(!target) return;
    let startX, startW;
    handle.addEventListener('mousedown', e=>{
      startX = e.clientX;
      startW = target.offsetWidth;
      handle.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      function onMove(e){
        const delta = dir==='right' ? e.clientX - startX : startX - e.clientX;
        const newW = Math.max(160, Math.min(700, startW + delta));
        target.style.width = newW + 'px';
        target.style.flex = 'none';
      }
      function onUp(){
        handle.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    });
  });
}

function hideSplash(){
  const s=document.getElementById('splash');
  if(s) s.classList.add('hidden');
}

window.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{ initDragHandles(); mobileInit(); restoreCollapseState(); autoCollapseForSmallDesktop(); }, 200);
  let _lastWidth = window.innerWidth;
  window.addEventListener('resize', ()=>{
    const newWidth = window.innerWidth;
    if(!isMobile()){
      document.querySelectorAll('.col-panel').forEach(c=>{ c.classList.remove('mobile-active'); c.style.display=''; c.style.transform=''; });
    } else if(newWidth !== _lastWidth){
      mobileInit();
    }
    _lastWidth = newWidth;
  });
  // Mot de passe demandé à chaque ouverture
  setTimeout(()=>{ hideSplash(); showPwd(); }, 3000);
});
// ══ SKELETON LOADING ══
function showSkeleton() {
  document.getElementById('sidebar-list').innerHTML = Array(4).fill('<div class="skeleton skeleton-card"></div>').join('');
  document.getElementById('hero-stats').innerHTML = '<div class="skeleton skeleton-text" style="width:150px;height:40px;"></div>';
}
// Appelé au démarrage
showSkeleton();

// ══ GESTES TACTILES (SWIPE) ══
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

document.addEventListener('touchstart', e => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, {passive: true});

document.addEventListener('touchend', e => {
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  handleSwipe();
}, {passive: true});

function handleSwipe() {
  if (!isMobile()) return;
  const dx = touchEndX - touchStartX;
  const dy = touchEndY - touchStartY;
  
  // Swipe Gauche/Droite pour naviguer entre les vues
  // Seulement si le sheet n'est pas ouvert
  const sheet = document.getElementById('col-detail');
  if (!sheet || !sheet.classList.contains('sheet-open')) {
    if (dx > 80 && Math.abs(dx) > Math.abs(dy)) {
      // Swipe Right (précédent)
      if(currentView === 'logistique') switchView('pilotage');
      else if(currentView === 'pilotage') switchView('operationnel');
    } else if (dx < -80 && Math.abs(dx) > Math.abs(dy)) {
      // Swipe Left (suivant)
      if(currentView === 'operationnel') switchView('pilotage');
      else if(currentView === 'pilotage') switchView('logistique');
    }
  }
}

// ══ INITIALISATION VIEWER.JS POUR LES PLANS ══
document.addEventListener('DOMContentLoaded', () => {
  const gallery = document.getElementById('plan-gallery');
  if (gallery) {
    new Viewer(gallery, {
      toolbar: { zoomIn: 1, zoomOut: 1, oneToOne: 1, reset: 1, prev: 0, play: 0, next: 0, rotateLeft: 0, rotateRight: 0, flipHorizontal: 0, flipVertical: 0 },
      navbar: false,
      title: false
    });
  }
});
