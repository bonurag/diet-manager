# 📊 SCHEMA PREZZI — Struttura JSON Multi-Negozio

## Panoramica

Il file `prezzario_conad.json` contiene **prezzi da diversi negozi**. Ogni prodotto può avere prezzi da Conad, Coop, Lidl, ecc.

---

## Struttura Root

```json
{
  "versione": "2.0",
  "dataAggiornamento": "2026-05-31",
  "negozi": [...],
  "ivaAliquote": {...},
  "categorie": {...},
  "prodotti": [...]
}
```

---

## Sezione `negozi`

Array dei supermercati:

```json
"negozi": [
  {
    "id": "conad",
    "nome": "Conad",
    "localita": "Palermo",
    "note": "Catena principale"
  },
  {
    "id": "coop",
    "nome": "Coop",
    "localita": "Palermo"
  }
]
```

**Importante**: l'`id` deve essere univoco e non cambiare mai.

---

## Sezione `prodotti`

Esempio completo:

```json
{
  "id": "zucchine",
  "descrizione": "ZUCCHINE SCURE",
  "nomePiano": "Zucchine",
  "categoria": "frutta_verdura",
  "tipoPrezzo": "peso_variabile",
  "unita": "acquisto",
  "presenteNelPiano": true,
  "prezzi": {
    "conad": {
      "prezzo": 2.36,
      "iva": "A",
      "data": "2026-05-31",
      "note": "Media tra 2 acquisti"
    },
    "coop": {
      "prezzo": 2.45,
      "iva": "A",
      "data": "2026-06-15",
      "note": "Scontrino 15 giugno"
    }
  }
}
```

### Campi Prodotto

| Campo | Tipo | Descrizione |
|---|---|---|
| `id` | string | ID univoco, minuscolo |
| `descrizione` | string | Come su scontrino |
| `nomePiano` | string | Nome nel piano (o null) |
| `categoria` | string | frutta_verdura, carne_pesce, ecc. |
| `tipoPrezzo` | string | confezione o peso_variabile |
| `unita` | string | acquisto, pezzo, kg, litro |
| `prezzi` | object | Map negozio_id → prezzo |

### Campi Prezzo

```json
{
  "prezzo": 2.36,
  "iva": "A",
  "data": "2026-05-31",
  "note": "Media tra 2 acquisti"
}
```

---

## Come Ottimizza la Spesa

L'app **sceglie il prezzo minimo** per ogni prodotto:

```
Zucchine:     Conad 2.36€ ← MINIMO
              Coop 2.45€

Philadelphia: Conad 3.58€ ← MINIMO (no Coop)

Totale = 2.36 + 3.58 = ...
```

---

## Come Aggiungere un Nuovo Negozio

### 1. Aggiungi in `negozi`

```json
{
  "id": "lidl",
  "nome": "Lidl",
  "localita": "Palermo"
}
```

### 2. Aggiungi prezzi negli alimenti

```json
"prezzi": {
  "conad": {...},
  "lidl": {
    "prezzo": 2.29,
    "iva": "A",
    "data": "2026-06-20",
    "note": "Offerta"
  }
}
```

### 3. Esporta il JSON aggiornato

---

## IVA Aliquote

```json
"ivaAliquote": {
  "A": 4.0,
  "B": 5.0,
  "C": 10.0,
  "D": 22.0
}
```

- **A** (4%): Alimentari base (frutta, pane, latte)
- **B** (5%): Raro
- **C** (10%): Alimentari trasformati
- **D** (22%): Bevande gassate, non alimentare

---

## Tipi di Prezzo

### `peso_variabile`
Frutta/verdura. Prezzo osservato è valido solo per quell'acquisto.

```json
{
  "tipoPrezzo": "peso_variabile",
  "prezzo": 1.11,
  "note": "Variazione forte — peso diverso"
}
```

### `confezione`
Prezzo fisso per una confezione/pezzo.

```json
{
  "tipoPrezzo": "confezione",
  "prezzo": 3.58,
  "note": "Una confezione 200g"
}
```

---

## Best Practice

1. **Traccia il scontrino** → sempre `scontrino` per audit
2. **Data recente** → aggiorna ogni 2-4 settimane
3. **Note descrittive** → "sconto 30%", "offerta"
4. **ID stabile** → non cambiare una volta scelto
5. **Backup** → scarica JSON dopo modifiche

---

**Versione schema:** 2.0  
**Ultimo aggiornamento:** Giugno 2026
