// The words of the page, in each language (tested with `node --test`).
//
// `t(lang, key, params)` looks a key up and fills {name} placeholders. Every language has
// the same keys (a test checks it). Strings used with `data-i18n-html` hold trusted markup
// written here, never data from a preset or from YouTube.

export const LANGS = ["ja", "en"];
export const DEFAULT_LANG = "ja";

const ja = {
  // page
  "page.description": "YouTube の動画やライブを、1つの画面に最大4枠で並べて見るツール。",
  "bar.groups": "候補",
  "bar.paste": "URL を貼る",
  "bar.refresh": "探し直す",
  "bar.refreshTitle": "キャッシュを捨てて、今の配信を YouTube に問い合わせ直す",
  "bar.settings": "設定",
  "bar.terms": "YouTube 利用規約",
  "bar.privacy": "利用条件とプライバシー",
  "bar.privacyHref": "privacy.html",
  "bar.language": "言語",
  "bar.updated": "最終更新 {time}",
  "notice.noPresets": "設定からプリセットを足すと候補が出ます。URL を貼って見ることもできます",
  "notice.allHidden": "すべてのプリセットを隠しています（設定で表示できます）",

  // tiles
  "tile.empty": "上のボタンを押すと入る",
  "tile.close": "この枠を空ける",
  "when.ended": "終了",
  "when.live": "LIVE",
  "when.from": "{time}〜",

  // paste dialog
  "paste.label": "YouTube の動画・ライブの URL",
  "paste.invalid": "YouTube の動画の URL ではありません。",
  "paste.choose": "枠が埋まっています。入れる枠を選んでください:",
  "paste.slot0": "左上",
  "paste.slot1": "右上",
  "paste.slot2": "左下",
  "paste.slot3": "右下",
  "paste.submit": "入れる",
  "paste.cancel": "やめる",

  // settings dialog
  "settings.presets": "プリセット",
  "settings.presetUrl": "プリセット（JSON）の URL",
  "settings.add": "足す",
  "settings.badUrl": "http(s) の URL を入れてください。",
  "settings.duplicate": "そのプリセットはもう読み込んでいます。",
  "settings.unnamed": "（名前なし）",
  "settings.show": "表示",
  "settings.remove": "外す",
  "settings.key": "YouTube API キー",
  "settings.keyHelp":
    "チャンネルのプリセットから「今日の配信」を探すのに使います。キーはこのブラウザにだけ保存し、YouTube（googleapis.com）への問い合わせにだけ使います。" +
    '<a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud のコンソール</a>で作り、' +
    "アプリケーションの制限を「ウェブサイト」で <code>https://shimomo.github.io/*</code> に、API の制限を「YouTube Data API v3」だけにしてください。",
  "settings.keyPlaceholder": "API キー",
  "settings.save": "保存",
  "settings.clear": "消す",
  "settings.keySaved": "API キーを保存しています。",
  "settings.keyNone": "API キーは保存されていません。",
  "settings.close": "閉じる",

  // status of a preset
  "status.loading": "読み込み中",
  "status.error": "読み込めません",
  "status.nokey": "API キーが必要",
  "status.key": "API キーを確かめてください",
  "status.quota": "今日の検索の上限に達しました",
  "status.network": "通信エラー",
  "status.http": "検索に失敗しました",
  "status.safe": "読み込んでいません（?safe）",

  // why a preset was refused (logic.js parsePreset)
  "preset.notObject": "JSON のオブジェクトではありません",
  "preset.noName": "name がありません",
  "preset.noItems": "items がありません",
  "preset.noLabel": "label のない候補があります",
  "preset.badVideoId": "動画 ID が不正です: {label}",
  "preset.badAliases": "aliases が不正です: {label}",
  "preset.badAuto": "auto は true か false にしてください: {label}",
  "preset.badTimezone": "timezone が不正です: {timezone}",
  "preset.badSearch": "search の形が違います",
  "preset.noChannels": "search.channels がありません",
  "preset.badChannelId": "チャンネル ID が不正です: {id}",
  "preset.badDefault": "default が items にありません: {default}",
  "preset.badPriority": "priority は数にしてください: {id}",
  "preset.badPages": "pages は 1〜{max} の整数にしてください: {id}",
  "preset.badExclude": "search.exclude は文字列の配列にしてください",
  "preset.badStrip": "search.strip は配列にしてください",
  "preset.badDuplicates": "search.duplicates は first か all です: {duplicates}",
  "preset.regexNotString": "{where} は文字列にしてください",
  "preset.regexInvalid": "{where} の正規表現が不正です: {source}",
};

const en = {
  // page
  "page.description": "View up to four YouTube videos or live streams side by side on one screen.",
  "bar.groups": "Candidates",
  "bar.paste": "Paste URL",
  "bar.refresh": "Search again",
  "bar.refreshTitle": "Discard the cache and ask YouTube for the current streams again",
  "bar.settings": "Settings",
  "bar.terms": "YouTube Terms of Service",
  "bar.privacy": "Terms and privacy",
  "bar.privacyHref": "privacy.en.html",
  "bar.language": "Language",
  "bar.updated": "Updated {time}",
  "notice.noPresets": "Add a preset in Settings to get candidates. You can also paste a URL to watch",
  "notice.allHidden": "All presets are hidden (show them in Settings)",

  // tiles
  "tile.empty": "Press a button above to fill this",
  "tile.close": "Empty this tile",
  "when.ended": "Ended",
  "when.live": "LIVE",
  "when.from": "from {time}",

  // paste dialog
  "paste.label": "URL of a YouTube video or live stream",
  "paste.invalid": "This is not the URL of a YouTube video.",
  "paste.choose": "All tiles are taken. Choose the tile to use:",
  "paste.slot0": "Top left",
  "paste.slot1": "Top right",
  "paste.slot2": "Bottom left",
  "paste.slot3": "Bottom right",
  "paste.submit": "Add",
  "paste.cancel": "Cancel",

  // settings dialog
  "settings.presets": "Presets",
  "settings.presetUrl": "URL of a preset (JSON)",
  "settings.add": "Add",
  "settings.badUrl": "Enter an http(s) URL.",
  "settings.duplicate": "That preset is already loaded.",
  "settings.unnamed": "(unnamed)",
  "settings.show": "Show",
  "settings.remove": "Remove",
  "settings.key": "YouTube API key",
  "settings.keyHelp":
    "Used to look for today's streams from channel presets. The key is stored only in this browser and used only for requests to YouTube (googleapis.com). " +
    'Create one in the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud console</a>, ' +
    "restrict applications to \"Websites\" with <code>https://shimomo.github.io/*</code>, and restrict the API to \"YouTube Data API v3\" only.",
  "settings.keyPlaceholder": "API key",
  "settings.save": "Save",
  "settings.clear": "Clear",
  "settings.keySaved": "An API key is saved.",
  "settings.keyNone": "No API key is saved.",
  "settings.close": "Close",

  // status of a preset
  "status.loading": "Loading",
  "status.error": "Cannot load",
  "status.nokey": "API key needed",
  "status.key": "Check your API key",
  "status.quota": "Today's search quota is used up",
  "status.network": "Network error",
  "status.http": "Search failed",
  "status.safe": "Not loaded (?safe)",

  // why a preset was refused (logic.js parsePreset)
  "preset.notObject": "Not a JSON object",
  "preset.noName": "name is missing",
  "preset.noItems": "items is missing",
  "preset.noLabel": "An item has no label",
  "preset.badVideoId": "Invalid video ID: {label}",
  "preset.badAliases": "Invalid aliases: {label}",
  "preset.badAuto": "auto must be true or false: {label}",
  "preset.badTimezone": "Invalid timezone: {timezone}",
  "preset.badSearch": "search has the wrong shape",
  "preset.noChannels": "search.channels is missing",
  "preset.badChannelId": "Invalid channel ID: {id}",
  "preset.badDefault": "default is not in items: {default}",
  "preset.badPriority": "priority must be a number: {id}",
  "preset.badPages": "pages must be an integer from 1 to {max}: {id}",
  "preset.badExclude": "search.exclude must be an array of strings",
  "preset.badStrip": "search.strip must be an array",
  "preset.badDuplicates": "search.duplicates must be first or all: {duplicates}",
  "preset.regexNotString": "{where} must be a string",
  "preset.regexInvalid": "Invalid regular expression in {where}: {source}",
};

export const DICTIONARY = { ja, en };

// {name} placeholders are filled from `params`; a missing key shows the key itself.
export function t(lang, key, params = {}) {
  const text = DICTIONARY[lang]?.[key] ?? DICTIONARY[DEFAULT_LANG][key] ?? key;
  return text.replace(/\{(\w+)\}/g, (whole, name) => (name in params ? String(params[name]) : whole));
}

// The saved choice, else the first of the browser's languages that the page has, else
// Japanese.
export function pickLang(saved, browserLanguages = []) {
  if (LANGS.includes(saved)) return saved;
  for (const tag of browserLanguages) {
    const lang = String(tag).toLowerCase().split("-")[0];
    if (LANGS.includes(lang)) return lang;
  }
  return DEFAULT_LANG;
}

// The locale for times: 24-hour clocks in both languages.
export function localeOf(lang) {
  return lang === "en" ? "en-GB" : "ja-JP";
}
