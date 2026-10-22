# QuadView

[日本語](README.md)

A tool to watch up to four YouTube videos or live streams side by side on one screen.
It lets you follow several live streams at the same time (matches at several venues, game tournament streams) without switching tabs.

<https://shimomo.github.io/quadview/>

- The four tiles are laid out as large as the screen allows, without scrolling.
- Swapping one tile does not stop the video in the others.
- Sound starts muted. Use each tile's YouTube player to turn it on.
- It is meant for wide screens such as laptops.

## How to use

1. **Paste a URL**: paste the URL of a YouTube video or live stream and it goes into a free tile.
2. **Add presets**: in Settings, add the URL of a preset (a JSON list of candidates). Buttons for the candidates appear in the top bar; press one to put it in a tile, press it again to remove it. You can add any number of presets and this browser remembers them. Untick "Show" in Settings to hide a preset from the bar (it stays loaded, and a hidden preset never fills tiles by itself).
3. **Enter an API key** (optional): channel presets use your own YouTube Data API key to find that channel's streams for today (live or upcoming). Streams found become buttons marked "LIVE" or "from 20:00", and when the page opens the four tiles are filled with live streams first.
   With a key, video presets also check the current state of each video and mark it "LIVE" or "Ended" (video presets never fill tiles by themselves).

### Creating an API key

1. In the [Google Cloud console](https://console.cloud.google.com/apis/credentials), create a project and enable "YouTube Data API v3".
2. Create an API key under "Credentials".
3. Restrict the key:
   - Application restriction: "Websites", `https://shimomo.github.io/*`
   - API restriction: "YouTube Data API v3" only
4. Paste it in QuadView's Settings.

The key is stored only in this browser and used only for requests to YouTube (`www.googleapis.com`).
"Search again" in the bar asks about today's streams again without waiting for the 15-minute cache (the tiles keep playing; each press uses the same quota as opening the page).
A search costs about 2 units per channel (pages x about 2 units for a channel with many `pages`), and results are kept in the tab for 15 minutes (the free quota is 10,000 units a day).

If a preset freezes the page, open `https://shimomo.github.io/quadview/?safe` to open it without loading presets, then remove the preset in Settings.

## Presets

A preset is JSON readable from a browser (CORS allowed), for example hosted on GitHub Pages. It holds only what a person wrote, never data fetched from the YouTube API. The full format, including how channel presets sort streams into candidates (`exclude`, `strip`, `after`, `aliases`, `priority`, `pages`, `duplicates`, `auto`), is described in the [Japanese README](README.md).

## Language

The page is available in Japanese and English. On the first visit it follows the browser's language; change it with the language selector in the bar (the choice is remembered in this browser).
Names and labels written in a preset are not translated.

## Privacy

This page collects no personal information and runs no analytics. See [Terms and privacy](https://shimomo.github.io/quadview/privacy.en.html).
QuadView uses YouTube API Services; by using it you agree to the [YouTube Terms of Service](https://www.youtube.com/t/terms).

## Development

No dependencies. `npm test` (`node --test` on Node 24) runs the logic tests.
Serve `site/` statically to run it (for example `python3 -m http.server -d site`).

## License

QuadView is released under the [MIT license](LICENSE).
