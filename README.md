# 🥗 Diet Manager

**Piano alimentare personalizzato con AI + Gestione prezzi multi-negozio + Ottimizzazione spesa**

Un'applicazione web completa per gestire piani alimentari personalizzati, tracciare progressi, e ottimizzare la lista della spesa scegliendo i prezzi più bassi tra diversi supermercati.

---

## ✨ Funzionalità principali

### 📄 Gestione Piano Alimentare
- **Upload PDF** → Claude AI estrae automaticamente tutti i dati (macronutrienti, ingredienti, kcal, integratori)
- **Calendario intelligente** → Generazione automatica o assegnazione manuale dei giorni di dieta
- **Visualizzazione pasti** → Dettagli completi: ingredienti, quantità, kcal, macros
- **Esclusione giorni** → Modifica la spesa se sei fuori o salti una giornata

### 🛒 Gestione Lista della Spesa
- **Spesa giornaliera, settimanale o intera piano** — a scelta
- **Spunte interattive** — segna cosa hai già comprato
- **Esclusione giorni smart** — automaticamente ricalcola ingredienti assenti
- **Note libere** — per varianti, brand preferiti, promzioni

### ⏷️ **Database Prezzi Multi-Negozio** ⭐ NEW
- **Carica prezzi da diversi supermercati** (Conad, Coop, Lidl, ecc.)
- **Confronto automatico** — vedi il prezzo più basso per ogni prodotto
- **Calcolo costo totale** — stima della spesa settimanale/mensile
- **Editor prezzi integrato** — aggiungi/modifica/elimina prezzi inline
- **Export/import** — scarica il JSON aggiornato, condividi tra utenti

### 📊 Tracciamento Progressi
- **Storico peso** — registra una volta a settimana
- **Grafico progressivo** → barra visual verso il target
- **Delta settimanale** — vedi quanto hai perso/guadagnato

### ⚡ Integratori Sportivi
- **Pianificazione automatica** → quali integratori, in quali giorni, dosi
- **Calendario settimanale** → vedi cosa assumere ogni giorno
- **Non disponibili al Conad** → linkati a fornitori (Amazon, Decathlon, farmacie)

### 📝 Note Personali
- **Un campo note per ogni giorno** — varianti, promemoria, sensazioni

---

## 🚀 Quick Start (5 minuti)

### Prerequisiti
- **Node.js v18+** ([download](https://nodejs.org))
- **npm** (incluso con Node.js)
- **Chiave API Anthropic** ([gratuita, registrati qui](https://console.anthropic.com))

### Installazione

```bash
# 1. Clone il repo
git clone https://github.com/tuousername/diet-manager.git
cd diet-manager

# 2. Installa dipendenze
npm install

# 3. Crea .env dai template
cp .env.example .env

# 4. Apri .env e inserisci la tua chiave Anthropic
# VITE_ANTHROPIC_KEY=sk-ant-api03-xxxxx-inserisci-la-tua-chiave
```

### Esecuzione

```bash
# Avvia il dev server
npm run dev

# Apri nel browser:
# http://localhost:5173
```

Il terminale ti mostrerà l'URL esatto (solitamente `localhost:5173`).

---

## 📋 Struttura cartelle

```
diet-manager/
├── index.html                    ← Entry point HTML
├── package.json                  ← Dipendenze npm
├── vite.config.js                ← Config build e proxy API
├── .env.example                  ← Template .env (copia in .env)
├── .gitignore                    ← File da escludere da Git
├── README.md                     ← Questa guida
│
├── src/
│   ├── main.jsx                  ← React entry point
│   └── DietManager.jsx           ← App principale (~700 righe)
│
├── docs/
│   ├── SETUP_LOCALE.md           ← Guida setup dettagliato
│   ├── SCHEMA_PREZZI.md          ← Struttura JSON prezzario
│   ├── API_USAGE.md              ← Come funziona Claude API
│   └── CONTRIBUIRE.md            ← Come contribuire
│
├── public/
│   └── (favicon, assets — opzionali)
│
└── dist/                         ← Build di produzione (generato)
```

---

## 🔑 Configurazione API Anthropic

### 1. Crea account gratuito
Vai su [console.anthropic.com](https://console.anthropic.com), registrati con email.

### 2. Genera chiave API
- Vai a "API Keys" 
- Clicca "+ Create API Key"
- Copia la chiave (formato: `sk-ant-api03-...`)

### 3. Inserisci in .env
```bash
VITE_ANTHROPIC_KEY=sk-ant-api03-xxxxx
```

**⚠️ IMPORTANTE**: Non condividere mai questa chiave. Se la commetti per errore su GitHub, rigenerala subito.

---

## 🎯 Come usare l'app

### 1️⃣ **Upload Piano Alimentare**
1. Clicca **"+ PDF"** nella navbar
2. Trascina il PDF del piano alimentare (o clicca per scegliere)
3. Aspetta 30-60 secondi (Claude estrae i dati)
4. Boom! Tutto caricato automaticamente

### 2️⃣ **Genera Calendario**
1. Vai al tab **📅 Calendario**
2. Clicca **"Genera Calendario Auto"** per assegnazione intelligente
3. Oppure clicca manualmente i giorni per asseganre i giorni di piano

### 3️⃣ **Visualizza Pasti**
1. Tab **🍽️ Pasti**
2. Seleziona una data → vedi tutti gli alimenti con kcal, ingredienti, condimenti

### 4️⃣ **Lista Spesa + Prezzi**
1. Tab **🛒 Spesa**
2. Seleziona **📊 Carica Prezzi** → carica il file JSON prezzario
3. Scegli modalità: 📅 Giorno / 📆 Settimana / 📋 Intero Piano
4. Esclusione giorni → clicca i pill per escludere (se sei fuori)
5. **Mostra Costo** → somma totale della spesa con prezzi reali
6. Spunta gli articoli mentre compri

### 5️⃣ **Storico Peso**
1. Tab **⚖️ Peso**
2. Registra il peso ogni settimana (mattina a digiuno → più accurato)
3. Vedi il delta settimanale e la barra di progressione verso l'obiettivo

### 6️⃣ **Integratori**
1. Tab **⚡ Integratori**
2. Vedi quali assumere, in quali giorni, dose
3. Calendario settimanale con reminder

---

## 💰 Gestione Prezzi (Multi-Negozio)

### Caricamento iniziale
Il database include i prezzi estratti dai tuoi scontrini Conad. Quando hai scontrini da altri negozi:

1. Scarica il JSON prezzario da **🛒 Spesa** → **💾 Esporta Prezzi**
2. Apri l'editor HTML separato (`editor_prezzario.html`)
3. Carica il JSON precedente
4. Aggiungi i nuovi prezzi dai tuoi scontrini
5. Esporta il JSON aggiornato
6. Caricalo di nuovo in Diet Manager

### Struttura JSON (vedi `SCHEMA_PREZZI.md`):
```json
{
  "negozi": [
    {"id": "conad", "nome": "Conad", ...},
    {"id": "coop", "nome": "Coop", ...}
  ],
  "prodotti": [
    {
      "id": "zucchine",
      "nomePiano": "Zucchine",
      "prezzi": {
        "conad": {"prezzo": 2.36, "iva": "A", ...},
        "coop": {"prezzo": 2.45, "iva": "A", ...}
      }
    }
  ]
}
```

### Ottimizzazione
La spesa mostra automaticamente il prezzo più basso tra i negozi cariccati. Così puoi decidere dove comprare singoli articoli.

---

## 🛠️ Build per Produzione

Per creare una versione ottimizzata da mettere online:

```bash
npm run build
```

Genera la cartella `dist/` pronta per deploy su:
- **Vercel** (semplice: `vercel deploy`)
- **Netlify** (drag & drop `dist/`)
- **GitHub Pages** (vai su Settings → Pages → Deploy from `/dist`)
- **Qualsiasi hosting statico**

---

## 📊 Storage Dati

Tutti i dati vengono salvati nel **localStorage del browser**:
- ✅ Piano alimentare
- ✅ Calendario assegnato
- ✅ Storico peso
- ✅ Note personali
- ✅ Spunte lista spesa
- ✅ Bozze in progress

**I dati restano nel tuo dispositivo** → non finiscono su nessun server esterno (eccetto le chiamate API a Claude per parsing PDF, che sono stateless).

Nota: localStorage ha limite ~5-10MB a browser. Per backup: scarica il JSON prezzario e le note.

---

## 🔐 Privacy & Sicurezza

### Cosa Claude vede:
- ✅ Il PDF del tuo piano alimentare (per estrazione ingredienti)
- ✅ Il file JSON se lo mandi manualmente

### Cosa Claude NON vede:
- ❌ Peso, misurazioni personali, storico medico
- ❌ Prezzi della spesa
- ❌ Note personali
- ❌ I tuoi pasti dopo la prima elaborazione

### Chiave API:
- ✅ Salvata solo in `.env` locale (non in GitHub, grazie `.gitignore`)
- ✅ Trasmessa via HTTPS ad Anthropic
- ✅ Non salvata né nei cookie né nel localStorage

Se temi la privacy: puoi hostare localmente senza internet, editing offline dei dati memorizzati.

---

## 🐛 Troubleshooting

### "Errore: Module not found"
```bash
# Installa dipendenze di nuovo
rm -rf node_modules
npm install
```

### "CORS error quando carico il PDF"
Il proxy Vite potrebbe non attivarsi. Verifica `vite.config.js` abbia il blocco `proxy` per `/anthropic`.

### "LocalStorage full"
localStorage massimo ~5MB. Soluzione: scarica un backup JSON e cancella i vecchi dati (pulsante 🗑 Reset).

### "Peso non si salva"
Usa il **formato corretto**: 82.5 (con punto, non virgola). Browser locale o localStorage disabilitato?

---

## 📖 Documentazione Aggiuntiva

Vedi la cartella `docs/`:
- **`SETUP_LOCALE.md`** — setup dettagliato per sviluppatori
- **`SCHEMA_PREZZI.md`** — struttura completa JSON multi-negozio
- **`API_USAGE.md`** — come funziona Claude API
- **`CONTRIBUIRE.md`** — linee guida per pull request

---

## 🤝 Contribuire

Sei benvenuto a:
- 🐛 **Segnalare bug** → apri una Issue
- ✨ **Suggerire feature** → Discussions o Issue
- 🔧 **Inviare code** → Fork + Pull Request

Linee guida: vedi `docs/CONTRIBUIRE.md`

---

## 📝 Licenza

MIT — Usa liberamente, modifica, distribuisci. Attribuzione gradita ma non obbligatoria.

---

## 💡 Roadmap Future

- [ ] Supporto dark/light theme completamente customizzabile
- [ ] Export PDF stampa-friendly del piano + lista spesa
- [ ] Sincronizzazione cloud (Firebase/Supabase opzionale)
- [ ] App mobile nativa (React Native)
- [ ] Supporto più di una persona per account
- [ ] Integrazione Google Fit / Apple Health per sync peso
- [ ] Notifiche push reminder integratori
- [ ] Database prezzi pubblico crowdsourced (comunità)

---

## ❓ FAQ

**D: Posso usare questo offline?**  
R: Sì, fino al PDF parsing (che richiede internet per Claude). Una volta caricato, tutto funziona offline.

**D: I miei dati restano privati?**  
R: Sì. localStorage locale + HTTPS. Zero log su server nostri (solo Anthropic vede il PDF per parsing, una volta).

**D: Come aggiungo un nuovo supermercato?**  
R: Carica un scontrino → modifica il JSON nei `negozi` e `prezzi`, o usa l'editor HTML separato.

**D: Posso condividere il piano con un amico?**  
R: Scarica il JSON (pulsante Export) e condividi. Lui lo carica sul suo profilo.

**D: Il PDF parsing costa soldi?**  
R: Dipende dal piano Anthropic. Gratis per i primi $5 USD/mese (sufficienti per decine di PDF).

---

## 📧 Contatti & Supporto

- **Issues GitHub** → per bug e feature request
- **Discussions** → domande generali e condivisione di esperienze
- **Email** → (se nel repo)

---

**Versione:** 1.0.0  
**Ultimo aggiornamento:** Giugno 2026  
**Autore:** Giuseppe Bonura + Claude  
**Licenza:** MIT
