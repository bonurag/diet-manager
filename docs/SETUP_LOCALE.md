# ⚙️ SETUP LOCALE — Guida Dettagliata per Sviluppatori

Se vuoi **sviluppare localmente** o **contribuire al progetto**, segui questa guida passo-passo.

---

## Prerequisiti

### Node.js e npm
- **Versione richiesta**: Node.js v18+ (LTS consigliato)
- **Check**: `node --version` e `npm --version`
- **Download**: https://nodejs.org (sceglie LTS automaticamente)

### Git
- **Check**: `git --version`
- **Download**: https://git-scm.com

### Chiave API Anthropic
- **Registrati**: https://console.anthropic.com
- **Genera chiave**: vai a "API Keys" → "+ Create API Key"
- **Salva**: (non perderla, se necessario rigenerarla)

---

## Step 1: Clone il Repository

```bash
git clone https://github.com/TUO_USERNAME/diet-manager.git
cd diet-manager
```

---

## Step 2: Installa Dipendenze

```bash
npm install
```

**Output atteso**: `added 150 packages in 25s`

---

## Step 3: Configura .env

```bash
cp .env.example .env
# Apri .env e inserisci la chiave Anthropic:
# VITE_ANTHROPIC_KEY=sk-ant-api03-xxxxx
```

---

## Step 4: Avvia il Dev Server

```bash
npm run dev
```

**Apri nel browser**: http://localhost:5173

---

## Step 5: Verifica che Funziona

1. **Pagina upload** deve caricarsi
2. **Clicca "+ PDF"** → dialogo upload
3. **Console browser** (F12): nessun errore rosso

---

## Build per Testing

```bash
npm run build
npm run preview
# Apri http://localhost:4173
```

---

## Troubleshooting

### "Cannot find module 'react'"
```bash
rm -rf node_modules package-lock.json
npm install
```

### "Port 5173 already in use"
```bash
npm run dev -- --port 3000
```

### "VITE_ANTHROPIC_KEY is undefined"
```bash
cat .env | grep VITE_ANTHROPIC_KEY
```

Deve mostrare: `VITE_ANTHROPIC_KEY=sk-ant-api03-...`

---

## Workflow Locale

1. **Aggiornati**: `git pull origin main`
2. **Nuovo branch**: `git checkout -b feature/nomefeat`
3. **Sviluppa**: modifica file, test nel browser
4. **Build test**: `npm run build`
5. **Commit**: `git add . && git commit -m "..."`
6. **Push**: `git push origin feature/nomefeat`
7. **PR su GitHub**

---

**Ultima revisione:** Giugno 2026
