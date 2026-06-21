# 🤝 GUIDA CONTRIBUIRE

Benvenuto! Leggi questa guida prima di iniziare.

---

## Tipi di Contributi

### 🐛 Segnalare Bug

Apri un'issue con:
- **Titolo chiaro**: "Peso non si salva se uso la virgola"
- **Descrizione**: browser, SO, cosa hai fatto
- **Passi per riprodurre**: step-by-step
- **Risultato atteso vs reale**: screenshot utili

### ✨ Suggerire Feature

Apri un'issue con:
- **Titolo**: "Feature: Notifiche per integratori"
- **Descrizione**: perché, come dovrebbe funzionare
- **Casi d'uso**: esempi concreti

### 🔧 Inviare Code (Pull Request)

Segui il workflow Git sotto.

---

## Workflow Git

### 1. Fork il repo
Clicca "Fork" su GitHub.

### 2. Clone il tuo fork
```bash
git clone https://github.com/TUO_USERNAME/diet-manager.git
cd diet-manager
git remote add upstream https://github.com/OWNER/diet-manager.git
```

### 3. Crea un branch
```bash
git checkout -b feature/nomefeature
# Oppure per bugfix:
git checkout -b fix/nomebug
```

### 4. Fai le modifiche
Testa localmente:
```bash
npm run dev
```

### 5. Commit chiari
```bash
git add .
git commit -m "feat: Aggiunta notifiche per integratori"
```

Formati consigliati:
- `feat: Aggiunta feature`
- `fix: Correzione bug`
- `docs: Aggiornamento documentazione`
- `refactor: Semplificazione codice`

### 6. Aggiorna con upstream
```bash
git fetch upstream
git rebase upstream/main
```

### 7. Push al tuo fork
```bash
git push origin feature/nomefeature
```

### 8. Apri Pull Request
Su GitHub, compila:
- **Titolo**: chiaro e descrittivo
- **Descrizione**: cosa, perché, come testare
- **Checklist**: ho testato? Ho aggiornato docs?

### 9. Aspetta il review
Rispondi ai commenti e fai nuovi commit se necessario.

### 10. Merge
Fatto! Il tuo branch verrà cancellato automaticamente.

---

## Linee Guida Code

### JavaScript / JSX
- **Indentazione**: 2 spazi
- **Naming**: camelCase per variabili, PascalCase per componenti
- **Lunghezza righe**: max 100 caratteri
- **Commenti**: usa `// ──` per separatori di sezioni

### Commit History
- ✅ 1 feature = 1-3 commit logici
- ❌ No 50 commit di "fix", "oops", "..."

---

## Cosa NON fare

❌ Non aggiungere dipendenze senza motivo  
❌ Non pushare `.env` (NON CONDIVIDERE chiavi API)  
❌ Non breakare test/build  
❌ Non fare PR di 500 righe senza discussione  

---

## Community

- 💬 Sii rispettoso e costruttivo
- 🙏 Ringrazia chi ti aiuta
- 🤔 Fai domande se non capisci
- 📖 Leggi le guide prima di issue duplicate

---

**Grazie per il supporto!** 🚀
