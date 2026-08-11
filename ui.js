/* ===================================================
   DRAWER
=================================================== */
function isMobile(){ return window.innerWidth < 769; }
function isDrawerOpen(){ return document.getElementById('drawer').classList.contains('open'); }
function openDrawer(){
  document.getElementById('drawer').classList.add('open');
  if(!(drawerPinned && !isMobile())) document.getElementById('drawer-backdrop').classList.add('on');
  document.getElementById('btn-drawer').classList.add('open');
  setTimeout(()=>{ map.invalidateSize(); scheduleZoneRefresh(); }, 300);
}
function closeDrawer(force){
  if(drawerPinned && !isMobile() && force !== true) return;
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawer-backdrop').classList.remove('on');
  document.getElementById('btn-drawer').classList.remove('open');
  // When a pinned drawer is force-closed (✕ button), un-pin so map can fill the space
  if(drawerPinned && !isMobile() && force === true){
    drawerPinned = false;
    localStorage.setItem('rtp_pin','0');
    document.body.classList.remove('drawer-pinned');
    const pinBtn=qs('#btn-pin'); if(pinBtn) pinBtn.classList.remove('pin-active');
    const stogPin=qs('#stog-pin'); if(stogPin) stogPin.classList.remove('on');
  }
  // Wait for CSS slide-out transition then tell Leaflet to reclaim the space
  setTimeout(()=>{ map.invalidateSize(); scheduleZoneRefresh(); }, 300);
}
function toggleDrawer(){ isDrawerOpen() ? closeDrawer(true) : openDrawer(); }
function closeDrawerMobile(){ if(isMobile() && !drawerPinned) closeDrawer(true); }
function hideForMap(){ S.drawerWasOpen = isDrawerOpen(); if(isMobile() && !drawerPinned && S.drawerWasOpen) closeDrawer(true); }
function restoreDrawer(){ if(isMobile() && !drawerPinned && S.drawerWasOpen){ openDrawer(); S.drawerWasOpen=false; } }

/* ===================================================
   MAP
=================================================== */
const map = L.map('map',{zoomControl:true}).setView([46.8,2.3],6);
const TL = {
  st:  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}),
  sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'© Esri',maxZoom:19})
};
TL.st.addTo(map);

// Day zone SVG is managed by zones.js via getZoneSvg() — no global reference needed here

function mkPin(c,e,sz=27){
  return L.divIcon({className:'',
    html:'<div style="background:'+c+';width:'+sz+'px;height:'+sz+'px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid rgba(255,255,255,.95);box-shadow:0 3px 10px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;"><div style="transform:rotate(45deg);font-size:'+Math.round(sz*.43)+'px;">'+e+'</div></div>',
    iconSize:[sz,sz],iconAnchor:[sz/2,sz],popupAnchor:[0,-(sz+4)]});
}
function mkGps(){
  return L.divIcon({className:'',
    html:'<div style="position:relative;width:22px;height:22px;"><div style="position:absolute;inset:0;border-radius:50%;background:rgba(21,128,61,.18);animation:gpsr 1.5s infinite;"></div><div style="position:absolute;top:5px;left:5px;width:12px;height:12px;background:#15803d;border-radius:50%;border:2px solid #fff;box-shadow:0 0 7px #15803d;"></div></div>',
    iconSize:[22,22],iconAnchor:[11,11]});
}

map.on('click', e => {
  if(S.placing){ S.placing=false; map.getContainer().style.cursor=''; qs('#fab').classList.remove('cancel'); qs('#fab').title='Add POI'; openModal(e.latlng,''); }
});
// zone refresh listeners are set up inside the DAY ZONE OVERLAY section below

function toggleSat(){
  S.sat = !S.sat;
  if(S.sat){ map.removeLayer(TL.st); TL.sat.addTo(map); }
  else{ map.removeLayer(TL.sat); TL.st.addTo(map); }
  const btn = qs('#stog-sat'); if(btn) btn.classList.toggle('on', S.sat);
  const old = qs('#t-sat'); if(old) old.classList.toggle('on', S.sat);
}

/* ===================================================
   THEME
=================================================== */
function setTheme(dark){
  CFG.darkMode = dark;
  saveCFG();
  document.documentElement.setAttribute('data-theme', dark ? 'dark':'light');
  const ico = dark ? '🌙':'☀️';
  ['t-theme','t-theme2'].forEach(id=>{ const e=qs('#'+id); if(e) e.textContent=ico; });
  const darkBtn = qs('#stog-dark'); if(darkBtn) darkBtn.classList.toggle('on', dark);
}
setTheme(CFG.darkMode);

/* ===================================================
   UTILS
=================================================== */
function qs(s,c=document){ return c.querySelector(s); }
function qsa(s,c=document){ return [...c.querySelectorAll(s)]; }
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/'/g,'&#39;').replace(/"/g,'&quot;'); }
function fmtD(m){ if(m<60) return m+'min'; const h=Math.floor(m/60); return h+'h'+(m%60?m%60+'min':''); }
function toast(msg,type=''){
  const el=qs('#toast'), t=document.createElement('div');
  t.className='tmsg '+(type||'');
  t.innerHTML=(type==='ok'?'✅ ':type==='err'?'❌ ':'ℹ️ ')+msg;
  el.appendChild(t);
  setTimeout(()=>{ t.style.transition='.26s'; t.style.opacity='0'; t.style.transform='translateY(6px)'; setTimeout(()=>t.remove(),280); },3200);
}

/* ===================================================
   FINANCE
=================================================== */
function getFP(){ return { c: parseFloat(qs('#f-consump').value)||7, p: parseFloat(qs('#f-price').value)||1.70 }; }
function routeFuel(r){ if(r.mode!=='car') return 0; const fp=getFP(); return +(r.dist*(fp.c/100)*fp.p).toFixed(2); }
function routeCost(r){ return +(routeFuel(r)+(r.fixedCost||0)).toFixed(2); }

// Effective cost of a POI — TOTAL across all days (for grand total / POI card)
function poiEffectiveCost(p){
  const base = p.cost || 0;
  if(p.costType === 'perday'){
    const days = (p.dayIds||[]).length || 1;
    return +(base * days).toFixed(2);
  }
  return base;
}
// Cost of a POI attributed to ONE specific day (for per-day cost rows)
function poiCostForDay(p){
  const base = p.cost || 0;
  // Whether total or perday, we show `base` per day (the user entered a per-day amount)
  return base;
}

function totalFuelCost(){ let t=0; S.routes.forEach(r=>t+=routeFuel(r)); return +t.toFixed(2); }
function totalHotelCost(){ let t=0; S.pois.filter(p=>p.cat==='hotel'||p.cat==='camping').forEach(p=>t+=poiEffectiveCost(p)); return +t.toFixed(2); }
function totalActivityCost(){ let t=0; S.pois.filter(p=>['attraction','hike','view','general','info'].includes(p.cat)).forEach(p=>t+=poiEffectiveCost(p)); return +t.toFixed(2); }
function totalTransportFixed(){ let t=0; S.pois.filter(p=>p.cat==='gas'||p.cat==='parking').forEach(p=>t+=poiEffectiveCost(p)); S.routes.forEach(r=>t+=(r.fixedCost||0)); return +t.toFixed(2); }
function totalRestaurantPOI(){ let t=0; S.pois.filter(p=>p.cat==='restaurant').forEach(p=>t+=poiEffectiveCost(p)); return +t.toFixed(2); }
function tripCost(){ return +(totalFuelCost()+totalHotelCost()+totalActivityCost()+totalTransportFixed()+totalDailyExpenses()+totalRestaurantPOI()).toFixed(2); }

function dayCost(d){
  let t=0;
  d.items.forEach(it=>{
    if(it.type==='route'){ const r=S.routes.find(x=>x.id===it.id); if(r) t+=routeCost(r); }
    if(it.type==='poi'){ const p=S.pois.find(x=>x.id===it.id); if(p) t+=poiCostForDay(p); }
  });
  t += dayExpensesTotal(d.id);
  return +t.toFixed(2);
}

/* ===================================================
   DAILY EXPENSES   (generalised per-category, per-day budget)
=================================================== */
function addDailyExpense(){
  const name=prompt('Expense category name (e.g. 🚌 Transport):','');
  if(!name||!name.trim()) return;
  S.dailyExpenses.push({id:newExpId(), name:name.trim(), defaultPerDay:0});
  renderDailyExpensesPanel(); updStats();
}
function removeDailyExpense(expId){
  S.dailyExpenses=S.dailyExpenses.filter(e=>e.id!==expId);
  // Clean up overrides
  Object.keys(S.dailyExpenseOverrides).forEach(did=>{
    delete (S.dailyExpenseOverrides[did]||{})[expId];
  });
  renderDailyExpensesPanel(); renderDays(); updStats();
}
function setExpenseDefault(expId, val){
  const exp=S.dailyExpenses.find(e=>e.id===expId);
  if(exp) exp.defaultPerDay=+val||0;
  // Update placeholders on day inputs live
  qsa('.day-exp-input[data-exp="'+expId+'"]').forEach(inp=>{
    if(!inp.dataset.manual){ inp.placeholder='$'+(+val||0)+' (default)'; }
  });
  updStats();
}
function setDayExpenseOverride(did, expId, val, manual){
  if(!S.dailyExpenseOverrides[did]) S.dailyExpenseOverrides[did]={};
  if(manual) S.dailyExpenseOverrides[did][expId]=+val||0;
  else delete S.dailyExpenseOverrides[did][expId];
  updStats();
}
function renderDailyExpensesPanel(){
  const el=qs('#daily-expenses-list'); if(!el) return;
  if(!S.dailyExpenses.length){
    el.innerHTML='<div style="font-size:.64rem;color:var(--muted);">No categories yet. Add one above.</div>';
    qs('#daily-expenses-total').textContent='Total: $0.00';
    return;
  }
  el.innerHTML=S.dailyExpenses.map(exp=>`
    <div class="daily-exp-row">
      <input class="inp daily-exp-name" value="${esc(exp.name)}" style="flex:1;min-width:0;"
        onchange="S.dailyExpenses.find(e=>e.id==='${exp.id}').name=this.value;renderDays();">
      <span style="font-size:.62rem;color:var(--muted);white-space:nowrap;">$/day</span>
      <input type="number" class="inp" min="0" step="1" value="${exp.defaultPerDay||''}" placeholder="0"
        style="width:70px;flex-shrink:0;"
        oninput="setExpenseDefault('${exp.id}',+this.value)">
      <button class="btn br bic bsm" onclick="removeDailyExpense('${exp.id}')" title="Remove">✕</button>
    </div>`).join('');
  const total=totalDailyExpenses();
  const totalEl=qs('#daily-expenses-total');
  if(totalEl) totalEl.innerHTML='Total: <b>$'+total.toFixed(2)+'</b> <span style="font-size:.6rem;color:var(--muted);">('+S.days.length+' day(s))</span>';
}

// Keep backward-compat aliases used elsewhere
function renderEatingBudgetRows(){ renderDailyExpensesPanel(); }
function eatingForDay(did){ return dayExpensesTotal(did); }
function totalEatingBudget(){ return totalDailyExpenses(); }
function applyEatingDefault(){}   // no-op — kept so old HTML oninput doesn't break
function setDayEating(){}         // no-op
