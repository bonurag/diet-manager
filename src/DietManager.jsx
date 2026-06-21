import { useState, useEffect, useRef, useCallback } from "react";

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
};
const DOW_ACT = {0:"run",1:"tabata",2:"endurance",3:"rest",4:"repetitions",5:"tabata",6:"bike"};

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

// Prezzario Conad — estratto da scontrini reali (31/05/26 + altro)
const DEFAULT_PRICES = {"negozio": "Conad", "ultimoAggiornamento": "2026-05-31", "fonti": [{"data": "2026-05-31", "ora": "11:47", "documento": "DOC.0263-0005", "totale": 155.9}, {"data": "non specificata", "documento": "scontrino 2", "totale": 134.91}], "ivaAliquote": {"A": 4.0, "B": 5.0, "C": 10.0, "D": 22.0}, "legendaIva": {"A": "Aliquota 4% — alimentari di base (frutta, verdura, pane, latte, pasta)", "B": "Aliquota 5% — non osservata in questi scontrini", "C": "Aliquota 10% — alimentari trasformati/conservati", "D": "Aliquota 22% — bevande gassate/zuccherate, prodotti non alimentari"}, "prodotti": [{"id": "zucchine", "descrizione": "ZUCCHINE SCURE", "nomePiano": "Zucchine", "categoria": "frutta_verdura", "tipoPrezzo": "peso_variabile", "prezzo": 2.36, "unita": "acquisto", "iva": "A", "occorrenze": [2.41, 2.31], "note": "Prezzo variabile in base al peso pesato in cassa. Media tra 2 acquisti.", "presenteNelPiano": true}, {"id": "carote", "descrizione": "CAROTE", "nomePiano": "Carote", "categoria": "frutta_verdura", "tipoPrezzo": "peso_variabile", "prezzo": 1.11, "unita": "acquisto", "iva": "A", "occorrenze": [1.53, 0.68], "note": "Prezzo variabile in base al peso. Forte variazione tra i 2 acquisti (peso diverso).", "presenteNelPiano": true}, {"id": "pomodori", "descrizione": "POMODORO GRAPPOLO", "nomePiano": "Pomodori freschi", "categoria": "frutta_verdura", "tipoPrezzo": "peso_variabile", "prezzo": 2.11, "unita": "acquisto", "iva": "A", "occorrenze": [2.11], "note": "Pomodoro a grappolo", "presenteNelPiano": true}, {"id": "mele", "descrizione": "MELE GRANNY 75-80", "nomePiano": "Mele", "categoria": "frutta_verdura", "tipoPrezzo": "peso_variabile", "prezzo": 1.99, "unita": "acquisto", "iva": "A", "occorrenze": [1.99, 1.99], "note": "Varietà Granny Smith calibro 75-80", "presenteNelPiano": true}, {"id": "pesche", "descrizione": "PESCHE NOCI", "nomePiano": "Pesche", "categoria": "frutta_verdura", "tipoPrezzo": "peso_variabile", "prezzo": 3.74, "unita": "acquisto", "iva": "A", "occorrenze": [3.49, 3.98], "note": "Pesche noci", "presenteNelPiano": true}, {"id": "kiwi", "descrizione": "KIWI ESTERI / HAYWARD", "nomePiano": "Kiwi", "categoria": "frutta_verdura", "tipoPrezzo": "peso_variabile", "prezzo": 1.51, "unita": "acquisto", "iva": "A", "occorrenze": [2.43, 0.58], "note": "Forte variazione: probabilmente quantità diverse acquistate", "presenteNelPiano": true}, {"id": "albicocche", "descrizione": "ALBICOCCHE", "nomePiano": "Albicocche", "categoria": "frutta_verdura", "tipoPrezzo": "peso_variabile", "prezzo": 1.0, "unita": "acquisto", "iva": "A", "occorrenze": [1.0], "note": "", "presenteNelPiano": true}, {"id": "prugne", "descrizione": "SUSINE ROSSE", "nomePiano": "Prugne / susine", "categoria": "frutta_verdura", "tipoPrezzo": "peso_variabile", "prezzo": 1.21, "unita": "acquisto", "iva": "A", "occorrenze": [1.44, 0.97], "note": "", "presenteNelPiano": true}, {"id": "banana", "descrizione": "BANANE CPQ", "nomePiano": "Banane", "categoria": "frutta_verdura", "tipoPrezzo": "peso_variabile", "prezzo": 1.1, "unita": "acquisto", "iva": "A", "occorrenze": [1.1], "note": "cpq = confezione pre-pesata", "presenteNelPiano": true}, {"id": "patate", "descrizione": "PATATE", "nomePiano": "Patate", "categoria": "frutta_verdura", "tipoPrezzo": "peso_variabile", "prezzo": 1.09, "unita": "acquisto", "iva": "A", "occorrenze": [1.09], "note": "", "presenteNelPiano": true}, {"id": "rucola", "descrizione": "RUCOLA cpq 70-125gr", "nomePiano": "Rucola", "categoria": "frutta_verdura", "tipoPrezzo": "confezione", "prezzo": 0.89, "unita": "pezzo", "iva": "A", "occorrenze": [1.39, 0.89, 0.89], "note": "Formato 70gr a 0.89€, formato 125gr a 1.39€. Prezzo di riferimento: 70gr.", "presenteNelPiano": true}, {"id": "lattuga_iceberg", "descrizione": "ICEBERG JULIENNE 500", "nomePiano": "Lattuga iceberg", "categoria": "frutta_verdura", "tipoPrezzo": "confezione", "prezzo": 2.49, "unita": "pezzo", "iva": "A", "occorrenze": [2.49], "note": "Busta 500g già tagliata julienne", "presenteNelPiano": true}, {"id": "valerianella", "descrizione": "VALERIANA cpq 125gr", "nomePiano": "Valerianella", "categoria": "frutta_verdura", "tipoPrezzo": "confezione", "prezzo": 1.49, "unita": "pezzo", "iva": "A", "occorrenze": [1.49], "note": "Confezione 125g", "presenteNelPiano": true}, {"id": "spinaci", "descrizione": "SPINACI SOFFICI / FOGLIA VERDE", "nomePiano": "Spinaci al vapore", "categoria": "frutta_verdura", "tipoPrezzo": "confezione", "prezzo": 1.99, "unita": "pezzo", "iva": "A", "occorrenze": [1.99, 1.99], "note": "Surgelati, busta singola", "presenteNelPiano": true}, {"id": "fagiolini", "descrizione": "FAGIOLINI E PATATE B", "nomePiano": "Fagiolini", "categoria": "frutta_verdura", "tipoPrezzo": "confezione", "prezzo": 1.39, "unita": "pezzo", "iva": "A", "occorrenze": [2.19], "note": "Prezzo netto dopo sconto -0.80 (2.19-0.80=1.39). Surgelati misti fagiolini+patate.", "presenteNelPiano": true}, {"id": "noci", "descrizione": "NOCI SGUSC.CONAD CAL", "nomePiano": "Noci", "categoria": "frutta_secca", "tipoPrezzo": "confezione", "prezzo": 5.25, "unita": "pezzo", "iva": "A", "occorrenze": [5.25], "note": "Formato grande, calibrate, sgusciate", "presenteNelPiano": true}, {"id": "actimel", "descrizione": "ACTIMEL IMMUNO PLUS / ACTIMEL+ FRAGOLA", "nomePiano": "Yogurt con fermenti (Actimel)", "categoria": "latticini", "tipoPrezzo": "confezione", "prezzo": 3.59, "unita": "pezzo", "iva": "C", "occorrenze": [3.59, 3.59], "note": "Confezione multipack (8 flaconcini circa)", "presenteNelPiano": true}, {"id": "fiocchi_latte", "descrizione": "FIOCCHI DI LATTE PIA", "nomePiano": "Fiocchi di latte", "categoria": "latticini", "tipoPrezzo": "confezione", "prezzo": 1.35, "unita": "pezzo", "iva": "A", "occorrenze": [1.35], "note": "Prezzo netto con promo 2x1 (pagato 1 su 2 acquistati)", "presenteNelPiano": true}, {"id": "yogurt_total0", "descrizione": "YOG.TOT 0% BIANCO", "nomePiano": "Yogurt scremato bianco / Yogurt greco scr. bianco", "categoria": "latticini", "tipoPrezzo": "confezione", "prezzo": 2.72, "unita": "pezzo", "iva": "C", "occorrenze": [3.89, 1.55], "note": "Formato grande 3.89€, formato singolo 1.55€", "presenteNelPiano": true}, {"id": "mozzarella_proteica", "descrizione": "MOZZARELLA PROTEICA", "nomePiano": "Mozzarella proteica (Granarolo Benessere)", "categoria": "latticini", "tipoPrezzo": "confezione", "prezzo": 1.39, "unita": "pezzo", "iva": "A", "occorrenze": [1.39, 1.39], "note": "Prezzo costante in entrambi gli scontrini", "presenteNelPiano": true}, {"id": "philadelphia_yog", "descrizione": "PHILADELPHIA C/YOGURT", "nomePiano": "Philadelphia (variante)", "categoria": "latticini", "tipoPrezzo": "confezione", "prezzo": 1.79, "unita": "pezzo", "iva": "A", "occorrenze": [2.09], "note": "Prezzo netto dopo sconto -0.30", "presenteNelPiano": true}, {"id": "philadelphia_no_lattosio", "descrizione": "PHILADELPHIA SENZA LATTOSIO", "nomePiano": "Philadelphia (variante senza lattosio)", "categoria": "latticini", "tipoPrezzo": "confezione", "prezzo": 1.79, "unita": "pezzo", "iva": "A", "occorrenze": [2.35], "note": "Prezzo netto dopo sconto -0.56", "presenteNelPiano": true}, {"id": "philadelphia_protein", "descrizione": "PHILADELPHIA PROTEIN", "nomePiano": "Philadelphia Protein", "categoria": "latticini", "tipoPrezzo": "confezione", "prezzo": 3.58, "unita": "pezzo", "iva": "A", "occorrenze": [4.3], "note": "MATCH ESATTO col piano. Prezzo netto dopo sconto -0.72 (4.30-0.72=3.58)", "presenteNelPiano": true}, {"id": "latte_ps", "descrizione": "LAT.UHT PS AD C.LR B", "nomePiano": "Latte parzialmente scremato", "categoria": "latticini", "tipoPrezzo": "confezione", "prezzo": 1.19, "unita": "pezzo", "iva": "A", "occorrenze": [1.19, 1.19], "note": "Prezzo costante in entrambi gli scontrini. Probabile formato 1L.", "presenteNelPiano": true}, {"id": "ricotta_light", "descrizione": "RICOTTA LIGHT PIACERI", "nomePiano": "Ricotta light", "categoria": "latticini", "tipoPrezzo": "confezione", "prezzo": 1.29, "unita": "pezzo", "iva": "A", "occorrenze": [2.58], "note": "Prezzo netto con promo 2x1 (2.58-1.29=1.29)", "presenteNelPiano": true}, {"id": "hipro_drink", "descrizione": "HIPRO DRINK VANIGLIA/STRACCIATELLA", "nomePiano": "High Protein Drink (sostituto Ehrmann)", "categoria": "latticini", "tipoPrezzo": "confezione", "prezzo": 1.74, "unita": "pezzo", "iva": "C", "occorrenze": [1.49, 2.19], "note": "Marca Hipro al posto di Ehrmann citato nel piano. Prezzo netto dopo sconto fornitore.", "presenteNelPiano": true}, {"id": "hipro_mirtillo", "descrizione": "HIPRO MIRTILLO 160g", "nomePiano": "Dessert proteico (variante mirtillo)", "categoria": "latticini", "tipoPrezzo": "confezione", "prezzo": 0.99, "unita": "pezzo", "iva": "C", "occorrenze": [1.49], "note": "Prezzo netto dopo sconto -0.50", "presenteNelPiano": true}, {"id": "salmone_affumicato", "descrizione": "SALMONE AFF.CONVENIENZA", "nomePiano": "Salmone affumicato", "categoria": "carne_pesce", "tipoPrezzo": "confezione", "prezzo": 6.99, "unita": "pezzo", "iva": "C", "occorrenze": [9.69], "note": "Prezzo netto dopo sconto -2.70 (9.69-2.70=6.99)", "presenteNelPiano": true}, {"id": "hamburger_manzo", "descrizione": "HAMBURGER SCOTTONA S", "nomePiano": "Hamburger di manzo", "categoria": "carne_pesce", "tipoPrezzo": "confezione", "prezzo": 4.4, "unita": "pezzo", "iva": "C", "occorrenze": [4.4], "note": "Carne di scottona", "presenteNelPiano": true}, {"id": "pollo_petto", "descrizione": "PETTO DI POLLO A FETTE", "nomePiano": "Petto di pollo", "categoria": "carne_pesce", "tipoPrezzo": "confezione", "prezzo": 3.15, "unita": "pezzo", "iva": "C", "occorrenze": [3.15], "note": "Vassoio a fette, banco macelleria", "presenteNelPiano": true}, {"id": "salmone_filetti", "descrizione": "SALMONE FETTE NORVEGESE / FILETTO FRESCO", "nomePiano": "Salmone (filetti)", "categoria": "carne_pesce", "tipoPrezzo": "confezione", "prezzo": 3.27, "unita": "pezzo", "iva": "C", "occorrenze": [3.29, 3.25], "note": "Filetti freschi norvegesi", "presenteNelPiano": true}, {"id": "orata_filetti", "descrizione": "FILETTI DI ORATA EST", "nomePiano": "Orata (filetti)", "categoria": "carne_pesce", "tipoPrezzo": "confezione", "prezzo": 4.69, "unita": "pezzo", "iva": "C", "occorrenze": [4.69], "note": "MATCH ESATTO col piano", "presenteNelPiano": true}, {"id": "manzo_inglese", "descrizione": "MANZO ALL'INGLESE", "nomePiano": "Manzo magro (fesa/roast beef)", "categoria": "carne_pesce", "tipoPrezzo": "confezione", "prezzo": 3.84, "unita": "pezzo", "iva": "C", "occorrenze": [3.65, 4.02], "note": "Roast beef pronto - molto simile al \"manzo magro\" del piano", "presenteNelPiano": true}, {"id": "tonno_naturale", "descrizione": "TONNO VERONATURALE M", "nomePiano": "Tonno al naturale", "categoria": "carne_pesce", "tipoPrezzo": "confezione", "prezzo": 5.39, "unita": "pezzo", "iva": "C", "occorrenze": [8.69], "note": "MATCH ESATTO col piano. Confezione multipack, prezzo netto dopo sconto -3.30", "presenteNelPiano": true}, {"id": "merluzzo_gratin", "descrizione": "FIL.MERL.GRAT.MELANZANE/ERBE", "nomePiano": "Filetti merluzzo gratin patate Findus", "categoria": "carne_pesce", "tipoPrezzo": "confezione", "prezzo": 2.99, "unita": "pezzo", "iva": "C", "occorrenze": [5.99, 5.99], "note": "Varianti diverse da quella citata nel piano (patate+rosmarino) ma stesso tipo di prodotto surgelato. Prezzo netto dopo sconto -3.00 cad.", "presenteNelPiano": true}, {"id": "pane_tramezzino", "descrizione": "PANE PER TRAMEZZINO", "nomePiano": "Pane a fette / pane integrale", "categoria": "cereali_pane", "tipoPrezzo": "confezione", "prezzo": 1.59, "unita": "pezzo", "iva": "A", "occorrenze": [1.59], "note": "Non integrale - verificare se necessaria versione integrale", "presenteNelPiano": true}, {"id": "pane_forno", "descrizione": "FORNO TRADIZIONALE (pane)", "nomePiano": "Pane integrale fresco / Pane di frumento", "categoria": "cereali_pane", "tipoPrezzo": "peso_variabile", "prezzo": 0.87, "unita": "acquisto", "iva": "C", "occorrenze": [1.11, 0.64, 0.85], "note": "Banco forno, peso variabile in base al pezzo scelto", "presenteNelPiano": true}, {"id": "riso_carnaroli", "descrizione": "RISO CARNAROLI CURTI", "nomePiano": "Riso (generico)", "categoria": "cereali_pane", "tipoPrezzo": "confezione", "prezzo": 4.79, "unita": "pezzo", "iva": "A", "occorrenze": [4.79], "note": "Riso Carnaroli premium - più caro del riso standard del piano", "presenteNelPiano": true}, {"id": "riso_gallo", "descrizione": "RISO GALLO BLONDXINS", "nomePiano": "Riso integrale (possibile)", "categoria": "cereali_pane", "tipoPrezzo": "confezione", "prezzo": 1.89, "unita": "pezzo", "iva": "A", "occorrenze": [3.15], "note": "Prezzo netto dopo sconto -1.26. Verificare se integrale o bianco.", "presenteNelPiano": true}, {"id": "biscotti_saiwa", "descrizione": "BISC.SAIWA ORO 5 CEREALI", "nomePiano": "Biscotti secchi integrali (sostituto)", "categoria": "cereali_pane", "tipoPrezzo": "confezione", "prezzo": 2.29, "unita": "pezzo", "iva": "C", "occorrenze": [2.29], "note": "Non sono biscotti integrali puri - 5 cereali misti", "presenteNelPiano": true}, {"id": "ceci_vaso", "descrizione": "CECI VASO VETRO CONAD", "nomePiano": "Ceci in scatola", "categoria": "legumi_conserve", "tipoPrezzo": "confezione", "prezzo": 0.89, "unita": "pezzo", "iva": "C", "occorrenze": [1.78], "note": "Prezzo per singolo vaso (1.78 era per 2 pezzi)", "presenteNelPiano": true}, {"id": "passata_pomodoro", "descrizione": "PASSATA POM.BIO VERS", "nomePiano": "Pomodori (passata)", "categoria": "legumi_conserve", "tipoPrezzo": "confezione", "prezzo": 1.0, "unita": "pezzo", "iva": "A", "occorrenze": [1.45], "note": "Prezzo netto dopo sconto -0.45", "presenteNelPiano": true}, {"id": "pelati", "descrizione": "PELATI CIRIO", "nomePiano": "Pomodori pelati", "categoria": "legumi_conserve", "tipoPrezzo": "confezione", "prezzo": 0.99, "unita": "pezzo", "iva": "A", "occorrenze": [1.29], "note": "Prezzo netto dopo sconto -0.30", "presenteNelPiano": true}, {"id": "ragu_carne", "descrizione": "RAGU STAR CARNE LATTE", "nomePiano": "Ragù di carne fresco", "categoria": "legumi_conserve", "tipoPrezzo": "confezione", "prezzo": 2.23, "unita": "pezzo", "iva": "C", "occorrenze": [2.99], "note": "Ragù pronto in vasetto, non fresco da banco come nel piano. Prezzo netto dopo sconto -0.76", "presenteNelPiano": true}, {"id": "olive_verdi", "descrizione": "OLIVE VERDI DEN.CONAD", "nomePiano": "Olive verdi", "categoria": "condimenti", "tipoPrezzo": "confezione", "prezzo": 1.59, "unita": "pezzo", "iva": "C", "occorrenze": [4.77], "note": "Prezzo per singolo vasetto (4.77 era per 3 pezzi)", "presenteNelPiano": true}, {"id": "miele", "descrizione": "MIELE AMBROSOLI MILLEFIORI", "nomePiano": "Miele", "categoria": "condimenti", "tipoPrezzo": "confezione", "prezzo": 3.85, "unita": "pezzo", "iva": "C", "occorrenze": [3.85], "note": "", "presenteNelPiano": true}, {"id": "ketchup", "descrizione": "KETCHUP MULTIPACK CONAD", "nomePiano": "Salsa ketchup", "categoria": "condimenti", "tipoPrezzo": "confezione", "prezzo": 0.99, "unita": "pezzo", "iva": "C", "occorrenze": [0.99], "note": "", "presenteNelPiano": true}, {"id": "cioccolato_85", "descrizione": "TAV.EXCELL.85%CACAO", "nomePiano": "Cioccolato fondente 80% (variante 85%)", "categoria": "altro", "tipoPrezzo": "confezione", "prezzo": 3.29, "unita": "pezzo", "iva": "C", "occorrenze": [3.69], "note": "85% invece di 80% indicato nel piano. Prezzo netto dopo sconto -0.40", "presenteNelPiano": true}, {"id": "cioccolato_78", "descrizione": "TAV.EXCELL.78%CACAO", "nomePiano": "Cioccolato fondente 80% (variante 78%)", "categoria": "altro", "tipoPrezzo": "confezione", "prezzo": 3.29, "unita": "pezzo", "iva": "C", "occorrenze": [7.38], "note": "78% invece di 80% indicato nel piano. Prezzo netto per singola tavoletta dopo sconto (7.38-0.80)/2", "presenteNelPiano": true}, {"id": "succo_arancia", "descrizione": "SUCCO S/ZUC.AGG.ARANCIA", "nomePiano": "Succo arancia rossa 100%", "categoria": "altro", "tipoPrezzo": "confezione", "prezzo": 1.89, "unita": "pezzo", "iva": "D", "occorrenze": [1.89], "note": "Senza zuccheri aggiunti - molto simile alla richiesta del piano", "presenteNelPiano": true}, {"id": "pizza_verdure", "descrizione": "PIZZA LASAPORITA VERDURE", "nomePiano": "Pizza vegetariana surgelata", "categoria": "altro", "tipoPrezzo": "confezione", "prezzo": 2.69, "unita": "pezzo", "iva": "C", "occorrenze": [2.69], "note": "MATCH ESATTO col piano", "presenteNelPiano": true}, {"id": "frulla_mela", "descrizione": "FRULLA' BIO MELA DOY", "categoria": "altro", "prezzo": 0.98, "unita": "pezzo", "iva": "C", "occorrenze": [0.98, 0.98, 0.98], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "ciliegie", "descrizione": "CILIEGIA ITA CPQ 2", "categoria": "frutta_verdura", "prezzo": 1.49, "unita": "acquisto", "iva": "A", "occorrenze": [1.49, 1.49], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "peso_variabile", "note": ""}, {"id": "ananas", "descrizione": "ANANAS", "categoria": "frutta_verdura", "prezzo": 1.77, "unita": "acquisto", "iva": "A", "occorrenze": [1.77], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "peso_variabile", "note": ""}, {"id": "cetrioli", "descrizione": "CETRIOLI", "categoria": "frutta_verdura", "prezzo": 0.54, "unita": "acquisto", "iva": "A", "occorrenze": [0.54], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "peso_variabile", "note": ""}, {"id": "semi_chia", "descrizione": "SEMI DI CHIA NERA", "categoria": "condimenti", "prezzo": 2.69, "unita": "pezzo", "iva": "C", "occorrenze": [2.69], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "prosciutto_cotto", "descrizione": "PROSC.COTTO A.Q.F&C", "categoria": "carne_pesce", "prezzo": 1.79, "unita": "pezzo", "iva": "C", "occorrenze": [1.79], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "piadina_olio", "descrizione": "PIADINA FRESCA OLIO", "categoria": "cereali_pane", "prezzo": 1.99, "unita": "pezzo", "iva": "A", "occorrenze": [1.99], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "mortadella", "descrizione": "MORTADELLA IGP FIRMA", "categoria": "carne_pesce", "prezzo": 2.72, "unita": "pezzo", "iva": "C", "occorrenze": [4.98], "note": "netto dopo sconto -2.26", "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione"}, {"id": "pasta_brisee", "descrizione": "PASTA BRISEE CONAD", "categoria": "altro", "prezzo": 1.15, "unita": "pezzo", "iva": "C", "occorrenze": [1.15], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "pasta_pizza", "descrizione": "PASTA PER PIZZA", "categoria": "altro", "prezzo": 1.49, "unita": "pezzo", "iva": "C", "occorrenze": [1.49], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "pasta_sfoglia_rett", "descrizione": "PASTA SFOGLIA RETTANGOLARE", "categoria": "altro", "prezzo": 1.15, "unita": "pezzo", "iva": "C", "occorrenze": [1.15], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "pasta_sfoglia_rot", "descrizione": "PASTA SFOGLIA ROTONDA", "categoria": "altro", "prezzo": 1.15, "unita": "pezzo", "iva": "C", "occorrenze": [1.15], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "fioc_fond", "descrizione": "FIOC.FR.INT.FOND.PIA", "categoria": "altro", "prezzo": 2.59, "unita": "pezzo", "iva": "C", "occorrenze": [2.59], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "cavallo_sfilacci", "descrizione": "CAVALLO SFILACCI X1", "categoria": "carne_pesce", "prezzo": 4.8, "unita": "pezzo", "iva": "C", "occorrenze": [4.8, 4.8], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "mozzarella_grande", "descrizione": "MOZZARELLA P", "categoria": "latticini", "prezzo": 3.19, "unita": "pezzo", "iva": "A", "occorrenze": [3.19], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "mayo", "descrizione": "MAYO TD HEINZ 395g", "categoria": "condimenti", "prezzo": 1.99, "unita": "pezzo", "iva": "C", "occorrenze": [3.19], "note": "netto dopo sconto -1.20", "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione"}, {"id": "patatine", "descrizione": "PATATINE CLASSICHE S", "categoria": "altro", "prezzo": 4.19, "unita": "pezzo", "iva": "C", "occorrenze": [4.19], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "cetrioli_sacla", "descrizione": "CETRIOLI SACLA 290g", "categoria": "condimenti", "prezzo": 1.79, "unita": "pezzo", "iva": "C", "occorrenze": [1.79], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "cipolline_aceto", "descrizione": "CIPOLLINE ACETO CONAD", "categoria": "condimenti", "prezzo": 0.99, "unita": "pezzo", "iva": "C", "occorrenze": [0.99], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "pomodori_secchi", "descrizione": "POMODORI SECCHI OLIO", "categoria": "condimenti", "prezzo": 2.39, "unita": "pezzo", "iva": "C", "occorrenze": [2.39], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "taralli", "descrizione": "TARALLI FINOCCHIO", "categoria": "altro", "prezzo": 1.59, "unita": "pezzo", "iva": "C", "occorrenze": [1.59], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "estathe_limone", "descrizione": "ESTATHE BOTT.LIMONE/PET", "categoria": "bevande", "prezzo": 1.69, "unita": "pezzo", "iva": "D", "occorrenze": [1.99, 1.99], "note": "netto dopo sconti", "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione"}, {"id": "coca_cola", "descrizione": "COCA COLA REGULAR/ZERO", "categoria": "bevande", "prezzo": 2.29, "unita": "pezzo", "iva": "D", "occorrenze": [2.29, 3.89], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "taccole", "descrizione": "TACCOLE BONDUELLE", "categoria": "frutta_verdura", "prezzo": 1.89, "unita": "pezzo", "iva": "A", "occorrenze": [1.89], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "edamer", "descrizione": "EDAMER A FETTE BAYER", "categoria": "latticini", "prezzo": 2.15, "unita": "pezzo", "iva": "A", "occorrenze": [2.14, 2.16], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "fatina_mandorle", "descrizione": "FATINA MAND.TOST.NO", "categoria": "altro", "prezzo": 2.79, "unita": "pezzo", "iva": "C", "occorrenze": [2.79], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "frulla_mela_fragola", "descrizione": "FRULLA'BIO MELA-FRAGOLA", "categoria": "altro", "prezzo": 0.98, "unita": "pezzo", "iva": "C", "occorrenze": [0.98, 0.98], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "yog_vipiteno", "descrizione": "YOG.VIPITENO MAGRO", "categoria": "latticini", "prezzo": 0.89, "unita": "pezzo", "iva": "C", "occorrenze": [0.89], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "mozzarella_no_lattosio", "descrizione": "MOZZARELLA SENZA LATTOSIO", "categoria": "latticini", "prezzo": 1.19, "unita": "pezzo", "iva": "A", "occorrenze": [1.45], "note": "netto dopo sconto -0.26", "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione"}, {"id": "nutella", "descrizione": "NUTELLA COPPETTA X6", "categoria": "altro", "prezzo": 1.69, "unita": "pezzo", "iva": "C", "occorrenze": [1.69], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "piadina_snack", "descrizione": "PIADINA SNACK CLASSICA", "categoria": "altro", "prezzo": 1.59, "unita": "pezzo", "iva": "A", "occorrenze": [2.29], "note": "netto dopo sconto -0.70", "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione"}, {"id": "candeggina", "descrizione": "CAND CONAD PROFUMATA", "categoria": "non_alimentare", "prezzo": 1.69, "unita": "pezzo", "iva": "D", "occorrenze": [1.69], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "sale_lavastoviglie", "descrizione": "SALE PER LAVASTOVIGLIE", "categoria": "non_alimentare", "prezzo": 1.39, "unita": "pezzo", "iva": "D", "occorrenze": [1.39], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "pizza_prosciutto", "descrizione": "PIZZA LASAPORITA PROSCIUTTO", "categoria": "altro", "prezzo": 2.69, "unita": "pezzo", "iva": "C", "occorrenze": [2.69], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "tris_grigliato", "descrizione": "TRIS GRIGLIATO + GUSTO", "categoria": "frutta_verdura", "prezzo": 2.49, "unita": "pezzo", "iva": "C", "occorrenze": [2.49], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "gnocchetti_sorrentina", "descrizione": "GNOCCHETTI ALLA SORRENTINA", "categoria": "altro", "prezzo": 3.99, "unita": "pezzo", "iva": "C", "occorrenze": [3.99], "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "confezione", "note": ""}, {"id": "banco_tradizionale", "descrizione": "BANCO TRADIZIONALE (generico)", "categoria": "altro", "prezzo": 3.45, "unita": "acquisto", "iva": "C", "occorrenze": [3.1, 4.16], "note": "Voce generica banco gastronomia/macelleria, non specifica", "presenteNelPiano": false, "nomePiano": null, "tipoPrezzo": "peso_variabile"}]};

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
  btnG:{ background:"transparent",border:"1px solid #30363d",borderRadius:6,padding:"5px 9px",fontSize:12,fontWeight:600,color:"#8b949e",cursor:"pointer" },
  inp:{ background:"#0d1117",border:"1px solid #30363d",borderRadius:6,padding:"6px 9px",fontSize:12,color:"#c9d1d9",outline:"none" },
  lbl:{ fontSize:10,color:"#6e7681",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:3 },
  row:{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" },
  muted:{ color:"#6e7681" },
  cg:{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2 },
  cdow:{ textAlign:"center",fontSize:10,fontWeight:700,color:"#6e7681",padding:"3px 0" },
  dc:{ aspectRatio:"1",borderRadius:4,border:"1px solid #21262d",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,padding:2,transition:"all .12s" },
  dcE:{ border:"none",background:"transparent",cursor:"default",aspectRatio:"1" },
  mc:{ background:"#0d1117",border:"1px solid #21262d",borderRadius:6,marginBottom:6,overflow:"hidden" },
  mh:{ padding:"5px 10px",background:"#161b22",display:"flex",justifyContent:"space-between",alignItems:"center" },
  fi:{ display:"grid",gridTemplateColumns:"1fr auto auto",gap:8,padding:"5px 10px",borderBottom:"1px solid #161b22",fontSize:12,alignItems:"center" },
  si:{ display:"grid",gridTemplateColumns:"20px 1fr auto auto",gap:6,padding:"5px 10px",borderBottom:"1px solid #161b22",cursor:"pointer",alignItems:"center",fontSize:12 },
  cb:{ width:15,height:15,borderRadius:3,border:"1.5px solid #30363d",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,flexShrink:0 },
  dz:{ border:"2px dashed #30363d",borderRadius:10,padding:"32px 20px",textAlign:"center",cursor:"pointer",transition:"all .2s" },
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
  const openPriceQuickAdd = (foodName) => { setPendingPriceDesc(foodName); setView("prices"); setPriceModal(true); };
  const fileRef = useRef();
  const toggleExcl = k => setExcl(p=>{ const n={...p}; n[k]?delete n[k]:n[k]=true; return n; });
  const exclInRange = (from,to) => { const cur=new Date(from),res=[]; while(cur<=to){const d=dk(cur);if(excl[d])res.push(d);cur.setDate(cur.getDate()+1);} return res; };

  // Load persisted data
  useEffect(() => {
    (async () => {
      const d  = await store.get("dm-diet");  if(d)  setDiet(d);
      const c  = await store.get("dm-cal");   if(c)  setCal(c);
      const w  = await store.get("dm-wts");   if(w)  setWts(w);
      const p  = await store.get("dm-plan");  if(p)  { setPlanS(p.s||""); setPlanE(p.e||""); }
      const n  = await store.get("dm-notes"); if(n)  setNotes(n);
      const v  = await store.get("dm-view");  if(v&&d) setView(v);
      const pr = await store.get("dm-prices"); if(pr) setPrices(pr);
    })();
  }, []);

  useEffect(() => { if(diet) store.set("dm-diet", diet); }, [diet]);
  useEffect(() => { store.set("dm-cal",  cal);   }, [cal]);
  useEffect(() => { store.set("dm-wts",  wts);   }, [wts]);
  useEffect(() => { store.set("dm-plan", {s:planS,e:planE}); }, [planS,planE]);
  useEffect(() => { store.set("dm-notes",notes); }, [notes]);
  useEffect(() => { if(view!=="up") store.set("dm-view",view); }, [view]);
  useEffect(() => { store.set("dm-prices", prices); }, [prices]);

  // Parse PDF with Claude AI
  const parsePDF = useCallback(async (file) => {
    setLoading(true); setLmsg("Lettura file PDF...");
    try {
      const b64 = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(file); });
      setLmsg("Analisi AI in corso — può richiedere 30-60 secondi...");
      const resp = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{
          "Content-Type":"application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body:JSON.stringify({ model:MODEL, max_tokens:8000,
          messages:[{role:"user",content:[
            {type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},
            {type:"text",text:`Analizza questo piano alimentare PDF. Restituisci SOLO JSON valido, nessun testo extra, nessun markdown.
Struttura esatta:
{"patient":{"name":"","weight":0,"targetWeight":0,"bmi":0,"bmr":0,"fat":0,"ffm":0},"period":{"startDate":"YYYY-MM-DD","checkupDate":"YYYY-MM-DD","checkupTime":"HH:MM"},"avgKcal":0,"macros":{"protein":0,"carbs":0,"fats":0},"days":[{"n":1,"activity":"","activityType":"tabata","kcal":0,"macros":{"prot":0,"carb":0,"fat":0},"meals":[{"name":"Colazione","icon":"☀️","foods":[{"name":"","qty":"","kcal":0,"isSupplement":false}]}],"condiments":{"olioG":0,"parmG":0},"supplements":[]}]}
Regole: estrai tutti i giorni; isSupplement=true per whey/proteine/creatina/gel/barrette sportive; activityType: tabata=TABATA/cyclette, endurance=corsa endurance, rest=riposo, repetitions=ripetute, bike=bici/BDC, run=lungo run. Solo JSON.`}
          ]}]
        })
      });
      if(!resp.ok){ const t=await resp.text(); throw new Error(`API ${resp.status}: ${t.substring(0,120)}`); }
      const data = await resp.json();
      const txt = data.content?.find(c=>c.type==="text")?.text||"";
      const clean = txt.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();
      const parsed = JSON.parse(clean);
      setDiet(parsed);
      if(parsed.period?.startDate) setPlanS(parsed.period.startDate);
      if(parsed.period?.checkupDate) setPlanE(parsed.period.checkupDate);
      setLmsg("✓ Piano caricato!");
      setTimeout(()=>{ setLoading(false); setView("ov"); },500);
    } catch(err){
      console.error(err);
      setLmsg("❌ Errore: "+err.message);
      setTimeout(()=>setLoading(false),4000);
    }
  },[]);

  // Generate calendar automatically
  const genCal = useCallback(()=>{
    if(!diet||!planS) return;
    const start=pd(planS), end=planE?pd(planE):new Date(pd(planS).getTime()+77*864e5);
    const byType={}; diet.days?.forEach(d=>{ const t=d.activityType||"rest"; if(!byType[t]) byType[t]=[]; byType[t].push(d.n); });
    const nc={}, ri={}, cur=new Date(start);
    while(cur<=end){
      const act=DOW_ACT[cur.getDay()]||"rest";
      const pool=byType[act]||byType["rest"]||[];
      if(pool.length){ nc[dk(cur)]=pool[(ri[act]||0)%pool.length]; ri[act]=(ri[act]||0)+1; }
      cur.setDate(cur.getDate()+1);
    }
    setCal(nc);
  },[diet,planS,planE]);

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
          if(day.condiments?.olioG){
            if(!items["__olio"]) items["__olio"]={name:"Olio EVO",qty:"",kcal:0,isSup:false,count:0,totalG:0};
            items["__olio"].totalG=(items["__olio"].totalG||0)+day.condiments.olioG;
            items["__olio"].qty=items["__olio"].totalG+"g tot."; items["__olio"].count++;
          }
          if(day.condiments?.parmG){
            if(!items["__parm"]) items["__parm"]={name:"Parmigiano grattugiato",qty:"",kcal:0,isSup:false,count:0,totalG:0};
            items["__parm"].totalG=(items["__parm"].totalG||0)+day.condiments.parmG;
            items["__parm"].qty=items["__parm"].totalG+"g tot."; items["__parm"].count++;
          }
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

  const reset = ()=>{ setDiet(null);setCal({});setWts([]);setNotes({});setView("up"); ["dm-diet","dm-cal","dm-wts","dm-plan","dm-notes","dm-view"].forEach(k=>store.del(k)); };

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
            {diet.days?.map(d=>{ const a=ACTS[d.activityType]||ACTS.rest; return (
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
    const startDow=new Date(y,m,1).getDay();
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
              {manDay&&<span style={{color:"#fb923c",fontWeight:700,fontSize:12,background:"rgba(251,146,60,.1)",border:"1px solid rgba(251,146,60,.3)",borderRadius:6,padding:"3px 8px"}}>G.{manDay} → clicca giorno <button style={{...S.btnG,padding:"0 5px",fontSize:10,marginLeft:4}} onClick={()=>setManDay(null)}>✕</button></span>}
            </div>
          </div>
          {/* Assign buttons */}
          <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:10}}>
            <span style={{...S.muted,fontSize:10,alignSelf:"center"}}>Assegna manualmente:</span>
            {diet?.days?.map(d=>{ const a=ACTS[d.activityType]||ACTS.rest; return (
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
              const a=dayD?(ACTS[dayD.activityType]||ACTS.rest):null;
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
    const act=day?(ACTS[day.activityType]||ACTS.rest):null;
    return (
      <div>
        <div style={{...S.card,...S.cardP}}>
          <div style={S.row}>
            <div><label style={S.lbl}>Data</label><input type="date" style={S.inp} value={ld} onChange={e=>{setLd(e.target.value);setSelDt(pd(e.target.value));}}/></div>
            {day&&<div style={{...S.row,marginLeft:"auto"}}>
              <div style={{background:act?.bg,border:`1px solid ${act?.c}44`,borderRadius:6,padding:"4px 9px",fontSize:11,fontWeight:700,color:act?.c}}>G.{day.n} · {day.activity}</div>
              <span style={{...S.muted,fontSize:11}}>⚡ {day.kcal} kcal</span>
            </div>}
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
            {meal.foods?.map((f,fi)=>(
              <div key={fi} style={{...S.fi,background:f.isSupplement?"rgba(88,166,255,.04)":"transparent"}}>
                <div style={{color:f.isSupplement?"#58a6ff":"#c9d1d9"}}>
                  {f.isSupplement&&<span style={{fontSize:8,background:"rgba(31,111,235,.2)",color:"#58a6ff",borderRadius:3,padding:"1px 4px",marginRight:4,fontWeight:700}}>SPORT</span>}
                  {f.name}
                </div>
                <div style={{color:"#d29922",fontWeight:600,fontSize:11}}>{f.qty}</div>
                <div style={{color:"#6e7681",fontSize:10}}>{f.kcal>0?f.kcal+" kc":""}</div>
              </div>
            ))}
          </div>;
        })}
        {day?.condiments&&(day.condiments.olioG>0||day.condiments.parmG>0)&&(
          <div style={S.mc}>
            <div style={S.mh}><div style={{fontWeight:700,fontSize:12}}>🫙 Condimenti</div></div>
            {day.condiments.olioG>0&&<div style={S.fi}><div>Olio EVO</div><div style={{color:"#d29922",fontWeight:600,fontSize:11}}>{day.condiments.olioG}g</div><div style={{...S.muted,fontSize:10}}>{(day.condiments.olioG*9).toFixed(0)} kc</div></div>}
            {day.condiments.parmG>0&&<div style={S.fi}><div>Parmigiano grattugiato</div><div style={{color:"#d29922",fontWeight:600,fontSize:11}}>{day.condiments.parmG}g</div><div style={{...S.muted,fontSize:10}}>{(day.condiments.parmG*3.92).toFixed(0)} kc</div></div>}
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
      const act=day?(ACTS[day.activityType]||ACTS.rest):null;
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
          {supp.map(item=>(
            <div key={item.name} onClick={()=>tog(item.name)} style={{...S.si,background:"rgba(88,166,255,.03)",...(chk[item.name]?{opacity:.6}:{})}}>
              <div style={{...S.cb,...(chk[item.name]?{background:"#238636",borderColor:"#238636",color:"#fff"}:{})}}>✓</div>
              <div style={{color:"#58a6ff",...(chk[item.name]?{textDecoration:"line-through",color:"#6e7681"}:{})}}>{item.name}{item.count>1&&<span style={{...S.muted,fontSize:10,marginLeft:4}}>×{item.count}</span>}</div>
              <div style={{color:"#d29922",fontWeight:600,fontSize:11}}>{item.qty}</div>
              <div style={{...S.muted,fontSize:10}}>amazon/farmacia</div>
            </div>
          ))}
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
          {sl.map(s=>{ const uses=Object.entries(cal).filter(([,gn])=>s.days.includes(gn)).length; return (
            <div key={s.name} style={{...S.mc,marginBottom:8}}>
              <div style={{...S.mh,background:"rgba(88,166,255,.07)"}}><span style={{color:"#58a6ff",fontWeight:700,fontSize:12}}>{s.name}</span><span style={{...S.muted,fontSize:10}}>Dose: {s.qty} · G.{s.days.join(", G.")}</span></div>
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
                <div style={{fontSize:10,fontWeight:700,color:isT?"#d29922":"#6e7681",marginBottom:3}}>{["Dom","Lun","Mar","Mer","Gio","Ven","Sab"][d.getDay()]} {d.getDate()}{day&&<span style={{color:ACTS[day.activityType]?.c||"#6e7681",marginLeft:2,fontSize:8}}>G.{day.n}</span>}</div>
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
    const [desc,setDesc]=useState(initialDesc||"");
    const [piano,setPiano]=useState(initialDesc||"");
    const [prezzo,setPrezzo]=useState("");
    const [unita,setUnita]=useState("pezzo");
    const [iva,setIva]=useState("A");
    const [cat,setCat]=useState("altro");
    const [note,setNote]=useState("");
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:14}} onClick={e=>{if(e.target===e.currentTarget)onCancel();}}>
        <div style={{background:"#161b22",border:"1px solid #30363d",borderRadius:10,padding:18,maxWidth:380,width:"100%"}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:16,color:"#58a6ff",marginBottom:12}}>Nuovo Prodotto Prezzario</div>
          <label style={S.lbl}>Descrizione scontrino *</label>
          <input style={{...S.inp,width:"100%",marginBottom:8}} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="es. ZUCCHINE SCURE"/>
          <label style={S.lbl}>Nome nel piano (opzionale)</label>
          <input style={{...S.inp,width:"100%",marginBottom:8}} value={piano} onChange={e=>setPiano(e.target.value)} placeholder="lascia vuoto se non presente nel piano"/>
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
            <div><label style={S.lbl}>IVA</label>
              <select style={{...S.inp,width:"100%"}} value={iva} onChange={e=>setIva(e.target.value)}>
                <option value="A">A — 4%</option><option value="B">B — 5%</option><option value="C">C — 10%</option><option value="D">D — 22%</option>
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
