# AutoIcons

An [Obsidian](https://obsidian.md) plugin that automatically adds icons to files and folders in the file explorer — no manual tagging of every item required.

## Features

Icons are resolved for each file and folder in this priority order:

1. **Frontmatter icons** — give any note an icon by adding a property to its frontmatter:

   ```yaml
   ---
   icon: lucide-rocket
   ---
   ```

   The property name is configurable (default: `icon`). Use the **Set icon for current file** command to pick an icon from a searchable list — the frontmatter is updated for you.

2. **Custom rules** — assign icons automatically based on:
   - **Path starts with** — e.g. everything under `Projects/` gets a briefcase icon (applies to the folder and everything inside it)
   - **Extension is** — e.g. all `.excalidraw` files get a pencil icon
   - **Name contains** — e.g. anything with "meeting" in the name gets a calendar icon
   - **Path matches regex** — for advanced patterns

   Each rule can target files, folders, or both. Rules are checked top to bottom and the first match wins; rules can be reordered in settings.

3. **Default icons by file type** — images, audio, video, PDF, canvas, code, archives, and spreadsheets get a sensible icon out of the box. Can be turned off.

All icons come from the icon set built into Obsidian ([Lucide](https://lucide.dev)), so they automatically match your theme in both light and dark mode.

## Commands

- **Set icon for current file** — opens a fuzzy-searchable icon picker and writes the chosen icon to the note's frontmatter.
- **Remove icon from current file** — removes the icon property from the note's frontmatter.

## Settings

- **Frontmatter icons** — toggle reading icons from frontmatter, and choose the property name.
- **Default icons by file type** — toggle the built-in file type icons.
- **Custom rules** — add, reorder, and delete rules; each rule has a target, a match type, a pattern, and an icon chosen from a searchable picker.

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

### Releasing

1. Run `npm version patch|minor|major` — this bumps `package.json`, `manifest.json`, and `versions.json`.
2. Push the tag: the GitHub Actions workflow builds the plugin and creates a draft release with `main.js`, `manifest.json`, and `styles.css` attached.
3. Publish the release on GitHub.

## License

[MIT](LICENSE)
