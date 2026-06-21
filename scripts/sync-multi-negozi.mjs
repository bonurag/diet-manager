import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const conad = JSON.parse(readFileSync(join(root, "data/prezzario_conad.json"), "utf8"));
const multi = JSON.parse(readFileSync(join(root, "data/prezzario_multi_negozi.json"), "utf8"));

const prodotti = conad.prodotti.map(p => ({
  id: p.id,
  descrizione: p.descrizione,
  nomePiano: p.nomePiano || null,
  categoria: p.categoria,
  tipoPrezzo: p.tipoPrezzo,
  unita: p.unita,
  presenteNelPiano: p.presenteNelPiano,
  prezzi: {
    conad: {
      prezzo: p.prezzo,
      iva: p.iva,
      data: conad.ultimoAggiornamento,
      note: p.note || "",
      scontrino: conad.fonti?.[0]?.documento || ""
    }
  }
}));

const result = {
  ...multi,
  dataAggiornamento: conad.ultimoAggiornamento,
  prodotti
};

writeFileSync(join(root, "data/prezzario_multi_negozi.json"), JSON.stringify(result, null, 2), "utf8");
console.log(`Sincronizzati ${prodotti.length} prodotti Conad nel prezzario multi-negozi.`);
