import test from "node:test";
import assert from "node:assert/strict";
import { addChatsToBrand, platformsInFile, mergeMonthlyVolRow } from "../src/lib/chatImportMerge.js";

const PLATFORMS = ["Shopee", "Lazada", "Tiktok", "Line MyShop", "Amaze", "Brand.com"];
const normalise = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Mirrors the Volume-tab import: agg (file store → {platform: chats}) is matched
// to roster brands (exact normalised name first, then partial "includes"), chats
// are recorded against the matched brand id, then each brand's monthlyVol row is
// merged for the platforms present in the file only.
function runImport(brands, existingMonth, agg) {
  const chatsByBrandId = {};
  Object.entries(agg).forEach(([storeName, platChats]) => {
    const lower = storeName.toLowerCase();
    if (lower.startsWith("closed") || lower.startsWith("offboarded")) return;
    const norm = normalise(storeName);
    let idx = brands.findIndex(b => normalise(b.name) === norm);
    if (idx < 0) idx = brands.findIndex(b => norm.includes(normalise(b.name)) || normalise(b.name).includes(norm));
    if (idx >= 0) addChatsToBrand(chatsByBrandId, brands[idx].id, platChats);
  });
  const filePlats = platformsInFile(agg);
  const newVol = { ...existingMonth };
  brands.forEach(b => {
    newVol[b.id] = mergeMonthlyVolRow(newVol[b.id], chatsByBrandId[b.id], filePlats, PLATFORMS);
  });
  return newVol;
}

test("re-import keeps manually entered Amaze / Call CC values", () => {
  const brands = [{ id: "shiseido", name: "Shiseido" }];
  const existing = {
    shiseido: { Shopee: 100, Lazada: 50, Tiktok: 10, "Line MyShop": 0, Amaze: 42, "Brand.com": 7, "Call CC": 15 },
  };
  const agg = { Shiseido: { Shopee: 120, Lazada: 55, Tiktok: 12 } };

  const out = runImport(brands, existing, agg);

  assert.deepEqual(out.shiseido, {
    Shopee: 120, Lazada: 55, Tiktok: 12,      // overwritten from file
    "Line MyShop": 0, Amaze: 42, "Brand.com": 7, "Call CC": 15, // untouched
  });
});

test("brand present in roster but absent from file gets 0 for file platforms only", () => {
  const brands = [{ id: "nestle", name: "Nestlé" }];
  const existing = { nestle: { Shopee: 30, Lazada: 20, Tiktok: 5, "Line MyShop": 0, Amaze: 9, "Brand.com": 0 } };
  const agg = { "Some Other Store": { Shopee: 1 } };

  const out = runImport(brands, existing, agg);

  assert.equal(out.nestle.Shopee, 0);   // in file's platform set, brand not in file → 0
  assert.equal(out.nestle.Lazada, 20);  // Lazada not in this file → kept
  assert.equal(out.nestle.Amaze, 9);    // manual → kept
});

test("store matched by partial name receives its file chats", () => {
  const brands = [{ id: "innisfree", name: "innisfree - Amore" }];
  const agg = { innisfree: { Shopee: 568, Lazada: 70 } }; // partial match: "innisfree" ⊂ "innisfreeamore"

  const out = runImport(brands, {}, agg);

  assert.equal(out.innisfree.Shopee, 568);
  assert.equal(out.innisfree.Lazada, 70);
  assert.equal(out.innisfree.Tiktok, 0);
  assert.equal(out.innisfree.Amaze, 0);
});

test("several file stores mapping to one brand are summed", () => {
  const brands = [{ id: "cpb", name: "Clé de Peau" }];
  const agg = {
    "Clé de Peau Official": { Shopee: 10, Lazada: 5 },
    "Clé de Peau Beauté":   { Shopee: 3,  Tiktok: 2 },
  };

  const out = runImport(brands, {}, agg);

  assert.deepEqual(out.cpb, { Shopee: 13, Lazada: 5, Tiktok: 2, "Line MyShop": 0, Amaze: 0, "Brand.com": 0 });
});

test("closed / offboarded stores are skipped", () => {
  const brands = [{ id: "acne", name: "Acne Aid" }];
  const existing = { acne: { Shopee: 5, Lazada: 1, Tiktok: 0, "Line MyShop": 0, Amaze: 3, "Brand.com": 0 } };
  const agg = { "Closed - Acne Aid": { Shopee: 999 } };

  const out = runImport(brands, existing, agg);

  assert.equal(out.acne.Shopee, 0); // Shopee is in file; closed store ignored → 0
  assert.equal(out.acne.Amaze, 3);
});
