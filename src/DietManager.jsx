import { useState, useEffect, useRef, useCallback } from "react";
import DEFAULT_PRICES from "../data/prezzario_conad.json";

// Tauri filesystem helpers — no-op gracefully in browser mode
const isTauri = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

async function tauriReadMd(filename) {
  if (!isTauri()) return null;
  try {
    const { readTextFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    const { appLocalDataDir } = await import("@tauri-apps/api/path");
    const dir = await appLocalDataDir();
    const text = await readTextFile(dir + filename);
    return text;
  } catch { return null; }
}

async function tauriWriteMd(filename, content) {
  if (!isTauri()) return false;
  try {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const { appLocalDataDir } = await import("@tauri-apps/api/path");
    const dir = await appLocalDataDir();
    await writeTextFile(dir + filename, content);
    return true;
  } catch { return false; }
}

const MODEL = "claude-sonnet-4-20250514";
const MI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const DI = ["Dom","Lun","Mar","Mer","Gio","Ven","Sab"];

const ACTS = {
  tabata:      { c:"#a78bfa", bg:"rgba(167,139,250,.13)", label:"TABATA + Cyclette" },
  endurance:   { c:"#38bdf8", bg:"rgba(56,189,248,.12)",  label:"Endurance" },
  rest:        { c:"#94a3b8", bg:"rgba(148,163,184,.11)", label:"Riposo" },
  repetitions: { c:"#fb923c", bg:"rgba(251,146,60,.13)",  label:"Ripetute" },
  bike:        { c:"#4ade80", bg:"rgba(74,222,128,.12)",  label:"Lungo BDC" },
  run:         { c:"#f87171", bg:"rgba(248,113,113,.12)", label:"Lungo RUN" },
  weights:     { c:"#fbbf24", bg:"rgba(251,191,36,.12)",  label:"Palestra/Pesi" },
  other:       { c:"#6b7280", bg:"rgba(107,114,128,.11)", label:"Altro" },
};
const getAct = t => ACTS[t] || ACTS.other;
const DEFAULT_DOW_ACT = {0:"run",1:"tabata",2:"endurance",3:"rest",4:"repetitions",5:"tabata",6:"bike"};
const DOW_LABELS = [[1,"Lunedì"],[2,"Martedì"],[3,"Mercoledì"],[4,"Giovedì"],[5,"Venerdì"],[6,"Sabato"],[0,"Domenica"]];

const dk = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const pd = s => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
const fmtDate = (d,opts) => d.toLocaleDateString("it-IT", opts||{day:"numeric",month:"long",year:"numeric"});

// Storage helpers with fallback to memory
const store = {
  data: {},
  async get(k){ try{ const r=await window.storage.get(k); return r?JSON.parse(r.value):store.data[k]||null; }catch(e){ return store.data[k]||null; } },
  async set(k,v){ store.data[k]=v; try{ await window.storage.set(k,JSON.stringify(v)); }catch(e){} },
  async del(k){ delete store.data[k]; try{ await window.storage.delete(k); }catch(e){} },
};

// Normalizza stringa per il matching (minuscolo, senza accenti)
const norm = s => (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();

// Trova il prezzo corrispondente a un nome alimento del piano
function findPriceFor(prices, foodName){
  if(!prices?.prodotti?.length) return null;
  const n = norm(foodName);
  if(!n) return null;
  let p = prices.prodotti.find(x=>x.nomePiano && norm(x.nomePiano)===n);
  if(p) return p;
  p = prices.prodotti.find(x=>x.nomePiano && (n.includes(norm(x.nomePiano))||norm(x.nomePiano).includes(n)));
  return p||null;
}

const DIET_AI_PROMPT = `Analizza questo piano alimentare ed estrai i dati nel formato JSON seguente. Usa null per i valori assenti. Non inventare numeri. Restituisci SOLO JSON valido, nessun testo aggiuntivo.

{"patient":{"name":null,"weight":null,"targetWeight":null,"height":null,"bmi":null,"bmr":null,"fat":null,"ffm":null},"period":{"startDate":null,"checkupDate":null,"checkupTime":null},"avgKcal":null,"macros":{"protein":null,"carbs":null,"fats":null},"days":[{"n":1,"activity":"descrizione attività","activityType":"rest","kcal":null,"macros":{"prot":null,"carb":null,"fat":null},"meals":[{"name":"Colazione","icon":"☀️","foods":[{"name":"alimento","qty":"150g","kcal":null,"isSupplement":false}]}],"condiments":{},"supplements":[]}]}

Regole:
- Estrai TUTTI i giorni presenti nel documento
- activityType: rest=riposo/giorno libero, tabata=HIIT/tabata/cyclette alta intensità, endurance=corsa lenta o lunga distanza, repetitions=ripetute velocità, bike=ciclismo/bici da corsa, run=corsa lunga, weights=palestra/pesi/resistance training, other=qualsiasi altro sport o attività non classificabile
- icon pasto: ☀️=colazione, 🥗=pranzo, 🍽️=cena, 🍎=spuntino mattutino, 🌙=spuntino serale, ⚡=pre o post allenamento
- isSupplement=true per: proteine whey, creatina, gel energetici, barrette sportive, BCAA, aminoacidi, multivitaminici, integratori sportivi
- condiments: oggetto nome→grammi SOLO per condimenti con dose giornaliera esplicita (es. {"Olio EVO":10,"Parmigiano":5}); {} se assenti
- supplements: array di nomi integratori del giorno (non alimenti normali)
- Tutti i campi numerici devono essere numeri o null, mai stringhe vuote`;

const SUPPLEMENT_URLS = {
  "proteine del siero":    "https://www.yamamotonutrition.com/it_it/yamamoto-nutrition-iso-fuji-volactiver-700-grammi-p00032643",
  "prostar whey":          "https://www.yamamotonutrition.com/it_it/yamamoto-nutrition-iso-fuji-volactiver-700-grammi-p00032643",
  "yamamoto":              "https://www.yamamotonutrition.com/it_it/yamamoto-nutrition-iso-fuji-volactiver-700-grammi-p00032643",
  "carbogel":              "https://www.scienceinsport.com/it/shop-sis/go-range/gel-beta-fuel-sis",
  "gel beta fuel":         "https://www.scienceinsport.com/it/shop-sis/go-range/gel-beta-fuel-sis",
  "barretta energetica":   "https://www.scienceinsport.com/it/compra-su-sis/go-range/go-energy-bars/beta-fuel-energy-bar-sis",
  "beta fuel energy bar":  "https://www.scienceinsport.com/it/compra-su-sis/go-range/go-energy-bars/beta-fuel-energy-bar-sis",
  "isocarb":               "https://www.redcare.it/fitness/IT981043351/enervit-isocarb-c2-1pro.htm",
  "enervit isocarb":       "https://www.redcare.it/fitness/IT981043351/enervit-isocarb-c2-1pro.htm",
};
const getSupplementUrl = name => {
  const n = norm(name);
  for(const [key, url] of Object.entries(SUPPLEMENT_URLS)) {
    if(n.includes(norm(key))) return url;
  }
  return null;
};

async function callAI(content) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages: [{ role: "user", content }] })
  });
  if (!resp.ok) { const t = await resp.text(); throw new Error(`API ${resp.status}: ${t.substring(0,120)}`); }
  const data = await resp.json();
  const txt = data.content?.find(c => c.type === "text")?.text || "";
  return JSON.parse(txt.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim());
}

function saveDiet(parsed, setDiet, setPlanS, setPlanE) {
  const md = dietToMarkdown(parsed);
  const filename = `piano_${(parsed.patient?.name||"dieta").replace(/\s+/g,"_").toLowerCase()}.md`;
  setDiet(parsed);
  store.set("dm-diet", parsed);
  store.set("dm-diet-md", md);
  store.set("dm-diet-md-filename", filename);
  tauriWriteMd(filename, md);
  if(parsed.period?.startDate) setPlanS(parsed.period.startDate);
  if(parsed.period?.checkupDate) setPlanE(parsed.period.checkupDate);
  return { md, filename };
}

function dietToMarkdown(d) {
  const p = d.patient||{}, per = d.period||{};
  const AL = {tabata:"TABATA + Cyclette",endurance:"Endurance",rest:"Riposo",repetitions:"Ripetute",bike:"Lungo BDC",run:"Lungo RUN"};
  let md = `# Piano Alimentare — ${p.name||"Paziente"}\n\n`;
  md += `**Peso**: ${p.weight}kg → **Obiettivo**: ${p.targetWeight}kg | **BMI**: ${p.bmi} | **BMR**: ${p.bmr} kcal\n`;
  md += `**Massa grassa**: ${p.fat}% | **FFM**: ${p.ffm}kg\n\n`;
  md += `**Periodo**: ${per.startDate||"?"} → ${per.checkupDate||"?"} | **Visita**: ${per.checkupDate||"?"} ore ${per.checkupTime||"?"}\n`;
  md += `**Kcal medie**: ${d.avgKcal} | P: ${d.macros?.protein}g | C: ${d.macros?.carbs}g | G: ${d.macros?.fats}g\n\n---\n\n`;
  (d.days||[]).forEach(day => {
    md += `## Giorno ${day.n} — ${AL[day.activityType]||day.activity||""} | ${day.kcal} kcal\n`;
    md += `P ${day.macros?.prot}g · C ${day.macros?.carb}g · G ${day.macros?.fat}g`;
    if(day.condiments) Object.entries(day.condiments).filter(([,g])=>g>0).forEach(([name,g])=>{ md += ` | ${name} ${g}g`; });
    md += `\n\n`;
    (day.meals||[]).forEach(meal => {
      md += `### ${meal.icon||""} ${meal.name}\n| Alimento | Qtà | Kcal |\n|---|---|---|\n`;
      (meal.foods||[]).forEach(f => { md += `| ${f.isSupplement?"⚡ ":""}${f.name} | ${f.qty} | ${f.kcal} |\n`; });
      md += `\n`;
    });
    if(day.supplements?.length) md += `**Integratori**: ${day.supplements.join(", ")}\n\n`;
  });
  md += `---\n\n<!-- diet-json\n${JSON.stringify(d)}\n-->\n`;
  return md;
}

function markdownToDiet(text) {
  const m = text.match(/<!--\s*diet-json\s*\n([\s\S]+?)\n\s*-->/);
  if(!m) throw new Error("Nessun blocco diet-json trovato nel file .md");
  return JSON.parse(m[1]);
}

const CAT_PRICE_LABELS = {
  frutta_verdura:"🥦 Frutta e Verdura", carne_pesce:"🥩 Carne e Pesce",
  latticini:"🥛 Latticini/Uova/Formaggi", cereali_pane:"🌾 Cereali/Pane/Riso",
  legumi_conserve:"🫘 Legumi e Conserve", condimenti:"🫙 Condimenti",
  frutta_secca:"🥜 Frutta Secca", bevande:"🥤 Bevande",
  non_alimentare:"🧹 Non Alimentare", altro:"🍫 Altro"
};
const UNIT_PRICE_LABELS = {pezzo:"al pz", kg:"al kg", litro:"al L", acquisto:"acquisto"};

const S = {
  app:{ minHeight:"100vh",background:"#0d1117",color:"#c9d1d9",fontFamily:"system-ui,sans-serif",fontSize:14 },
  hdr:{ background:"#161b22",borderBottom:"1px solid #30363d",padding:"8px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",position:"sticky",top:0,zIndex:100 },
  logo:{ fontWeight:700,fontSize:15,color:"#58a6ff",flex:1,display:"flex",alignItems:"center",gap:6 },
  body:{ maxWidth:940,margin:"0 auto",padding:"14px 12px 56px" },
  card:{ background:"#161b22",border:"1px solid #30363d",borderRadius:8,marginBottom:10,overflow:"hidden" },
  cardP:{ padding:"12px 14px" },
  cardH:{ background:"#21262d",padding:"7px 14px",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:"#6e7681",display:"flex",justifyContent:"space-between",alignItems:"center" },
  cardT:{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:"#6e7681",marginBottom:8 },
  sb:{ background:"#21262d",border:"1px solid #30363d",borderRadius:6,padding:"10px 8px",textAlign:"center",flex:1,minWidth:70 },
  sbN:{ fontSize:16,fontWeight:700,color:"#58a6ff",fontFamily:"Georgia,serif" },
  sbL:{ fontSize:9,color:"#6e7681",textTransform:"uppercase",letterSpacing:"0.07em",marginTop:2 },
  btn:{ background:"#238636",border:"1px solid #2ea043",borderRadius:6,padding:"6px 13px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer" },
  btnB:{ background:"#1f6feb",border:"1px solid #388bfd",borderRadius:6,padding:"6px 13px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer" },
  btnG:{ background:"transparent",borderWidth:"1px",borderStyle:"solid",borderColor:"#30363d",borderRadius:6,padding:"5px 9px",fontSize:12,fontWeight:600,color:"#8b949e",cursor:"pointer" },
  inp:{ background:"#0d1117",border:"1px solid #30363d",borderRadius:6,padding:"6px 9px",fontSize:12,color:"#c9d1d9",outline:"none" },
  lbl:{ fontSize:10,color:"#6e7681",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:3 },
  row:{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" },
  muted:{ color:"#6e7681" },
  cg:{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2 },
  cdow:{ textAlign:"center",fontSize:10,fontWeight:700,color:"#6e7681",padding:"3px 0" },
  dc:{ aspectRatio:"1",borderRadius:4,borderWidth:"1px",borderStyle:"solid",borderColor:"#21262d",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,padding:2,transition:"all .12s" },
  dcE:{ border:"none",background:"transparent",cursor:"default",aspectRatio:"1" },
  mc:{ background:"#0d1117",border:"1px solid #21262d",borderRadius:6,marginBottom:6,overflow:"hidden" },
  mh:{ padding:"5px 10px",background:"#161b22",display:"flex",justifyContent:"space-between",alignItems:"center" },
  fi:{ display:"grid",gridTemplateColumns:"1fr auto auto",gap:8,padding:"5px 10px",borderBottom:"1px solid #161b22",fontSize:12,alignItems:"center" },
  si:{ display:"grid",gridTemplateColumns:"20px 1fr auto auto",gap:6,padding:"5px 10px",borderBottom:"1px solid #161b22",cursor:"pointer",alignItems:"center",fontSize:12 },
  cb:{ width:15,height:15,borderRadius:3,borderWidth:"1.5px",borderStyle:"solid",borderColor:"#30363d",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,flexShrink:0 },
  dz:{ borderWidth:"2px",borderStyle:"dashed",borderColor:"#30363d",borderRadius:10,padding:"32px 20px",textAlign:"center",cursor:"pointer",transition:"all .2s" },
};

export default function App() {
  const [diet, setDiet]   = useState(null);
  const [cal, setCal]     = useState({});
  const [wts, setWts]     = useState([]);
  const [chk, setChk]     = useState({});
  const [view, setView]   = useState("up");
  const [loading, setLoading] = useState(false);
  const [lmsg, setLmsg]   = useState("");
  const [selDt, setSelDt] = useState(new Date());
  const [nav, setNav]     = useState({y:new Date().getFullYear(),m:new Date().getMonth()});
  const [shopM, setShopM] = useState("day");
  const [shopDt, setShopDt] = useState(dk(new Date()));
  const [planS, setPlanS] = useState("");
  const [planE, setPlanE] = useState("");
  const [wtI, setWtI]     = useState("");
  const [wtN, setWtN]     = useState("");
  const [showSup, setShowSup] = useState(true);
  const [manDay, setManDay]   = useState(null);
  const [dowAct, setDowAct]   = useState(DEFAULT_DOW_ACT);
  const [showCalCfg, setShowCalCfg] = useState(false);
  const [drag, setDrag]   = useState(false);
  const [notes, setNotes] = useState({});
  const [excl, setExcl]   = useState({});
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [priceEditId, setPriceEditId] = useState(null);
  const [priceFilter, setPriceFilter] = useState("all");
  const [priceCatFilter, setPriceCatFilter] = useState("all");
  const [priceSearch, setPriceSearch] = useState("");
  const [priceModal, setPriceModal] = useState(false);
  const [pendingPriceDesc, setPendingPriceDesc] = useState("");
  const priceFileRef = useRef();
  const mdFileRef = useRef();
  const openPriceQuickAdd = (foodName) => { setPendingPriceDesc(foodName); setView("prices"); setPriceModal(true); };
  const fileRef = useRef();
  const toggleExcl = k => setExcl(p=>{ const n={...p}; n[k]?delete n[k]:n[k]=true; return n; });
  const exclInRange = (from,to) => { const cur=new Date(from),res=[]; while(cur<=to){const d=dk(cur);if(excl[d])res.push(d);cur.setDate(cur.getDate()+1);} return res; };

  // Load persisted data — Tauri: .md da disco; browser: JSON da localStorage
  useEffect(() => {
    (async () => {
      let dietLoaded = false;
      // 1. Prova a caricare dal .md su disco (Tauri)
      const mdFilename = await store.get("dm-diet-md-filename");
      if (mdFilename) {
        const mdText = await tauriReadMd(mdFilename);
        if (mdText) {
          try {
            const parsed = markdownToDiet(mdText);
            saveDiet(parsed, setDiet, setPlanS, setPlanE);
            dietLoaded = true;
          } catch { /* fallback sotto */ }
        }
      }
      // 2. Prova a caricare da /piano.md nella cartella public/ (browser dev)
      if (!dietLoaded) {
        try {
          const r = await fetch("/piano.md", { cache: "no-store" });
          if (r.ok) {
            const text = await r.text();
            try {
              // Caso A: MD generato dall'app → ha blocco <!-- diet-json -->
              const parsed = markdownToDiet(text);
              saveDiet(parsed, setDiet, setPlanS, setPlanE);
              dietLoaded = true;
            } catch {
              // Caso B: MD scritto a mano → usa AI (richiede crediti API)
              setLoading(true);
              setLmsg("Analisi piano.md con AI — operazione una tantum...");
              try {
                const parsed = await callAI([
                  {type:"text", text: DIET_AI_PROMPT + "\n\nContenuto:\n\n" + text}
                ]);
                saveDiet(parsed, setDiet, setPlanS, setPlanE);
                dietLoaded = true;
              } catch(aiErr) {
                console.warn("AI parse fallita:", aiErr.message);
              } finally { setLoading(false); }
            }
          }
        } catch(fetchErr) { console.warn("Fetch piano.md fallita:", fetchErr.message); setLoading(false); }
      }
      // 3. Fallback JSON localStorage
      if (!dietLoaded) {
        const d = await store.get("dm-diet"); if(d) setDiet(d);
      }
      const c  = await store.get("dm-cal");   if(c)  setCal(c);
      const w  = await store.get("dm-wts");   if(w)  setWts(w);
      // Le date vengono già dal JSON del piano quando dietLoaded=true; leggo dm-plan solo come fallback
      if (!dietLoaded) {
        const p = await store.get("dm-plan"); if(p)  { setPlanS(p.s||""); setPlanE(p.e||""); }
      }
      const n  = await store.get("dm-notes"); if(n)  setNotes(n);
      const v  = await store.get("dm-view");  if(v)  setView(v);
      const pr = await store.get("dm-prices"); if(pr) setPrices(pr);
      const da = await store.get("dm-dow-act"); if(da) setDowAct(da);
    })();
  }, []);

  useEffect(() => { if(diet) store.set("dm-diet", diet); }, [diet]);
  useEffect(() => { store.set("dm-cal",  cal);   }, [cal]);
  useEffect(() => { store.set("dm-wts",  wts);   }, [wts]);
  useEffect(() => { if(planS||planE) store.set("dm-plan", {s:planS,e:planE}); }, [planS,planE]);
  useEffect(() => { store.set("dm-notes",notes); }, [notes]);
  useEffect(() => { if(view!=="up") store.set("dm-view",view); }, [view]);
  useEffect(() => { store.set("dm-prices", prices); }, [prices]);
  // dm-dow-act viene salvato esplicitamente al cambio (non via effect, evita race condition con startup useEffect)

  // Parse PDF with Claude AI
  const parsePDF = useCallback(async (file) => {
    setLoading(true); setLmsg("Lettura file PDF...");
    try {
      const b64 = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(file); });
      setLmsg("Analisi AI in corso — può richiedere 30-60 secondi...");
      const parsed = await callAI([
        {type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},
        {type:"text",text:DIET_AI_PROMPT}
      ]);
      saveDiet(parsed, setDiet, setPlanS, setPlanE);
      setLmsg("✓ Piano caricato!");
      setTimeout(()=>{ setLoading(false); setView("ov"); },500);
    } catch(err){
      console.error(err);
      setLmsg("❌ Errore: "+err.message);
      setTimeout(()=>setLoading(false),4000);
    }
  },[]);

  const importMD = useCallback(async (file) => {
    setLoading(true); setLmsg("Lettura file Markdown...");
    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = markdownToDiet(text); // ha blocco diet-json → parsing istantaneo
      } catch {
        setLmsg("Analisi AI del Markdown — operazione una tantum...");
        parsed = await callAI([{type:"text", text: DIET_AI_PROMPT + "\n\nContenuto:\n\n" + text}]);
      }
      saveDiet(parsed, setDiet, setPlanS, setPlanE);
      setLmsg("✓ Piano caricato!");
      setTimeout(()=>{ setLoading(false); setView("ov"); }, 500);
    } catch(err) {
      console.error(err);
      setLmsg("❌ "+err.message);
      setTimeout(()=>setLoading(false), 3000);
    }
  }, []);

  // Generate calendar automatically — random shuffle + configurable day constraints
  const genCal = useCallback(()=>{
    if(!diet||!planS) return;
    const start=pd(planS), end=planE?pd(planE):new Date(pd(planS).getTime()+77*864e5);
    const byType={};
    diet.days?.forEach(d=>{ const t=d.activityType||"rest"; if(!byType[t]) byType[t]=[]; byType[t].push(d.n); });
    // Fisher-Yates shuffle per ogni pool → assegnazione casuale
    const shuffle = arr => { const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
    const pools={}; Object.entries(byType).forEach(([t,days])=>{ pools[t]=shuffle(days); });
    const nc={}, ri={}, cur=new Date(start);
    while(cur<=end){
      const act=dowAct[cur.getDay()]||"rest";
      const pool=pools[act]||pools["rest"]||[];
      if(pool.length){ nc[dk(cur)]=pool[(ri[act]||0)%pool.length]; ri[act]=(ri[act]||0)+1; }
      cur.setDate(cur.getDate()+1);
    }
    setCal(nc);
  },[diet,planS,planE,dowAct]);

  const dayFor = useCallback(d => { const gn=cal[dk(d)]; if(!gn||!diet) return null; return diet.days?.find(x=>x.n===gn)||null; },[cal,diet]);

  const getShopItems = useCallback((from,to) => {
    const items={}; const cur=new Date(from);
    while(cur<=to){
      const dKey=dk(cur);
      if(!excl[dKey]){
        const day=dayFor(cur);
        if(day){
          day.meals?.forEach(m=>m.foods?.forEach(f=>{
            const k=f.name.toLowerCase().replace(/[^a-z0-9]/g,"_");
            if(!items[k]) items[k]={name:f.name,qty:f.qty,kcal:f.kcal||0,isSup:!!f.isSupplement,count:0};
            items[k].count++;
          }));
          if(day.condiments) Object.entries(day.condiments).forEach(([name,g])=>{
            if(!g||typeof g!=="number") return;
            const k="__cond_"+name.toLowerCase().replace(/[^a-z0-9]/g,"_");
            if(!items[k]) items[k]={name,qty:"",kcal:0,isSup:false,count:0,totalG:0};
            items[k].totalG=(items[k].totalG||0)+g;
            items[k].qty=items[k].totalG+"g tot."; items[k].count++;
          });
        }
      }
      cur.setDate(cur.getDate()+1);
    }
    // Aggancia prezzo trovato a ogni item
    Object.values(items).forEach(it=>{
      const match = findPriceFor(prices, it.name);
      if(match){
        it.priceInfo = match;
        it.priceUnit = match.unita;
        it.priceEach = match.prezzo;
        // Costo stimato: per articoli "a pezzo" moltiplica per occorrenze (1 confezione per uso)
        // Per peso variabile/kg mostriamo solo il prezzo di riferimento (non moltiplicato)
        it.estCost = match.unita==="pezzo" ? match.prezzo*it.count : match.prezzo;
        it.estCostApprox = match.unita!=="pezzo";
      } else {
        it.priceInfo = null; it.estCost = null;
      }
    });
    return Object.values(items);
  },[dayFor,excl,prices]);

  const getShopRange = useCallback(()=>{
    if(shopM==="day"){ const d=pd(shopDt); return[d,d]; }
    if(shopM==="week"){ const d=pd(shopDt),dow=d.getDay(),mon=new Date(d); mon.setDate(d.getDate()-(dow===0?6:dow-1)); const sun=new Date(mon); sun.setDate(mon.getDate()+6); return[mon,sun]; }
    const s=planS?pd(planS):new Date(), e=planE?pd(planE):new Date(s.getTime()+77*864e5); return[s,e];
  },[shopM,shopDt,planS,planE]);

  const reset = ()=>{ setDiet(null);setCal({});setWts([]);setNotes({});setView("up");setDowAct(DEFAULT_DOW_ACT); ["dm-diet","dm-cal","dm-wts","dm-plan","dm-notes","dm-view","dm-dow-act"].forEach(k=>store.del(k)); };

  // ── LOADING ──
  if(loading) return (
    <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontSize:40}}>🥗</div>
      <div style={{fontWeight:700,fontSize:16,color:"#58a6ff"}}>Elaborazione...</div>
      <div style={{color:"#6e7681",fontSize:13,maxWidth:320,textAlign:"center"}}>{lmsg}</div>
    </div>
  );

  // ── TAB NAV ──
  const TABS = diet ? [["ov","📊","Panoramica"],["cal","📅","Calendario"],["meals","🍽","Pasti"],["shop","🛒","Spesa"],["wt","⚖️","Peso"],["supp","⚡","Integratori"],["prices","💰","Prezzi"]] : [];

  // ── UPLOAD VIEW ──
  const UploadV = () => (
    <div style={{maxWidth:500,margin:"28px auto"}}>
      <div style={{...S.card,...S.cardP,textAlign:"center",paddingTop:24,paddingBottom:24}}>
        <div style={{fontSize:44,marginBottom:10}}>🥗</div>
        <div style={{fontWeight:700,fontSize:17,color:"#58a6ff",marginBottom:4}}>Diet Plan Manager</div>
        <div style={{color:"#6e7681",marginBottom:18,fontSize:12,lineHeight:1.6}}>Carica il PDF del piano alimentare.<br/>L'AI estrae automaticamente tutti i dati.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14,textAlign:"left"}}>
          <div><label style={S.lbl}>Inizio piano</label><input type="date" style={{...S.inp,width:"100%"}} value={planS} onChange={e=>setPlanS(e.target.value)}/></div>
          <div><label style={S.lbl}>Controllo / Fine</label><input type="date" style={{...S.inp,width:"100%"}} value={planE} onChange={e=>setPlanE(e.target.value)}/></div>
        </div>
        <div style={{...S.dz,...(drag?{borderColor:"#238636",background:"rgba(35,134,54,.05)"}:{})}}
          onClick={()=>fileRef.current?.click()}
          onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)parsePDF(f);}}>
          <div style={{fontSize:28,marginBottom:8}}>📄</div>
          <div style={{fontWeight:600,marginBottom:4,fontSize:13}}>Trascina il PDF qui</div>
          <div style={{color:"#6e7681",fontSize:11}}>oppure clicca per scegliere il file</div>
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)parsePDF(f);e.target.value="";}}/>
        </div>
        {diet&&<div style={{marginTop:12,...S.row,justifyContent:"center"}}>
          <span style={{...S.muted,fontSize:12}}>Piano attivo: {diet.patient?.name}</span>
          <button style={S.btnG} onClick={()=>setView("ov")}>Apri →</button>
        </div>}
        <div style={{marginTop:14,borderTop:"1px solid #21262d",paddingTop:14}}>
          <div style={{fontSize:11,color:"#6e7681",marginBottom:8,textAlign:"left"}}>
            Hai già esportato il piano in <strong style={{color:"#8b949e"}}>.md</strong>? Caricalo senza consumare token AI.
          </div>
          <button style={{...S.btnG,width:"100%",padding:"10px",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}
            onClick={()=>mdFileRef.current?.click()}>
            📝 Importa Markdown (.md)
          </button>
          <input ref={mdFileRef} type="file" accept=".md,text/markdown" style={{display:"none"}}
            onChange={e=>{const f=e.target.files?.[0];if(f)importMD(f);e.target.value="";}}/>
        </div>
      </div>
      <div style={{...S.card,...S.cardP,fontSize:12,color:"#6e7681",lineHeight:1.7}}>
        <div style={{fontWeight:700,color:"#8b949e",marginBottom:6,fontSize:11}}>Funzionalità</div>
        {[["📅","Calendario automatico o manuale con assegnazione giorni di piano"],["🍽️","Pasti e ingredienti completi per ogni giorno, con kcal"],["🛒","Lista spesa: giornaliera, settimanale o intero piano — con spunte"],["⚖️","Storico peso settimana per settimana con delta progressivo"],["⚡","Integratori sportivi: quali, quando, dose — separati per giorno"],["📝","Note libere per ogni giorno del piano"]].map(([ic,t])=>(
          <div key={t} style={{display:"flex",gap:6,marginBottom:2}}><span style={{fontSize:13}}>{ic}</span><span>{t}</span></div>
        ))}
      </div>
    </div>
  );

  // ── OVERVIEW VIEW ──
  const OvV = () => {
    if(!diet) return null;
    const p=diet.patient||{};
    const wtLast=wts.length?wts[wts.length-1].kg:p.weight;
    const delta=wtLast&&p.weight?(wtLast-p.weight).toFixed(1):null;
    return (
      <div>
        <div style={{...S.card,...S.cardP}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:18,color:"#c9d1d9",marginBottom:8}}>{p.name||"Piano Alimentare"}</div>
          <div style={{...S.row,marginBottom:10,gap:6}}>
            {diet.period?.startDate&&<span style={{background:"#21262d",border:"1px solid #30363d",borderRadius:12,padding:"2px 9px",fontSize:11,color:"#8b949e"}}>📅 {diet.period.startDate}</span>}
            {diet.period?.checkupDate&&<span style={{background:"rgba(35,134,54,.1)",border:"1px solid rgba(35,134,54,.3)",borderRadius:12,padding:"2px 9px",fontSize:11,color:"#2ea043"}}>★ Controllo {diet.period.checkupDate} {diet.period.checkupTime}</span>}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[["Peso",p.weight?(wts.length?wtLast:p.weight)+"kg":"—","#58a6ff"],["Obiettivo",p.targetWeight?p.targetWeight+"kg":"—","#2ea043"],["Var.",delta?(delta>0?"+":"")+delta+"kg":"—",delta<0?"#2ea043":"#f85149"],["BMR",p.bmr?p.bmr+" kc":"—","#d29922"],["BMI",p.bmi||"—","#8b949e"],["Media kcal",diet.avgKcal||"—","#f87171"],["Giorni piano",diet.days?.length||0,"#a78bfa"],["In calendario",Object.keys(cal).length,"#4ade80"]].map(([l,v,c])=>(
              <div key={l} style={{...S.sb}}><div style={{...S.sbN,color:c}}>{v}</div><div style={S.sbL}>{l}</div></div>
            ))}
          </div>
        </div>
        {diet.macros&&<div style={{...S.card,...S.cardP}}>
          <div style={S.cardT}>Macronutrienti medi</div>
          <div style={{display:"flex",gap:10}}>
            {[["Proteine",diet.macros.protein+"%","#f87171"],["Carboidrati",diet.macros.carbs+"%","#fbbf24"],["Grassi",diet.macros.fats+"%","#60a5fa"]].map(([l,v,c])=>(
              <div key={l} style={{flex:1,textAlign:"center",background:"#21262d",borderRadius:6,padding:10}}>
                <div style={{fontSize:20,fontWeight:700,color:c,fontFamily:"Georgia,serif"}}>{v}</div>
                <div style={S.sbL}>{l}</div>
              </div>
            ))}
          </div>
        </div>}
        <div style={{...S.card,...S.cardP}}>
          <div style={S.cardT}>Configurazione Piano</div>
          <div style={{...S.row,marginBottom:10}}>
            <div><label style={S.lbl}>Inizio</label><input type="date" style={S.inp} value={planS} onChange={e=>setPlanS(e.target.value)}/></div>
            <div><label style={S.lbl}>Fine/Controllo</label><input type="date" style={S.inp} value={planE} onChange={e=>setPlanE(e.target.value)}/></div>
          </div>
          <div style={S.row}>
            <button style={S.btn} onClick={()=>{genCal();setView("cal");}}>🗓 Genera Calendario Auto</button>
            <button style={S.btnG} onClick={()=>setView("cal")}>Vai al Calendario →</button>
            <button style={{...S.btnG,color:"#f85149",borderColor:"rgba(248,81,73,.3)",marginLeft:"auto"}} onClick={reset}>🗑 Reset</button>
          </div>
        </div>
        <div style={{...S.card,...S.cardP}}>
          <div style={S.cardT}>Giorni del Piano ({diet.days?.length})</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {diet.days?.map(d=>{ const a=getAct(d.activityType); return (
              <div key={d.n} onClick={()=>setView("meals")} style={{background:a.bg,border:`1px solid ${a.c}44`,borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer",transition:"opacity .15s"}}>
                <div style={{fontWeight:700,color:a.c}}>G.{d.n}</div>
                <div style={{color:"#6e7681",fontSize:9}}>{d.activity?.substring(0,14)}</div>
                <div style={{color:a.c,fontSize:9}}>{d.kcal} kcal</div>
              </div>
            );})}
          </div>
        </div>
      </div>
    );
  };

  // ── CALENDAR VIEW ──
  const CalV = () => {
    const {y,m}=nav;
    const lastD=new Date(y,m+1,0).getDate();
    const startDow=(new Date(y,m,1).getDay()+6)%7;
    const todayDk=dk(new Date()), selDk=dk(selDt);
    const selDay=dayFor(selDt), selAct=selDay?(ACTS[selDay.activityType]||ACTS.rest):null;
    return (
      <div>
        <div style={{...S.card,...S.cardP}}>
          <div style={{...S.row,marginBottom:10,justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
            <div style={S.row}>
              <button style={S.btnG} onClick={()=>setNav(p=>{let nm=p.m-1,ny=p.y;if(nm<0){nm=11;ny--;}return{y:ny,m:nm};})}>‹</button>
              <div style={{fontWeight:700,fontSize:14,minWidth:130,textAlign:"center"}}>{MI[m]} {y}</div>
              <button style={S.btnG} onClick={()=>setNav(p=>{let nm=p.m+1,ny=p.y;if(nm>11){nm=0;ny++;}return{y:ny,m:nm};})}>›</button>
              <button style={{...S.btnG,fontSize:11}} onClick={()=>{const t=new Date();setNav({y:t.getFullYear(),m:t.getMonth()});setSelDt(t);}}>Oggi</button>
            </div>
            <div style={S.row}>
              <button style={S.btn} onClick={genCal}>↻ Rigenera</button>
              <button style={{...S.btnG,fontSize:12,...(showCalCfg?{borderColor:"#58a6ff",color:"#58a6ff"}:{})}} onClick={()=>setShowCalCfg(p=>!p)}>⚙️ Vincoli</button>
              {manDay&&<span style={{color:"#fb923c",fontWeight:700,fontSize:12,background:"rgba(251,146,60,.1)",border:"1px solid rgba(251,146,60,.3)",borderRadius:6,padding:"3px 8px"}}>G.{manDay} → clicca giorno <button style={{...S.btnG,padding:"0 5px",fontSize:10,marginLeft:4}} onClick={()=>setManDay(null)}>✕</button></span>}
            </div>
          </div>
          {/* Pannello vincoli generazione */}
          {showCalCfg&&<div style={{background:"#0d1117",borderRadius:6,padding:"10px 12px",marginBottom:10,border:"1px solid #30363d"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:700,color:"#58a6ff",textTransform:"uppercase",letterSpacing:"0.07em"}}>⚙️ Vincoli — Attività per giorno</span>
              <button style={{...S.btnG,fontSize:10,padding:"2px 7px"}} onClick={()=>{ setDowAct(DEFAULT_DOW_ACT); store.set("dm-dow-act",DEFAULT_DOW_ACT); }}>↺ Reset</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"4px 16px"}}>
              {DOW_LABELS.map(([dow,label])=>{
                const cur=dowAct[dow]||"rest";
                const curAct=getAct(cur);
                return (
                  <div key={dow} style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,color:"#8b949e",width:68,flexShrink:0,fontWeight:600}}>{label}</span>
                    <select value={cur} onChange={e=>{ const nd={...dowAct,[dow]:e.target.value}; setDowAct(nd); store.set("dm-dow-act",nd); }}
                      style={{...S.inp,padding:"3px 6px",fontSize:11,flex:1,minWidth:0,color:curAct.c,background:"#161b22"}}>
                      {Object.entries(ACTS).map(([k,a])=>{
                        const pool=diet?.days?.filter(d=>d.activityType===k)||[];
                        return <option key={k} value={k} style={{color:"#c9d1d9",background:"#161b22"}}>{a.label}{pool.length?` (G.${pool.map(d=>d.n).join(",")})`:""}</option>;
                      })}
                    </select>
                  </div>
                );
              })}
            </div>
            <div style={{marginTop:8,fontSize:10,color:"#6e7681"}}>I giorni con un solo giorno disponibile (es. Lungo BDC, Lungo RUN) vengono sempre assegnati. La generazione è casuale: ogni click su Rigenera produce un piano diverso.</div>
          </div>}
          {/* Assign buttons */}
          <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:10}}>
            <span style={{...S.muted,fontSize:10,alignSelf:"center"}}>Assegna manualmente:</span>
            {diet?.days?.map(d=>{ const a=getAct(d.activityType); return (
              <button key={d.n} onClick={()=>setManDay(manDay===d.n?null:d.n)} style={{background:manDay===d.n?a.c:a.bg,border:`1px solid ${a.c}66`,borderRadius:4,padding:"2px 7px",fontSize:10,fontWeight:700,color:manDay===d.n?"#0d1117":a.c,cursor:"pointer"}}>G.{d.n}</button>
            );})}
            <button style={{...S.btnG,fontSize:10,padding:"2px 7px",marginLeft:"auto",color:"#f85149",borderColor:"rgba(248,81,73,.3)"}} onClick={()=>setCal({})}>🗑</button>
          </div>
          {/* Grid */}
          <div style={S.cg}>
            {["L","M","M","G","V","S","D"].map((d,i)=><div key={i} style={S.cdow}>{d}</div>)}
            {Array(startDow).fill(null).map((_,i)=><div key={"e"+i} style={S.dcE}/>)}
            {Array(lastD).fill(null).map((_,i)=>{
              const date=new Date(y,m,i+1), dKey=dk(date);
              const gn=cal[dKey], dayD=gn?diet?.days?.find(x=>x.n===gn):null;
              const a=dayD?(getAct(dayD.activityType)):null;
              const isT=dKey===todayDk, isS=dKey===selDk;
              const isCtrl=planE&&dKey===planE;
              return <div key={i} onClick={()=>{ setSelDt(date); if(manDay!==null){setCal(p=>({...p,[dKey]:manDay}));setManDay(null);} }}
                style={{...S.dc,background:a?a.bg:isT?"rgba(210,153,34,.06)":"#161b22",borderColor:isCtrl?"#2ea043":isS?"#388bfd":isT?"#d29922":a?a.c+"33":"#21262d",opacity:gn?1:.4}}>
                <div style={{fontSize:9,fontWeight:600,color:isCtrl?"#2ea043":isS?"#58a6ff":isT?"#d29922":"#6e7681"}}>{i+1}</div>
                {dayD&&<div style={{fontSize:7,fontWeight:700,borderRadius:2,padding:"1px 3px",background:a?.c+"22",color:a?.c}}>G.{gn}</div>}
                {isCtrl&&!dayD&&<div style={{fontSize:6,color:"#2ea043",fontWeight:700}}>★</div>}
              </div>;
            })}
          </div>
        </div>
        {/* Legend */}
        <div style={{...S.card,...S.cardP,padding:"8px 12px"}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {Object.entries(ACTS).map(([k,a])=><div key={k} style={{display:"flex",alignItems:"center",gap:4,fontSize:10}}><div style={{width:8,height:8,borderRadius:2,background:a.c,flexShrink:0}}/><span style={S.muted}>{a.label}</span></div>)}
            {planE&&<div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,marginLeft:"auto"}}><div style={{width:8,height:8,borderRadius:2,background:"#2ea043"}}/><span style={S.muted}>Controllo</span></div>}
          </div>
        </div>
        {/* Selected day */}
        {selDay&&selAct&&<div style={S.card}>
          <div style={{...S.cardH,background:selAct.bg,borderBottom:`1px solid ${selAct.c}33`}}>
            <span style={{color:selAct.c,fontWeight:700}}>G.{selDay.n} · {selDay.activity}</span>
            <div style={S.row}><span style={{...S.muted,fontSize:11}}>⚡ {selDay.kcal} kcal</span><button style={S.btnG} onClick={()=>setView("meals")}>Pasti →</button><button style={S.btnG} onClick={()=>{setShopM("day");setShopDt(dk(selDt));setView("shop");}}>Spesa →</button></div>
          </div>
          <div style={S.cardP}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
              {selDay.meals?.map(meal=>{const mk=meal.foods?.reduce((s,f)=>s+(f.kcal||0),0)||0; return (
                <div key={meal.name} style={{background:"#21262d",border:"1px solid #30363d",borderRadius:6,padding:"5px 8px",fontSize:11}}>
                  <div style={{fontWeight:700}}>{meal.icon} {meal.name}</div>
                  <div style={{color:"#6e7681",fontSize:9}}>{meal.foods?.length} alim. · {mk} kc</div>
                </div>
              );})}
            </div>
            {selDay.supplements?.length>0&&<div style={{fontSize:11,color:"#58a6ff"}}>⚡ {selDay.supplements.join(" · ")}</div>}
            <div style={{marginTop:8}}>
              <label style={S.lbl}>📝 Note</label>
              <textarea style={{...S.inp,width:"100%",minHeight:46,resize:"vertical",fontSize:12}} placeholder="Appunti, varianti..." value={notes[dk(selDt)]||""} onChange={e=>setNotes(p=>({...p,[dk(selDt)]:e.target.value}))}/>
            </div>
          </div>
        </div>}
        {!selDay&&<div style={{...S.card,...S.cardP,textAlign:"center",color:"#6e7681",fontSize:12}}>Clicca un giorno con piano assegnato per i dettagli</div>}
      </div>
    );
  };

  // ── MEALS VIEW ──
  const MealsV = () => {
    const [ld,setLd]=useState(dk(selDt));
    const date=pd(ld), day=dayFor(date);
    const act=day?(getAct(day.activityType)):null;
    return (
      <div>
        <div style={{...S.card,...S.cardP}}>
          <div style={S.row}>
            <div><label style={S.lbl}>Data</label><input type="date" style={S.inp} value={ld} onChange={e=>{setLd(e.target.value);setSelDt(pd(e.target.value));}}/></div>
            {day&&<div style={{...S.row,marginLeft:"auto"}}>
              <div style={{background:act?.bg,border:`1px solid ${act?.c}44`,borderRadius:6,padding:"4px 9px",fontSize:11,fontWeight:700,color:act?.c}}>G.{day.n} · {day.activity}</div>
              <span style={{...S.muted,fontSize:11}}>⚡ {day.kcal} kcal</span>
            </div>}
            <button style={{...S.btnG,marginLeft:"auto",fontSize:11,padding:"4px 10px"}} onClick={()=>setView("shop")}>🛒 Spesa →</button>
          </div>
        </div>
        {!day&&<div style={{...S.card,...S.cardP,textAlign:"center",color:"#6e7681"}}>Nessun piano assegnato. <button style={{...S.btnG,marginLeft:8}} onClick={()=>setView("cal")}>Vai al Calendario →</button></div>}
        {day?.meals?.map(meal=>{
          const mk=meal.foods?.reduce((s,f)=>s+(f.kcal||0),0)||0;
          return <div key={meal.name} style={S.mc}>
            <div style={S.mh}>
              <div style={{fontWeight:700,fontSize:12}}>{meal.icon} {meal.name}</div>
              <div style={{fontSize:11,color:"#6e7681",background:"#21262d",borderRadius:10,padding:"1px 7px"}}>{mk} kcal</div>
            </div>
            {meal.foods?.map((f,fi)=>{ const sUrl=f.isSupplement?getSupplementUrl(f.name):null; return (
              <div key={fi} style={{...S.fi,background:f.isSupplement?"rgba(88,166,255,.04)":"transparent"}}>
                <div style={{color:f.isSupplement?"#58a6ff":"#c9d1d9",display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                  {f.isSupplement&&<span style={{fontSize:8,background:"rgba(31,111,235,.2)",color:"#58a6ff",borderRadius:3,padding:"1px 4px",fontWeight:700}}>SPORT</span>}
                  {f.name}
                  {sUrl&&<a href={sUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:9,color:"#58a6ff",textDecoration:"none",background:"rgba(31,111,235,.15)",borderRadius:3,padding:"1px 5px"}} title="Acquista prodotto">🔗</a>}
                </div>
                <div style={{color:"#d29922",fontWeight:600,fontSize:11}}>{f.qty}</div>
                <div style={{color:"#6e7681",fontSize:10}}>{f.kcal>0?f.kcal+" kc":""}</div>
              </div>
            );})}
          </div>;
        })}
        {day?.condiments&&Object.keys(day.condiments).length>0&&(
          <div style={S.mc}>
            <div style={S.mh}><div style={{fontWeight:700,fontSize:12}}>🫙 Condimenti</div></div>
            {Object.entries(day.condiments).filter(([,g])=>g>0).map(([name,g])=>(
              <div key={name} style={S.fi}><div>{name}</div><div style={{color:"#d29922",fontWeight:600,fontSize:11}}>{g}g</div><div/></div>
            ))}
          </div>
        )}
        {day?.macros&&<div style={{...S.card,...S.cardP}}>
          <div style={S.cardT}>Macronutrienti del giorno</div>
          <div style={{display:"flex",gap:6}}>
            {[["Proteine",day.macros.prot+"g","#f87171"],["Carboidrati",day.macros.carb+"g","#fbbf24"],["Grassi",day.macros.fat+"g","#60a5fa"],["Totale",day.kcal+" kc","#c9d1d9"]].map(([l,v,c])=>(
              <div key={l} style={{...S.sb}}><div style={{...S.sbN,color:c,fontSize:14}}>{v}</div><div style={S.sbL}>{l}</div></div>
            ))}
          </div>
        </div>}
        <div style={{...S.card,...S.cardP}}>
          <label style={S.lbl}>📝 Note per questo giorno</label>
          <textarea style={{...S.inp,width:"100%",minHeight:60,resize:"vertical",fontSize:12}} placeholder="Varianti, note, promemoria..." value={notes[ld]||""} onChange={e=>setNotes(p=>({...p,[ld]:e.target.value}))}/>
        </div>
      </div>
    );
  };

  // ── SHOPPING VIEW ──
  const ShopV = () => {
    const [from,to]=getShopRange();
    // Calcola la lista dei giorni nel range (max 14 per week, tutti per plan)
    const rangeDays = [];
    const rcur = new Date(from);
    while(rcur<=to){ rangeDays.push(new Date(rcur)); rcur.setDate(rcur.getDate()+1); }
    const exclCount = rangeDays.filter(d=>excl[dk(d)]).length;
    const activeCount = rangeDays.length - exclCount;

    const items=getShopItems(from,to);
    const fresh=items.filter(i=>!i.isSup), supp=items.filter(i=>i.isSup);
    const visible=showSup?items:fresh;
    const done=visible.filter(i=>chk[i.name]).length;
    const pct=visible.length?Math.round(done/visible.length*100):0;
    const tog=k=>setChk(p=>({...p,[k]:!p[k]}));
    const totFresh = fresh.reduce((s,i)=>s+(i.estCost&&!i.estCostApprox?i.estCost:0),0);
    const pricedCount = fresh.filter(i=>i.priceInfo).length;
    const approxCount = fresh.filter(i=>i.priceInfo&&i.estCostApprox).length;

    // Raggruppa rangeDays per settimana (per plan mode)
    const byWeek = [];
    rangeDays.forEach(d=>{
      const dow=d.getDay(); const isFirstOfWeek = dow===1||(byWeek.length===0);
      if(isFirstOfWeek||byWeek.length===0) byWeek.push([]);
      if(byWeek[byWeek.length-1].length>0 && dow===1) byWeek.push([]);
      byWeek[byWeek.length-1].push(d);
    });

    const DayPill = ({date}) => {
      const dKey=dk(date);
      const day=dayFor(date);
      const act=day?(getAct(day.activityType)):null;
      const isEx=!!excl[dKey];
      const dow=["D","L","M","M","G","V","S"][date.getDay()];
      return (
        <div onClick={()=>toggleExcl(dKey)} style={{
          background:isEx?"#161b22":act?act.bg:"#21262d",
          border:`2px solid ${isEx?"#f8514966":act?act.c+"55":"#30363d"}`,
          borderRadius:7,padding:"5px 7px",cursor:"pointer",textAlign:"center",
          opacity:isEx?.42:1,transition:"all .15s",minWidth:46,position:"relative"
        }}>
          {isEx&&<div style={{position:"absolute",top:1,right:3,fontSize:8,color:"#f85149",fontWeight:900}}>✕</div>}
          <div style={{fontSize:9,fontWeight:700,color:isEx?"#6e7681":act?.c||"#94a3b8"}}>{dow} {date.getDate()}</div>
          {day?<div style={{fontSize:8,fontWeight:700,color:isEx?"#6e7681":act?.c,marginTop:1}}>G.{day.n}</div>
              :<div style={{fontSize:8,color:"#6e7681",marginTop:1}}>—</div>}
          <div style={{fontSize:7,color:isEx?"#f85149":"#2ea043",marginTop:1,fontWeight:600}}>{isEx?"fuori":"✓"}</div>
        </div>
      );
    };

    return (
      <div>
        {/* Controls */}
        <div style={{...S.card,...S.cardP}}>
          <div style={{...S.row,marginBottom:10,flexWrap:"wrap",gap:6}}>
            {[["day","📅 Giorno"],["week","📆 Settimana"],["plan","📋 Tutto il piano"]].map(([v,l])=>(
              <button key={v} style={{...S.btnG,...(shopM===v?{background:"#1f6feb",borderColor:"#388bfd",color:"#fff"}:{})}} onClick={()=>setShopM(v)}>{l}</button>
            ))}
            {shopM!=="plan"&&<input type="date" style={{...S.inp,marginLeft:"auto"}} value={shopDt} onChange={e=>setShopDt(e.target.value)}/>}
            <button style={{...S.btnG,...(showSup?{borderColor:"#238636",color:"#2ea043"}:{})}} onClick={()=>setShowSup(p=>!p)}>{showSup?"👁 Tutti":"👁 Solo cibo"}</button>
            <button style={{...S.btnG,fontSize:11,padding:"4px 10px"}} onClick={()=>setView("meals")}>← 🍽 Pasti</button>
          </div>

          {/* Esclusione giorni — settimana */}
          {shopM==="week"&&(
            <div style={{marginBottom:12}}>
              <div style={{...S.row,marginBottom:6,gap:6}}>
                <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#6e7681"}}>Giorni inclusi — clicca per escludere</span>
                {exclCount>0&&<>
                  <span style={{fontSize:11,color:"#f59e0b",fontWeight:600}}>⚠ {exclCount} {exclCount===1?"giorno escluso":"giorni esclusi"}</span>
                  <button style={{...S.btnG,fontSize:10,padding:"2px 7px",color:"#2ea043",borderColor:"rgba(46,164,54,.4)"}} onClick={()=>{ rangeDays.forEach(d=>excl[dk(d)]&&toggleExcl(dk(d))); }}>✓ Includi tutti</button>
                </>}
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {rangeDays.map(d=><DayPill key={dk(d)} date={d}/>)}
              </div>
            </div>
          )}

          {/* Esclusione giorni — piano completo (per settimane) */}
          {shopM==="plan"&&rangeDays.length>0&&(
            <div style={{marginBottom:12}}>
              <div style={{...S.row,marginBottom:6,gap:6}}>
                <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#6e7681"}}>Giorni inclusi ({activeCount}/{rangeDays.length}) — clicca per escludere</span>
                {exclCount>0&&<>
                  <span style={{fontSize:11,color:"#f59e0b",fontWeight:600}}>⚠ {exclCount} esclusi</span>
                  <button style={{...S.btnG,fontSize:10,padding:"2px 7px",color:"#2ea043",borderColor:"rgba(46,164,54,.4)"}} onClick={()=>setExcl({})}>✓ Tutti</button>
                </>}
              </div>
              {/* Mini-griglia: una riga per settimana */}
              {byWeek.map((wk,wi)=>(
                <div key={wi} style={{marginBottom:4}}>
                  <div style={{fontSize:9,color:"#6e7681",marginBottom:3,fontWeight:600}}>
                    Sett.{wi+1} · {wk[0].toLocaleDateString("it-IT",{day:"numeric",month:"short"})} – {wk[wk.length-1].toLocaleDateString("it-IT",{day:"numeric",month:"short"})}
                  </div>
                  <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                    {wk.map(d=><DayPill key={dk(d)} date={d}/>)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Progress */}
          <div style={S.row}>
            <div style={{flex:1,background:"#21262d",borderRadius:20,height:6,overflow:"hidden"}}><div style={{height:"100%",background:"#238636",borderRadius:20,width:pct+"%",transition:"width .3s"}}/></div>
            <span style={{...S.muted,fontSize:11}}>{done}/{visible.length} · {pct}%</span>
            <button style={{...S.btnG,fontSize:11,padding:"3px 8px"}} onClick={()=>setChk({})}>↺ Reset</button>
          </div>
          <div style={{...S.muted,fontSize:11,marginTop:5}}>
            {shopM==="day"&&`${fmtDate(from,{weekday:"long",day:"numeric",month:"long"})}`}
            {shopM==="week"&&`${fmtDate(from,{day:"numeric",month:"short"})} – ${fmtDate(to,{day:"numeric",month:"short",year:"numeric"})}${exclCount>0?` · ${activeCount} giorni attivi`:""}`}
            {shopM==="plan"&&`Piano completo: ${planS} → ${planE}${exclCount>0?` · ${activeCount} giorni su ${rangeDays.length}`:""}`}
          </div>
        </div>

        {fresh.length>0&&<div style={{...S.card,...S.cardP,background:"rgba(210,153,34,.05)",border:"1px solid rgba(210,153,34,.25)"}}>
          <div style={{...S.row,justifyContent:"space-between"}}>
            <div>
              <div style={{fontFamily:"Georgia,serif",fontSize:18,color:"#d29922"}}>€{totFresh.toFixed(2)}</div>
              <div style={{fontSize:10,color:"#6e7681"}}>Totale stimato ({pricedCount}/{fresh.length} prodotti prezzati{approxCount>0?`, ${approxCount} a peso variabile escluse dal totale`:""})</div>
            </div>
            <button style={S.btnG} onClick={()=>setView("prices")}>💰 Gestisci prezzi →</button>
          </div>
        </div>}

        {fresh.length>0&&<div style={S.card}>
          <div style={S.cardH}><span>🛒 Alimenti ({fresh.length})</span><span style={{...S.muted,fontSize:11}}>{fresh.filter(i=>chk[i.name]).length} ✓</span></div>
          {fresh.map(item=>(
            <div key={item.name} onClick={()=>tog(item.name)} style={{...S.si,gridTemplateColumns:"20px 1fr auto auto auto",...(chk[item.name]?{background:"rgba(35,134,54,.06)",opacity:.6}:{})}}>
              <div style={{...S.cb,...(chk[item.name]?{background:"#238636",borderColor:"#238636",color:"#fff"}:{})}}>✓</div>
              <div style={chk[item.name]?{textDecoration:"line-through",color:"#6e7681"}:{}}>{item.name}{item.count>1&&<span style={{...S.muted,fontSize:10,marginLeft:4}}>×{item.count}gg</span>}</div>
              <div style={{color:"#d29922",fontWeight:600,fontSize:11}}>{item.qty}</div>
              <div style={{...S.muted,fontSize:10}}>{item.kcal>0?item.kcal+" kc":""}</div>
              <div style={{fontSize:10,textAlign:"right",minWidth:46}}>
                {item.priceInfo
                  ? <span style={{color:"#d29922",fontWeight:700}}>{item.estCostApprox?"~":""}€{item.estCost.toFixed(2)}</span>
                  : <span style={{color:"#6e7681",cursor:"pointer"}} onClick={(e)=>{e.stopPropagation();openPriceQuickAdd(item.name);}} title="Aggiungi prezzo">+ prezzo</span>}
              </div>
            </div>
          ))}
        </div>}

        {showSup&&supp.length>0&&<div style={S.card}>
          <div style={{...S.cardH,background:"rgba(88,166,255,.06)"}}><span style={{color:"#58a6ff"}}>⚡ Integratori ({supp.length}) — Non al Conad</span></div>
          {supp.map(item=>{ const sUrl=getSupplementUrl(item.name); return (
            <div key={item.name} style={{...S.si,background:"rgba(88,166,255,.03)",...(chk[item.name]?{opacity:.6}:{}),gridTemplateColumns:"20px 1fr auto auto auto"}}>
              <div onClick={()=>tog(item.name)} style={{...S.cb,...(chk[item.name]?{background:"#238636",borderColor:"#238636",color:"#fff"}:{}),cursor:"pointer"}}>✓</div>
              <div onClick={()=>tog(item.name)} style={{color:"#58a6ff",...(chk[item.name]?{textDecoration:"line-through",color:"#6e7681"}:{}),cursor:"pointer"}}>{item.name}{item.count>1&&<span style={{...S.muted,fontSize:10,marginLeft:4}}>×{item.count}</span>}</div>
              <div style={{color:"#d29922",fontWeight:600,fontSize:11}}>{item.qty}</div>
              <div style={{...S.muted,fontSize:10}}>{sUrl?"":"amazon/farmacia"}</div>
              {sUrl?<a href={sUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:10,color:"#58a6ff",textDecoration:"none",background:"rgba(31,111,235,.2)",borderRadius:4,padding:"2px 7px",fontWeight:600,whiteSpace:"nowrap"}}>🔗 Acquista</a>:<div/>}
            </div>
          );})}

        </div>}
        {visible.length===0&&<div style={{...S.card,...S.cardP,textAlign:"center",color:"#6e7681",fontSize:12}}>
          {exclCount>0&&exclCount===rangeDays.length?"Tutti i giorni sono esclusi — clicca i pill sopra per includerli.":"Nessun ingrediente. Genera il calendario prima e seleziona un periodo valido."}
        </div>}
      </div>
    );
  };

  // ── WEIGHT VIEW ──
  const WtV = () => {
    const p=diet?.patient||{}, tgt=p.targetWeight, sw=p.weight;
    const last=wts.length?wts[wts.length-1].kg:sw;
    const delta=last&&sw?(last-sw).toFixed(1):null;
    const pct=sw&&tgt&&last?Math.min(100,Math.max(0,((sw-last)/(sw-tgt)*100))).toFixed(0):0;
    const addWt=()=>{ if(!wtI) return; const today=dk(new Date()); setWts(p=>[...p.filter(x=>x.dt!==today),{dt:today,kg:parseFloat(wtI),note:wtN}].sort((a,b)=>a.dt.localeCompare(b.dt))); setWtI(""); setWtN(""); };
    return (
      <div>
        <div style={{...S.card,...S.cardP}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
            {[["Inizio",sw?sw+"kg":"—","#6e7681"],["Attuale",last?last+"kg":"—","#58a6ff"],["Obiettivo",tgt?tgt+"kg":"—","#2ea043"],["Variazione",delta?(delta>0?"+":"")+delta+"kg":"—",delta<0?"#2ea043":"#f85149"],["Progresso",pct+"%","#d29922"]].map(([l,v,c])=>(
              <div key={l} style={S.sb}><div style={{...S.sbN,color:c}}>{v}</div><div style={S.sbL}>{l}</div></div>
            ))}
          </div>
          {sw&&tgt&&<div>
            <div style={{...S.row,justifyContent:"space-between",marginBottom:4,fontSize:11}}>
              <span style={S.muted}>{sw}kg inizio</span><span style={{fontWeight:700,color:"#58a6ff"}}>{last}kg attuale</span><span style={S.muted}>{tgt}kg target</span>
            </div>
            <div style={{background:"#21262d",borderRadius:20,height:8,overflow:"hidden"}}><div style={{height:"100%",background:"#238636",borderRadius:20,width:pct+"%",transition:"width .5s"}}/></div>
          </div>}
        </div>
        <div style={{...S.card,...S.cardP}}>
          <div style={S.cardT}>Registra peso</div>
          <div style={{...S.row,flexWrap:"wrap"}}>
            <div><label style={S.lbl}>Peso (kg)</label><input type="number" step="0.1" placeholder="82.5" style={{...S.inp,width:100}} value={wtI} onChange={e=>setWtI(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWt()}/></div>
            <div style={{flex:1,minWidth:130}}><label style={S.lbl}>Nota opzionale</label><input type="text" placeholder="es. mattina a digiuno" style={{...S.inp,width:"100%"}} value={wtN} onChange={e=>setWtN(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWt()}/></div>
            <div style={{alignSelf:"flex-end"}}><button style={S.btn} onClick={addWt}>+ Aggiungi</button></div>
          </div>
        </div>
        {wts.length>0&&<div style={S.card}>
          <div style={S.cardH}><span>Storico ({wts.length} misurazioni)</span><button style={{...S.btnG,fontSize:10,padding:"2px 6px",color:"#f85149",borderColor:"rgba(248,81,73,.3)"}} onClick={()=>setWts([])}>Azzera</button></div>
          {[...wts].reverse().map((w,i,arr)=>{ const prev=arr[i+1]; const diff=prev?(w.kg-prev.kg).toFixed(1):null; return (
            <div key={w.dt} style={{display:"grid",gridTemplateColumns:"auto 1fr auto auto",gap:8,padding:"5px 10px",borderBottom:"1px solid #161b22",alignItems:"center",fontSize:12}}>
              <div style={{...S.muted,fontSize:10,fontFamily:"monospace"}}>{w.dt}</div>
              <div style={{fontWeight:700,color:"#58a6ff"}}>{w.kg} kg {w.note&&<span style={{...S.muted,fontWeight:400,fontSize:10}}>· {w.note}</span>}</div>
              <div style={{fontSize:11,color:diff<0?"#2ea043":diff>0?"#f85149":"#6e7681"}}>{diff?(diff>0?"+":"")+diff+" kg":"—"}</div>
              <button onClick={()=>setWts(p=>p.filter(x=>x.dt!==w.dt))} style={{...S.btnG,fontSize:10,padding:"1px 5px",color:"#f85149",borderColor:"rgba(248,81,73,.3)"}}>✕</button>
            </div>
          );})}
        </div>}
        {wts.length===0&&<div style={{...S.card,...S.cardP,textAlign:"center",color:"#6e7681",fontSize:12}}>Nessuna misurazione. Registra il peso ogni settimana per seguire i progressi.</div>}
      </div>
    );
  };

  // ── SUPPLEMENTS VIEW ──
  const SuppV = () => {
    if(!diet) return null;
    const allS={};
    diet.days?.forEach(d=>{ d.meals?.forEach(m=>m.foods?.filter(f=>f.isSupplement).forEach(f=>{
      if(!allS[f.name]) allS[f.name]={name:f.name,qty:f.qty,days:[],count:0};
      if(!allS[f.name].days.includes(d.n)) allS[f.name].days.push(d.n);
      allS[f.name].count++;
    })); });
    const sl=Object.values(allS);
    const today=new Date(), dow=today.getDay();
    const mon=new Date(today); mon.setDate(today.getDate()-(dow===0?6:dow-1));
    const weekDays=Array(7).fill(null).map((_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d; });
    return (
      <div>
        <div style={{...S.card,...S.cardP}}>
          <div style={{...S.cardT,color:"#58a6ff"}}>⚡ Integratori nel Piano</div>
          <div style={{...S.muted,fontSize:11,marginBottom:10}}>Non disponibili al Conad — acquisto online (amazon.it, decathlon.it) o in farmacia</div>
          {sl.length===0&&<div style={{...S.muted,fontSize:12}}>Nessun integratore trovato. L'AI marca come SPORT: proteine in polvere, gel, barrette energetiche sportive, creatina.</div>}
          {sl.map(s=>{ const uses=Object.entries(cal).filter(([,gn])=>s.days.includes(gn)).length; const sUrl=getSupplementUrl(s.name); return (
            <div key={s.name} style={{...S.mc,marginBottom:8}}>
              <div style={{...S.mh,background:"rgba(88,166,255,.07)"}}>
                <span style={{color:"#58a6ff",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:6}}>
                  {s.name}
                  {sUrl&&<a href={sUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:"#58a6ff",textDecoration:"none",background:"rgba(31,111,235,.2)",borderRadius:4,padding:"1px 7px",fontWeight:600}}>🔗 Acquista</a>}
                </span>
                <span style={{...S.muted,fontSize:10}}>Dose: {s.qty} · G.{s.days.join(", G.")}</span>
              </div>
              <div style={{...S.cardP,display:"flex",gap:6}}>
                {[["Giorni piano",s.days.length,"#58a6ff"],["Usi nel periodo",uses,"#2ea043"],["Dose/uso",s.qty,"#d29922"]].map(([l,v,c])=>(
                  <div key={l} style={S.sb}><div style={{...S.sbN,color:c,fontSize:13}}>{v}</div><div style={S.sbL}>{l}</div></div>
                ))}
              </div>
            </div>
          );})}
        </div>
        <div style={{...S.card,...S.cardP}}>
          <div style={S.cardT}>Integratori questa settimana</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {weekDays.map(d=>{ const day=dayFor(d); const supps=day?.meals?.flatMap(m=>m.foods?.filter(f=>f.isSupplement)||[])||[]; const isT=dk(d)===dk(today); return (
              <div key={dk(d)} style={{flex:1,minWidth:75,background:isT?"rgba(210,153,34,.07)":"#161b22",border:`1px solid ${isT?"#d29922":"#21262d"}`,borderRadius:6,padding:"6px 7px"}}>
                <div style={{fontSize:10,fontWeight:700,color:isT?"#d29922":"#6e7681",marginBottom:3}}>{["Dom","Lun","Mar","Mer","Gio","Ven","Sab"][d.getDay()]} {d.getDate()}{day&&<span style={{color:getAct(day.activityType).c,marginLeft:2,fontSize:8}}>G.{day.n}</span>}</div>
                {supps.length===0?<div style={{fontSize:9,color:"#6e7681"}}>—</div>:supps.map(s=><div key={s.name} style={{fontSize:9,color:"#58a6ff",marginBottom:1,lineHeight:1.3}}>{s.name.substring(0,16)}<br/><span style={{color:"#d29922"}}>{s.qty}</span></div>)}
              </div>
            );})}
          </div>
        </div>
      </div>
    );
  };

  // ── PRICES VIEW ──
  const PricesV = () => {
    const uniqueCats = [...new Set(prices.prodotti.map(p=>p.categoria))].sort();
    const filtered = prices.prodotti.filter(p=>{
      if(priceFilter==="matched" && !p.presenteNelPiano) return false;
      if(priceFilter==="unmatched" && p.presenteNelPiano) return false;
      if(priceCatFilter!=="all" && p.categoria!==priceCatFilter) return false;
      if(priceSearch){
        const s=priceSearch.toLowerCase();
        const hay=(p.descrizione+" "+(p.nomePiano||"")).toLowerCase();
        if(!hay.includes(s)) return false;
      }
      return true;
    });
    const matched = prices.prodotti.filter(p=>p.presenteNelPiano).length;
    const avgPrice = prices.prodotti.length ? (prices.prodotti.reduce((s,p)=>s+Number(p.prezzo||0),0)/prices.prodotti.length).toFixed(2) : "0.00";

    const grouped = {};
    filtered.forEach(p=>{ (grouped[p.categoria]=grouped[p.categoria]||[]).push(p); });

    const saveEdit = (id, patch) => {
      setPrices(prev=>({...prev, prodotti: prev.prodotti.map(p=>p.id===id?{...p,...patch,presenteNelPiano:!!(patch.nomePiano??p.nomePiano)}:p)}));
      setPriceEditId(null);
    };
    const deleteProd = (id) => {
      if(!confirm("Eliminare questo prodotto dal prezzario?")) return;
      setPrices(prev=>({...prev, prodotti: prev.prodotti.filter(p=>p.id!==id)}));
    };
    const addProd = (newP) => {
      setPrices(prev=>({...prev, prodotti:[...prev.prodotti, newP]}));
      setPriceModal(false);
    };

    return (
      <div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
          {[["Prodotti totali",prices.prodotti.length,"#58a6ff"],["Nel piano",matched,"#2ea043"],["Extra scontrino",prices.prodotti.length-matched,"#8b949e"],["Prezzo medio","€"+avgPrice,"#d29922"],["Categorie",uniqueCats.length,"#a78bfa"]].map(([l,v,c])=>(
            <div key={l} style={S.sb}><div style={{...S.sbN,color:c,fontSize:14}}>{v}</div><div style={S.sbL}>{l}</div></div>
          ))}
        </div>

        <div style={{...S.card,...S.cardP}}>
          <div style={{...S.row,marginBottom:8}}>
            <input style={{...S.inp,flex:1,minWidth:140}} placeholder="🔍 Cerca per descrizione o nome piano..." value={priceSearch} onChange={e=>setPriceSearch(e.target.value)}/>
            <button style={S.btn} onClick={()=>{setPendingPriceDesc("");setPriceModal(true);}}>+ Nuovo</button>
            <button style={S.btnG} onClick={()=>priceFileRef.current?.click()}>📂 Carica JSON</button>
            <input ref={priceFileRef} type="file" accept=".json" style={{display:"none"}} onChange={e=>{
              const f=e.target.files?.[0]; if(!f) return;
              const r=new FileReader();
              r.onload=ev=>{ try{ const parsed=JSON.parse(ev.target.result); if(!Array.isArray(parsed.prodotti)) throw new Error("manca array prodotti"); setPrices(parsed); alert(`Caricati ${parsed.prodotti.length} prodotti`); }catch(err){ alert("Errore JSON: "+err.message); } };
              r.readAsText(f); e.target.value="";
            }}/>
            <button style={S.btnB} onClick={()=>{
              const blob=new Blob([JSON.stringify({...prices,ultimoAggiornamento:dk(new Date())},null,2)],{type:"application/json"});
              const url=URL.createObjectURL(blob); const a=document.createElement("a");
              a.href=url; a.download="prezzario_conad.json"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            }}>💾 Esporta</button>
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {[["all","Tutti"],["matched","✓ Nel piano"],["unmatched","○ Extra"]].map(([v,l])=>(
              <button key={v} style={{...S.btnG,fontSize:11,padding:"3px 9px",...(priceFilter===v?{background:v==="matched"?"#238636":v==="unmatched"?"#30363d":"#1f6feb",borderColor:"transparent",color:"#fff"}:{})}} onClick={()=>setPriceFilter(v)}>{l}</button>
            ))}
            <span style={{width:1,background:"#30363d",margin:"0 2px"}}/>
            <button style={{...S.btnG,fontSize:11,padding:"3px 9px",...(priceCatFilter==="all"?{background:"#1f6feb",borderColor:"transparent",color:"#fff"}:{})}} onClick={()=>setPriceCatFilter("all")}>Tutte le categorie</button>
            {uniqueCats.map(c=>(
              <button key={c} style={{...S.btnG,fontSize:11,padding:"3px 9px",...(priceCatFilter===c?{background:"#1f6feb",borderColor:"transparent",color:"#fff"}:{})}} onClick={()=>setPriceCatFilter(c)}>{CAT_PRICE_LABELS[c]||c}</button>
            ))}
          </div>
        </div>

        <div style={S.card}>
          {Object.keys(grouped).sort().map(cat=>(
            <div key={cat}>
              <div style={{background:"#21262d",padding:"5px 12px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#58a6ff",borderTop:"1px solid #30363d"}}>{CAT_PRICE_LABELS[cat]||cat} ({grouped[cat].length})</div>
              {grouped[cat].map(p=>{
                const isEditing = priceEditId===p.id;
                if(isEditing) return <PriceEditRow key={p.id} p={p} onSave={patch=>saveEdit(p.id,patch)} onCancel={()=>setPriceEditId(null)}/>;
                return (
                  <div key={p.id} style={{display:"grid",gridTemplateColumns:"14px 1fr 1fr auto auto auto",gap:8,padding:"6px 12px",borderTop:"1px solid #161b22",alignItems:"center",fontSize:12}}>
                    <span style={{width:7,height:7,borderRadius:"50%",background:p.presenteNelPiano?"#2ea043":"#6e7681",display:"inline-block"}}/>
                    <span style={{fontFamily:"monospace",fontSize:11,color:"#8b949e"}}>{p.descrizione}</span>
                    <span style={{fontSize:11,color:p.nomePiano?"#c9d1d9":"#6e7681",fontStyle:p.nomePiano?"normal":"italic"}}>{p.nomePiano||"— non abbinato —"}</span>
                    <span style={{fontFamily:"monospace",fontWeight:700,color:"#d29922",textAlign:"right"}}>€{Number(p.prezzo).toFixed(2)}<span style={{color:"#6e7681",fontWeight:400,fontSize:10}}> {UNIT_PRICE_LABELS[p.unita]}</span></span>
                    <span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:5,background:p.iva==="A"?"rgba(74,222,128,.15)":p.iva==="C"?"rgba(251,191,36,.15)":p.iva==="D"?"rgba(248,113,113,.15)":"rgba(96,165,250,.15)",color:p.iva==="A"?"#4ade80":p.iva==="C"?"#fbbf24":p.iva==="D"?"#f87171":"#60a5fa"}}>{p.iva} {prices.ivaAliquote[p.iva]}%</span>
                    <span style={{display:"flex",gap:3}}>
                      <button style={{background:"none",border:"none",color:"#6e7681",cursor:"pointer",fontSize:13}} onClick={()=>setPriceEditId(p.id)}>✏️</button>
                      <button style={{background:"none",border:"none",color:"#6e7681",cursor:"pointer",fontSize:13}} onClick={()=>deleteProd(p.id)}>🗑️</button>
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
          {filtered.length===0&&<div style={{...S.cardP,textAlign:"center",color:"#6e7681",fontSize:12}}>Nessun prodotto trovato con i filtri attuali.</div>}
        </div>

        {priceModal && <PriceAddModal initialDesc={pendingPriceDesc} onSave={addProd} onCancel={()=>setPriceModal(false)}/>}
      </div>
    );
  };

  // Riga di edit inline per un prodotto prezzo
  const PriceEditRow = ({p,onSave,onCancel}) => {
    const [desc,setDesc]=useState(p.descrizione);
    const [piano,setPiano]=useState(p.nomePiano||"");
    const [prezzo,setPrezzo]=useState(p.prezzo);
    const [unita,setUnita]=useState(p.unita);
    const [iva,setIva]=useState(p.iva);
    const [cat,setCat]=useState(p.categoria);
    const [note,setNote]=useState(p.note||"");
    return (
      <div style={{display:"grid",gridTemplateColumns:"14px 1fr 1fr auto auto auto",gap:8,padding:"6px 12px",borderTop:"1px solid #161b22",alignItems:"center",background:"rgba(88,166,255,.05)"}}>
        <span/>
        <input style={{...S.inp,fontSize:11}} value={desc} onChange={e=>setDesc(e.target.value)}/>
        <input style={{...S.inp,fontSize:11}} value={piano} onChange={e=>setPiano(e.target.value)} placeholder="non abbinato"/>
        <input style={{...S.inp,fontSize:11,width:64,textAlign:"right"}} type="number" step="0.01" value={prezzo} onChange={e=>setPrezzo(e.target.value)}/>
        <select style={{...S.inp,fontSize:10}} value={iva} onChange={e=>setIva(e.target.value)}>
          {Object.keys(prices.ivaAliquote).map(i=><option key={i} value={i}>{i} {prices.ivaAliquote[i]}%</option>)}
        </select>
        <span style={{display:"flex",gap:3}}>
          <button style={{background:"none",border:"none",color:"#2ea043",cursor:"pointer"}} onClick={()=>onSave({descrizione:desc,nomePiano:piano.trim()||null,prezzo:parseFloat(prezzo)||0,unita,iva,categoria:cat,note})}>✅</button>
          <button style={{background:"none",border:"none",color:"#f85149",cursor:"pointer"}} onClick={onCancel}>✕</button>
        </span>
      </div>
    );
  };

  // Modale per aggiunta nuovo prodotto
  const PriceAddModal = ({initialDesc,onSave,onCancel}) => {
    const findIva = (pianoVal) => {
      if(!pianoVal?.trim()) return null;
      const n=norm(pianoVal);
      let m=prices.prodotti.find(p=>p.nomePiano&&norm(p.nomePiano)===n);
      if(!m) m=prices.prodotti.find(p=>p.nomePiano&&(n.includes(norm(p.nomePiano))||norm(p.nomePiano).includes(n)));
      return m?.iva||null;
    };
    const [desc,setDesc]=useState(initialDesc||"");
    const [piano,setPiano]=useState(initialDesc||"");
    const [prezzo,setPrezzo]=useState("");
    const [unita,setUnita]=useState("pezzo");
    const [cat,setCat]=useState("altro");
    const [note,setNote]=useState("");
    const [ivaAuto,setIvaAuto]=useState(()=>!!findIva(initialDesc));
    const [iva,setIva]=useState(()=>findIva(initialDesc)||"A");

    const handlePianoChange = (val) => {
      setPiano(val);
      const found=findIva(val);
      if(found){ setIva(found); setIvaAuto(true); }
      else setIvaAuto(false);
    };

    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:14}} onClick={e=>{if(e.target===e.currentTarget)onCancel();}}>
        <div style={{background:"#161b22",border:"1px solid #30363d",borderRadius:10,padding:18,maxWidth:380,width:"100%"}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:16,color:"#58a6ff",marginBottom:12}}>Nuovo Prodotto Prezzario</div>
          <label style={S.lbl}>Descrizione scontrino *</label>
          <input style={{...S.inp,width:"100%",marginBottom:8}} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="es. ZUCCHINE SCURE"/>
          <label style={S.lbl}>Nome nel piano (opzionale)</label>
          <input style={{...S.inp,width:"100%",marginBottom:8}} value={piano} onChange={e=>handlePianoChange(e.target.value)} placeholder="lascia vuoto se non presente nel piano"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><label style={S.lbl}>Prezzo (€) *</label><input style={{...S.inp,width:"100%"}} type="number" step="0.01" value={prezzo} onChange={e=>setPrezzo(e.target.value)}/></div>
            <div><label style={S.lbl}>Unità</label>
              <select style={{...S.inp,width:"100%"}} value={unita} onChange={e=>setUnita(e.target.value)}>
                <option value="pezzo">al pezzo</option><option value="kg">al kg</option><option value="litro">al litro</option><option value="acquisto">peso variabile</option>
              </select>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div><label style={S.lbl}>Categoria</label>
              <select style={{...S.inp,width:"100%"}} value={cat} onChange={e=>setCat(e.target.value)}>
                {Object.keys(CAT_PRICE_LABELS).map(c=><option key={c} value={c}>{CAT_PRICE_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label style={{...S.lbl,display:"flex",alignItems:"center",gap:5}}>
                IVA
                {ivaAuto&&<span style={{fontSize:9,fontWeight:700,background:"rgba(46,160,67,.18)",color:"#2ea043",borderRadius:4,padding:"1px 5px",letterSpacing:"0.04em"}}>AUTO</span>}
              </label>
              <select style={{...S.inp,width:"100%",...(ivaAuto?{borderColor:"rgba(46,160,67,.5)"}:{})}} value={iva}
                onChange={e=>{ setIva(e.target.value); setIvaAuto(false); }}>
                {Object.keys(prices.ivaAliquote).map(i=><option key={i} value={i}>{i} — {prices.ivaAliquote[i]}%</option>)}
              </select>
            </div>
          </div>
          <label style={S.lbl}>Note</label>
          <textarea style={{...S.inp,width:"100%",minHeight:46,marginBottom:12,resize:"vertical"}} value={note} onChange={e=>setNote(e.target.value)}/>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button style={S.btnG} onClick={onCancel}>Annulla</button>
            <button style={S.btn} onClick={()=>{
              if(!desc.trim()){alert("Descrizione obbligatoria");return;}
              onSave({id:"p_"+Date.now(),descrizione:desc.trim(),nomePiano:piano.trim()||null,categoria:cat,tipoPrezzo:unita==="pezzo"?"confezione":"peso_variabile",prezzo:parseFloat(prezzo)||0,unita,iva,occorrenze:[parseFloat(prezzo)||0],note,presenteNelPiano:!!piano.trim()});
            }}>💾 Salva</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={S.app}>
      <div style={S.hdr}>
        <div style={S.logo}>🥗 <span>Diet Manager</span>{diet&&<span style={{fontSize:11,color:"#6e7681",fontWeight:400}}>· {diet.patient?.name||"Piano"}</span>}</div>
        <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
          {TABS.map(([v,ic,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{...S.btnG,...(view===v?{background:"#1f6feb",borderColor:"#388bfd",color:"#fff"}:{}),padding:"4px 10px",fontSize:12}}>
              {ic} <span style={{marginLeft:3}}>{l}</span>
            </button>
          ))}
          <button style={{...S.btnG,padding:"4px 10px",fontSize:12}} onClick={()=>setView("up")}>+ PDF</button>
          {diet&&<button style={{...S.btnG,padding:"4px 10px",fontSize:12}} onClick={()=>{
            const md=dietToMarkdown(diet);
            const blob=new Blob([md],{type:"text/markdown"});
            const url=URL.createObjectURL(blob);
            const a=document.createElement("a");
            a.href=url; a.download=`piano_${(diet.patient?.name||"dieta").replace(/\s+/g,"_").toLowerCase()}.md`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
          }}>💾 .md</button>}
        </div>
      </div>
      <div style={S.body}>
        {view==="up"&&<UploadV/>}
        {diet&&view==="ov"&&<OvV/>}
        {diet&&view==="cal"&&<CalV/>}
        {diet&&view==="meals"&&<MealsV/>}
        {diet&&view==="shop"&&<ShopV/>}
        {diet&&view==="wt"&&<WtV/>}
        {diet&&view==="supp"&&<SuppV/>}
        {diet&&view==="prices"&&<PricesV/>}
      </div>
      <style>{`button:hover{opacity:.82} input:focus,textarea:focus{border-color:#58a6ff!important} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#30363d;border-radius:4px}`}</style>
    </div>
  );
}
