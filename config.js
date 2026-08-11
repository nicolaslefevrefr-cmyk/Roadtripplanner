/* =========================================================
   RoadTrip Planner — app.js  v8.3.0
   ========================================================= */
const APP_VERSION = '8.3.0';
const GOOGLE_CLIENT_ID = '940235006674-1mfg6a2qn7hkqu78irn2af34a507i76u.apps.googleusercontent.com';
const DRIVE_FOLDER = 'RoadTripPlanner';

const DAY_ZONE_COLORS = [
  '#e74c3c','#3498db','#2ecc71','#9b59b6','#f39c12',
  '#1abc9c','#e67e22','#e91e8c','#00bcd4','#8bc34a'
];

/* ===================================================
   SETTINGS / CONFIG  (persisted to localStorage)
=================================================== */
const CFG_DEFAULTS = {
  showDayZones:      false,
  showZoneTitles:    true,
  showPoiLabels:     false,
  showHourDots:      true,
  showDayOrderLines: false,
  fontScale:         125,
  darkMode:          false,
};
let CFG = Object.assign({}, CFG_DEFAULTS, JSON.parse(localStorage.getItem('rtp_cfg')||'{}'));

function saveCFG(){ localStorage.setItem('rtp_cfg', JSON.stringify(CFG)); }

function setSetting(key, val){
  CFG[key] = val;
  saveCFG();
  applySettings();
}

function applySettings(){
  // Day zones
  const dzBtn = qs('#stog-day-zones');
  if(dzBtn) dzBtn.classList.toggle('on', CFG.showDayZones);
  // Zone-titles sub-toggle enabled only when zones are on
  const ztRow = qs('#stog-zone-titles-row');
  if(ztRow){ ztRow.style.opacity = CFG.showDayZones ? '1':'0.4'; ztRow.style.pointerEvents = CFG.showDayZones ? 'auto':'none'; }
  const ztBtn = qs('#stog-zone-titles');
  if(ztBtn) ztBtn.classList.toggle('on', CFG.showZoneTitles);
  // POI labels
  const plBtn = qs('#stog-poi-labels');
  if(plBtn) plBtn.classList.toggle('on', CFG.showPoiLabels);
  renderPoiLabels();
  // Hour dots
  const hdBtn = qs('#stog-hour-dots');
  if(hdBtn) hdBtn.classList.toggle('on', CFG.showHourDots);
  if(CFG.showHourDots) refreshAllHourDots(); else clearAllHourDots();
  // Day order lines
  const dolBtn = qs('#stog-day-order-lines');
  if(dolBtn) dolBtn.classList.toggle('on', CFG.showDayOrderLines);
  renderDayOrderLines();
  // Font scale
  const slider = qs('#font-scale-slider');
  if(slider) slider.value = CFG.fontScale;
  const scaleVal = qs('#font-scale-val');
  if(scaleVal) scaleVal.textContent = CFG.fontScale + '%';
  document.documentElement.style.setProperty('--fs-scale', (CFG.fontScale/100).toFixed(2));
  // Dark mode
  const darkBtn = qs('#stog-dark');
  if(darkBtn) darkBtn.classList.toggle('on', CFG.darkMode);
  // Pin
  const pinBtn = qs('#stog-pin');
  if(pinBtn) pinBtn.classList.toggle('on', drawerPinned);
  // Satellite
  const satBtn = qs('#stog-sat');
  if(satBtn) satBtn.classList.toggle('on', S.sat);
  // Refresh zones
  scheduleZoneRefresh();
}

function setFontScale(v){
  CFG.fontScale = v;
  saveCFG();
  document.documentElement.style.setProperty('--fs-scale', (v/100).toFixed(2));
  const scaleVal = qs('#font-scale-val');
  if(scaleVal) scaleVal.textContent = v + '%';
}

/* ===================================================
   STATE
=================================================== */
let _id = Date.now();
function nid(){ return ++_id; }

const S = {
  pois:[], routes:[], days:[],
  rtCol:'#1d56d4', rtCol2:'#1d56d4',
  col:'#c94f14', editing:null, placing:false, pendLL:null,
  drawerWasOpen:false,
  gps:false, watchId:null, gposLL:null, gpsMk:null,
  sat:false, fcat:'all', editRid:null,
  drawLines:false, poiLines:[],
  gd:{token:null,user:null,folderId:null},
  costType: 'total',
  dayVisibility: {},  // dayId -> bool (false=hidden)
  dayOrderLines: [],  // Leaflet polyline objects for POI-order lines
  poiVisibility: {},  // poiId -> false=hidden, true=force-show, undefined=default
  allPOIsHidden: false,
  // Daily expense categories — each has {id, name, defaultPerDay}
  // Per-day overrides stored in dailyExpenseOverrides[dayId][expId]
  dailyExpenses: [],
  dailyExpenseOverrides: {},  // { dayId: { expId: number } }  — only explicitly set values
};

const CATS={general:'📍',hotel:'🏨',camping:'⛺',restaurant:'🍽️',attraction:'🎯',hike:'🥾',view:'🌄',gas:'⛽',parking:'🅿️',info:'ℹ️'};
const RCOL={car:'#1d56d4',foot:'#15803d',bike:'#d4920a',manual:'#9333ea'};
const MI={car:'🚗',foot:'🚶',bike:'🚲',manual:'✏️'};
const PC={};

// Default expense categories — user can add/remove/rename
const DEFAULT_DAILY_EXPENSES = [
  {id:'exp_eating', name:'🍽️ Eating',   defaultPerDay:0},
  {id:'exp_gas',    name:'⛽ Gas',       defaultPerDay:0},
  {id:'exp_misc',   name:'💳 Misc',      defaultPerDay:0},
];
let _expIdCounter = 1;
function newExpId(){ return 'exp_'+Date.now()+'_'+(++_expIdCounter); }

/** Get the effective value for an expense on a given day (override > default) */
function getDayExpense(did, expId){
  const ovr = S.dailyExpenseOverrides[did];
  if(ovr && ovr[expId] !== undefined) return +ovr[expId];
  const exp = S.dailyExpenses.find(e=>e.id===expId);
  return exp ? +(exp.defaultPerDay||0) : 0;
}

/** Total of all daily expenses across all days */
function totalDailyExpenses(){
  let t=0;
  S.days.forEach(d=>{
    S.dailyExpenses.forEach(exp=>{ t+=getDayExpense(d.id, exp.id); });
  });
  return +t.toFixed(2);
}

/** Total daily expenses for one day */
function dayExpensesTotal(did){
  return +S.dailyExpenses.reduce((s,exp)=>s+getDayExpense(did,exp.id),0).toFixed(2);
}

