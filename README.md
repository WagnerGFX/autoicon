# AutoIcons

An [Obsidian](https://obsidian.md) plugin that automatically adds icons to files and folders in the file explorer — no manual tagging of every item required.

## Features

Icons are resolved for each file and folder in this priority order:

1. **Per-item icons** — right-click any file or folder in the explorer and choose **Set icon**. Notes store the icon in frontmatter; folders and other files are remembered by the plugin (and follow the item through renames and moves).

2. **Frontmatter icons** — give any note an icon by adding a property to its frontmatter:

   ```yaml
   ---
   icon: lucide-rocket
   ---
   ```

   The property name is configurable (default: `icon`). Emoji work too (`icon: 📚`), and `icon: none` hides the icon for that note entirely. Use the **Set icon for current file** command to pick an icon from a searchable list — the frontmatter is updated for you.

3. **Custom rules** — assign icons automatically based on:
   - **Path starts with** — e.g. everything under `Projects/` gets a briefcase icon (applies to the folder and everything inside it)
   - **Extension is** — e.g. all `.excalidraw` files get a pencil icon
   - **Name contains** — e.g. anything with "meeting" in the name gets a calendar icon
   - **Has tag** — e.g. every note tagged `#project` gets a briefcase icon (nested tags like `#project/web` match too)
   - **Path matches regex** — for advanced patterns

   Each rule can target files, folders, or both, and can optionally assign a fixed color. Rules are checked top to bottom and the first match wins; rules can be reordered in settings.

4. **Default icons by file type** — images, audio, video, PDF, canvas, code, archives, and spreadsheets get a sensible icon out of the box. Can be turned off.

### Where icons appear

Beyond the file explorer, icons also show in **tab headers**, next to **inline titles**, and on **internal links in reading view** — each surface can be toggled independently, and icon size is adjustable.

### Emoji

Anywhere an icon can go, an emoji can go instead: type or paste one into the icon picker and it appears as the first suggestion, or write it straight into frontmatter.

All icons come from the icon set built into Obsidian ([Lucide](https://lucide.dev)) by default, so they automatically match your theme in both light and dark mode.

### Icon packs & icon style

Beyond Lucide, every icon picker (frontmatter, rules, default folder/note icon) can also search four bundled icon sets:

- [Unicons](https://icon-sets.iconify.design/uil/) by Iconscout
- [Unicons Monochrome](https://icon-sets.iconify.design/uim/) by Iconscout
- [Cuida Icons](https://icon-sets.iconify.design/cuida/) by Sysvale
- [Material Symbols (Outlined)](https://icon-sets.iconify.design/material-symbols/) by Google

All four are bundled into the plugin at build time — nothing is downloaded at runtime, and the plugin makes no network requests.

Pick one under **Settings → Icon style** to re-skin every automatic icon at once — all the per-extension file-type icons plus the default folder and note icons switch to that pack's equivalent. Frontmatter and custom rules are unaffected and can still use any icon from any pack regardless of this setting. If a pack doesn't have a suitable icon for a particular file type, that one falls back to the Lucide icon instead of showing nothing.

### Colorful icons

Turn on **Colorful icons** to give every file and folder a color from a palette (red, orange, yellow, green, teal, blue, purple, pink by default — every color is editable in settings), chosen deterministically from its path — the same item always gets the same color, so nothing shifts between reloads. Individual rules can override this with a fixed color of their own.

## Commands

- **Set icon for current file** — opens a fuzzy-searchable icon picker and writes the chosen icon to the note's frontmatter.
- **Remove icon from current file** — removes the note's icon (frontmatter or per-item).

Both are also available by right-clicking any file or folder in the explorer.

## Settings

- **Frontmatter icons** — toggle reading icons from frontmatter, and choose the property name.
- **Default icons by file type** — toggle the built-in file type icons.
- **Icon style** — choose which icon set (Lucide or a bundled pack) powers the automatic file-type, folder, and note icons.
- **Icon size** — adjust icon size from 12 to 32 pixels.
- **Where icons appear** — toggle tab header, inline title, and reading-view link icons independently.
- **Colorful icons** — toggle deterministic per-item coloring, and customize the palette.
- **Custom rules** — add, reorder, and delete rules; each rule has a target, a match type, a pattern, an icon chosen from a searchable picker, and an optional color.

## Installation

### From community plugins (once accepted)

1. Open **Settings → Community plugins → Browse**.
2. Search for **AutoIcons**.
3. Install and enable.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest).
2. Copy them into `<your-vault>/.obsidian/plugins/autoicons/`.
3. Reload Obsidian and enable **AutoIcons** in **Settings → Community plugins**.

## Development

Requires Node.js 18+.

```bash
npm install
npm run dev     # build in watch mode
npm run build   # type-check and produce a production build
```

To test locally, clone this repository into `<your-vault>/.obsidian/plugins/autoicons/` and run `npm run dev`, then enable the plugin in Obsidian.

`npm run dev`/`npm run build` first run `scripts/generate-icon-packs.mjs`, which reads the `@iconify-json/*` packages and writes bundle-ready icon data to `src/generated/` (gitignored, regenerated on every build).

### Releasing

1. Run `npm version patch|minor|major` — this bumps `package.json`, `manifest.json`, and `versions.json`.
2. Push the tag: the GitHub Actions workflow builds the plugin and creates a draft release with `main.js`, `manifest.json`, and `styles.css` attached.
3. Publish the release on GitHub.

## License

[MIT](LICENSE)

## Third-party icons

Bundled at build time, no network requests involved:

- [Unicons](https://github.com/Iconscout/unicons) and [Unicons Monochrome](https://github.com/Iconscout/unicons) by Iconscout — Apache 2.0
- [Cuida Icons](https://github.com/Sysvale/cuida-icons) by Sysvale — Apache 2.0
- [Material Symbols](https://github.com/google/material-design-icons) by Google — Apache 2.0
