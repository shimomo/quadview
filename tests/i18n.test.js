import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { DEFAULT_LANG, DICTIONARY, LANGS, localeOf, pickLang, t } from "../site/i18n.js";

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test("every language has the same keys and placeholders", () => {
  const base = DICTIONARY[DEFAULT_LANG];
  for (const lang of LANGS) {
    assert.deepEqual(Object.keys(DICTIONARY[lang]).sort(), Object.keys(base).sort(), lang);
    for (const [key, text] of Object.entries(DICTIONARY[lang])) {
      assert.deepEqual(placeholders(text), placeholders(base[key]), `${lang} ${key}`);
    }
  }
});

test("t fills placeholders and falls back to the key", () => {
  assert.equal(t("en", "when.from", { time: "20:00" }), "from 20:00");
  assert.equal(t("ja", "when.from", { time: "20:00" }), "20:00〜");
  assert.equal(t("en", "bar.updated"), "Updated {time}");
  assert.equal(t("fr", "when.live"), "LIVE"); // unknown language: Japanese
  assert.equal(t("en", "no.such.key"), "no.such.key");
});

test("pickLang: the saved choice, then the browser, then Japanese", () => {
  assert.equal(pickLang("en", ["ja-JP"]), "en");
  assert.equal(pickLang("fr", ["ja-JP"]), "ja");
  assert.equal(pickLang(null, ["fr-FR", "en-US", "ja"]), "en");
  assert.equal(pickLang(null, ["en-GB"]), "en");
  assert.equal(pickLang(null, ["de"]), "ja");
  assert.equal(pickLang(null, []), "ja");
  assert.equal(pickLang(), "ja");
});

test("localeOf gives 24-hour locales", () => {
  assert.equal(localeOf("ja"), "ja-JP");
  assert.equal(localeOf("en"), "en-GB");
});

test("every key the page uses exists", () => {
  const keys = new Set(Object.keys(DICTIONARY.ja));
  const used = new Set();
  const html = readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
  for (const m of html.matchAll(/data-i18n(?:-html)?="([\w.]+)"/g)) used.add(m[1]);
  for (const m of html.matchAll(/data-i18n-attrs="([^"]+)"/g)) {
    for (const pair of m[1].split(",")) used.add(pair.split(":")[1]);
  }
  for (const file of ["app.js", "logic.js"]) {
    const source = readFileSync(new URL(`../site/${file}`, import.meta.url), "utf8");
    for (const m of source.matchAll(/\b(?:t|PresetError)\(\s*"([\w.]+)"/g)) used.add(m[1]);
    for (const m of source.matchAll(/i18nAttrs = "\w+:([\w.]+)"/g)) used.add(m[1]);
  }
  for (const key of used) assert.ok(keys.has(key), key);
  assert.ok(used.size > 30);
});
