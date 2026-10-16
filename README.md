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

   To color the icon, add a color property with a hex RGB or RGBA value (`#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`):

   ```yaml
   ---
   icon: lucide-rocket
   color: "#3b82f66e"
   ---
   ```

   The color property name is configurable too (default: `color`). Quote the value — in YAML an unquoted `#` starts a comment. By default the color is only applied when the note also has a valid icon property; without an icon it is ignored (with [Color inheritance](#color-inheritance) on, it applies on its own). It takes priority over **Colorful icons**, and invalid values are ignored.

3. **Custom rules** — assign icons automatically based on:
   - **Path starts with** — e.g. everything under `Projects/` gets a briefcase icon (applies to the folder and everything inside it)
   - **Extension is** — e.g. all `.excalidraw` files get a pencil icon
   - **Name contains** — e.g. anything with "meeting" in the name gets a calendar icon
   - **Has tag** — e.g. every note tagged `#project` gets a briefcase icon (nested tags like `#project/web` match too)
   - **Path matches regex** — for advanced patterns

   Each rule can target files, folders, or both, and can optionally assign a fixed color. Rules are checked top to bottom and the first match wins; rules can be reordered in settings. With [Color inheritance](#color-inheritance) on, a rule may set just an icon or just a color, and the icon and the color are each taken from the first matching rule that sets them.

4. **Default icons by file type** — images, audio, video, PDF, canvas, code, archives, and spreadsheets get a sensible icon out of the box. Can be turned off.

### Where icons appear

Beyond the file explorer, icons also show in **tab headers**, next to **inline titles**, and on **internal links** (in both Live Preview and reading view) — each surface can be toggled independently, and icon size is adjustable.

### Bases: the `autoicon()` formula function

In [Bases](https://help.obsidian.md/bases), add a formula property that calls `autoicon()` and it renders the same icon (and color) the file would get anywhere else, using the full priority order above. Because it is an ordinary formula value rather than something injected into one particular view, any Bases view that renders formula properties can show it.

```yaml
formulas:
  icon: autoicon()
  folder_icon: autoicon(file.folder)
  linked_icon: autoicon(note.project)
```

- `autoicon()` — the icon of the current row's file.
- `autoicon(file.path)` — takes a vault path. It also accepts a file, a link (`file.asLink()`, a link property), or a folder path such as `file.folder`, which gives the folder's icon.
- Relative or partial names are resolved like wikilinks, relative to the current row's note.
- A missing property, an unknown path, or a path that has no icon produces an empty cell, so it composes with `if()`.

Notes:

- The function relies on an Obsidian formula-registration API that is not part of the official plugin API yet. If a future Obsidian version changes it, `autoicon()` may stop being available until the plugin is updated; everything else keeps working.
- Cells are evaluated by Bases, so after changing your icon rules or settings you may need to reopen the base to see the new icons.
- Unlike the built-in `icon()` function, `autoicon()` supports emoji and colors.

### Emoji

Anywhere an icon can go, an emoji can go instead: type or paste one into the icon picker and it appears as the first suggestion, or write it straight into frontmatter.

All icons come from the icon set built into Obsidian ([Lucide](https://lucide.dev)), so they automatically match your theme in both light and dark mode.

### Colorful icons

Turn on **Colorful icons** to give every file and folder a color from a palette (red, orange, yellow, green, teal, blue, purple, pink by default — every color is editable in settings), chosen deterministically from its path — the same item always gets the same color, so nothing shifts between reloads. Individual rules can override this with a fixed color of their own.

### Color inheritance

Turn on **Color inheritance** and the icon and its color are resolved separately, each from the first level that sets it:

| | Icon | Color |
| --- | --- | --- |
| 1 | Frontmatter property (or per-item icon) | Frontmatter property |
| 2 | Rules | Rules |
| 3 | Default icons (folder, file type, note) | Colorful icons |
| 4 | — | Default (theme color) |

This means a rule can set an icon with no color (the color then comes from the next level, e.g. Colorful icons), or a color with no icon (the icon then comes from the next level, e.g. the default note icon). For example, with these rules:

- `Path starts with Projects` → briefcase icon, no color
- `Name contains meeting` → red, no icon

`Projects/meeting.md` gets a **red briefcase**, `Notes/weekly meeting.md` gets the default note icon in **red**, and `Projects/plan.md` gets the briefcase in the Colorful icons color (or the theme color if that's off). Among rules, the icon and the color each come from the first matching rule that sets them, so they can come from different rules. In the rules list, use the eraser button to clear a rule's icon and the paint bucket to clear its color.

With inheritance on, a note's frontmatter color applies even when the note has no icon property of its own. `icon: none` still hides the icon entirely, and a color never shows without an icon to put it on. With inheritance off (the default), the original behavior is unchanged: the first matching source supplies the icon, and a rule needs an icon to match.

## Commands

- **Set icon for current file** — opens a fuzzy-searchable icon picker and writes the chosen icon to the note's frontmatter.
- **Remove icon from current file** — removes the note's icon (frontmatter or per-item).

Both are also available by right-clicking any file or folder in the explorer.

## Settings

- **Frontmatter icons** — toggle reading icons from frontmatter, and choose the icon property name and the icon color property name.
- **Default icons by file type** — toggle the built-in file type icons.
- **Icon size** — adjust icon size from 12 to 32 pixels.
- **Where icons appear** — toggle tab header, inline title, and reading-view link icons independently.
- **Colorful icons** — toggle deterministic per-item coloring, and customize the palette.
- **Color inheritance** — resolve icon and color independently so unset values fall through frontmatter → rules → colorful icons → default.
- **Custom rules** — add, reorder, and delete rules; each rule has a target, a match type, a pattern, an icon chosen from a searchable picker, and an optional color (with color inheritance on, the icon is optional too).

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
