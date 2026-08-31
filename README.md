# OneVoice27 Post Creator

A browser-only post-image creator for the All Things New campaign. It helps a user choose a Facebook or Instagram template, add a real photo and message, generate a PNG, write a caption, and share it from their device.

## Technology

- Static HTML, CSS, and vanilla JavaScript. There is no build process, package manager, backend, or database required.
- The Canvas API creates the downloadable post image.
- The Web Share API is used when the browser supports sharing a PNG file. Otherwise, the image downloads and the caption and hashtags are copied to the clipboard when permitted.
- Font Awesome is loaded from a CDN for social icons. Google Fonts supplies Montserrat.

## Project Structure

| Path | Purpose |
| --- | --- |
| `index.html` | Page structure, dialogs, caption sample, and footer. |
| `styles.css` | Responsive layout, Facebook/Instagram themes, templates, dialogs, guides, and sample post styling. |
| `app.js` | Template selection, editing, image rendering, download/share flow, caption helpers, and guided onboarding. |
| `templates/templates.js` | Facebook and Instagram template definitions: output dimensions, layout, artwork path, text styling, and defaults. |
| `templates/caption-tips.json` | Rotating caption-writing hints. |
| `resources/images/facebook/` | Facebook template backgrounds, sized for 940 x 788 output. |
| `resources/images/instagram/` | Instagram template backgrounds, sized for 1080 x 1350 output. |
| `resources/images/logo.png` | Site and example-post avatar. |
| `resources/images/template_logo.png` | Brand mark placed on exported template images. |
| `supabase.sql` | Optional visitor and successful-share counter schema and RPC permissions. |
| `supabase-config.js` | Optional public Supabase project URL and anon key configuration. |

## How It Works

1. `templates/templates.js` supplies the current format's template record.
2. `app.js` keeps the active template, entered title/subtitle, and optional uploaded image in memory. Uploaded photos use temporary object URLs and are not stored on a server.
3. `createImage()` draws the background/photo, watermark, logo, title, and subtitle to a canvas at the template's native output size.
4. The resulting PNG is used by the download, share flow, and read-only social-post example.

The live preview and canvas renderer have matching text and watermark settings. Update both `positionTemplateOverlays()` / `fitPreviewText()` and `drawTemplateOverlays()` / `drawTemplateText()` when changing rendered layout details.

## Optional Supabase Counters

Visitor and share analytics are disabled by default. To enable them:

1. Run `supabase.sql` in the project's Supabase SQL Editor.
2. In `supabase-config.js`, add the Project URL and the browser-safe anon key from Supabase Project Settings > API. Never use a service-role key in this file.
3. Serve the site and open it in a fresh browser session. The header should show the incremented visitor count.
4. Complete a native share on a device that supports file sharing. Only a resolved `navigator.share()` call increments `shares`; a cancelled share, image download, or clipboard fallback does not.

The header retrieves and displays visitor and shared-post totals through `get_site_stats()`. If that request fails, the stats area stays hidden. The table itself remains inaccessible to anonymous users through row-level security.

## Adding Or Editing Templates

1. Add approved artwork to `resources/images/facebook/` or `resources/images/instagram/`.
2. Add or update a record in `templates/templates.js`.
3. Keep Facebook templates at `940 x 788` and Instagram templates at `1080 x 1350` unless the layout/rendering code is updated too.
4. Test preview, generated PNG, and the sample post after the change.

Use real photos only. The UI explicitly discourages stock and AI-model imagery.

## Local Testing

Serve the folder over HTTP. Do not open `index.html` directly, because `fetch()` for caption tips and some browser sharing/clipboard features need a web origin.

```powershell
py -m http.server 8080
```

Open `http://127.0.0.1:8080/`.

Basic script validation:

```powershell
node --check app.js
node --check templates/templates.js
```

Manual checks:

- Switch Facebook and Instagram, and cycle through every template.
- Upload an image, edit both text fields, and confirm the generated PNG matches the preview.
- Test the long-text guidance at more than 20 title words and more than 30 subtitle words.
- Open the caption sample and confirm it changes between Facebook and Instagram styling.
- Test sharing on a phone where the Web Share API is available; also check the download and clipboard fallback on desktop.
- Wait five seconds without interaction and walk through the onboarding guide.
- With Supabase configured, use a fresh browser session to verify the visitor count increases, then complete a native share to verify the share counter in Supabase.

## Deployment

Deploy the repository as a static site, for example with GitHub Pages, Netlify, or any HTTP server. No environment variables or build command are needed. Configure `supabase-config.js` only if analytics are required. When changing `styles.css`, `app.js`, `templates/templates.js`, or `supabase-config.js`, increment the cache query version in `index.html` so returning users receive the update.
