# AGENTS.md

## Project
Obsidian community plugin written in TypeScript. Code, comments, docs, and commit messages are in English. `src/` is bundled by esbuild into `main.js`, a gitignored artifact that is never committed. Release assets: `main.js`, `manifest.json`, `styles.css`.

## Commands
- `npm install`
- `npm run dev` — esbuild watch mode (writes `main.js`)
- `npm run build` — `tsc -noEmit -skipLibCheck` then a production bundle. This is the only verification step; there is no test runner, linter, or formatter config, so don't invent test commands.
- Do not commit `main.js` or `data.json`.

## Workflow constraints
- Confirm versions in `package.json` before relying on an API or feature. Prefer the existing devDependencies; explain why they are insufficient before proposing a new dependency.

## Releasing
- `npm version patch|minor|major` runs `version-bump.mjs`, updating `manifest.json` and `versions.json`.
- Pushing the tag triggers `.github/workflows/release.yml`, which builds and creates a draft GitHub release with `main.js`, `manifest.json`, and `styles.css`.
- Never hand-edit version numbers in the manifests.

## Architecture
- `src/main.ts` — plugin entrypoint, DOM injection, debounced refresh, icon resolution (`resolveItem`).
- `src/settings.ts` — settings shape/defaults, per-extension default icons, color parsing, path→color hashing.
- `src/settings-tab.ts` — settings UI.
- `src/live-preview.ts` + `src/link-icon-placement.ts` — CodeMirror 6 link icons.
- `src/formula.ts` — Bases `autoicon()` formula function.
- `src/icons.ts`, `src/icon-picker.ts` — icon rendering and fuzzy picker.

## Repo-specific gotchas
- Icon resolution has two independent paths: `resolveLegacy` and `resolveInherited`, selected by `colorInheritanceEnabled`. Any priority change must update both, plus the settings descriptions and README.
- The settings UI has two implementations: declarative `getSettingDefinitions()` and a `display()` fallback for older Obsidian. A new setting needs an entry in `AutoIconsSettings`, `DEFAULT_SETTINGS`, and both UI paths.
- Always validate icon values through `resolveDisplayIcon`/`isKnownIcon` (accepts `lucide-*` ids, normalizes bare names, allows emoji). Injecting an icon that cannot render makes the file-explorer MutationObserver loop forever.
- Explorer icons are re-applied by a debounced `scheduleRefresh()` (100 ms) because Obsidian re-renders the explorer DOM. Avoid synchronous full repaints on vault/workspace events.
- Storage split: note icons live in frontmatter; per-item icons for folders and non-markdown files live in `settings.customIcons` keyed by vault path. Rename/delete handlers re-key and remove those entries.
- Several integrations use undocumented APIs and are feature-detected for a reason: `leaf.tabHeaderInnerIconEl`, `editor.cm`, CodeMirror `view.observer`, and `Plugin.registerGlobalFunc`. Keep them guarded; never touch `IconValue` at module top level (it is created lazily so importing `formula.ts` does not throw when Bases is absent).
- `obsidian` typings are `latest` while `manifest.json` declares `minAppVersion` 1.13.0. Newer APIs must remain optional and guarded at runtime.
- Obsidian DOM helpers (`createSpan`, `createDiv`, etc.) are globals; do not import them.
- `styles.css` holds all styling; keep `autoicons-*` class names and the `--autoicons-icon-size` variable in sync with the TS code.
- README documents "Set icon" commands and an explorer context menu, but no command or `file-menu` registration exists in `src/`. Treat that part of the README as intent, not current behavior.

## Local testing
The plugin only runs inside Obsidian: clone the repo into `<vault>/.obsidian/plugins/autoicons/`, run `npm install && npm run dev`, then enable it in Settings → Community plugins. Its saved state is `data.json` (gitignored).
