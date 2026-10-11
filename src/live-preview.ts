import { App, editorInfoField, editorLivePreviewField, MarkdownView, parseLinktext } from "obsidian";
import { Extension, RangeSetBuilder, StateEffect } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { renderIconInto } from "./icon-packs";
import { linkIconPlacement } from "./link-icon-placement";
import type AutoIconsPlugin from "./main";
import type { ResolvedIcon } from "./main";

/**
 * Live Preview is a CodeMirror 6 editor, so the reading-view markdown post
 * processor never runs there. Instead we register an editor extension that
 * puts a small "widget" decoration (an icon element) just before each
 * internal link on screen. CodeMirror owns that DOM, so injecting plain
 * elements by hand would get wiped on the next update; decorations are the
 * supported way to add visual elements.
 *
 * A widget at the edge of a link is always rendered *beside* the link's
 * element, not inside it. To match Reading mode (icon inside the link), the
 * rendered icon is then moved into the link element; see link-icon-placement.ts.
 */

/** Dispatched to every editor to force a rebuild (settings or metadata changed). */
const REFRESH_LINK_ICONS = StateEffect.define<null>();

export interface LinkMatch {
	/** Offsets within the line, covering the whole link syntax. */
	from: number;
	to: number;
	/** The link target as written, e.g. "Note#Heading" (alias/title stripped). */
	linktext: string;
}

const WIKILINK = /(!?)\[\[([^\[\]]+?)\]\]/g;
// [text](Note.md), [text](Note%20Name.md), [text](<Note Name.md>), optional "title"
const MDLINK = /(!?)\[[^\[\]]*\]\((<[^>]+>|[^()\s]+)(?:\s+"[^"]*")?\)/g;
const EXTERNAL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Pure text scan for internal links on a single line. Kept free of any
 * Obsidian/CodeMirror calls so it is easy to reason about and test.
 * Embeds (![[...]] / ![](...)) are skipped: Live Preview renders those as
 * the embedded content, not as a link.
 */
export function findLinks(line: string): LinkMatch[] {
	const found: LinkMatch[] = [];

	for (const m of line.matchAll(WIKILINK)) {
		if (m[1] === "!") {
			continue;
		}
		// "Note#Heading|alias" -> "Note#Heading"; "\|" is how aliases are escaped in tables.
		const linktext = m[2].split("|")[0].replace(/\\$/, "").trim();
		if (linktext) {
			found.push({ from: m.index ?? 0, to: (m.index ?? 0) + m[0].length, linktext });
		}
	}

	for (const m of line.matchAll(MDLINK)) {
		if (m[1] === "!") {
			continue;
		}
		let target = m[2].startsWith("<") ? m[2].slice(1, -1) : m[2];
		if (EXTERNAL_SCHEME.test(target)) {
			continue;
		}
		try {
			target = decodeURIComponent(target);
		} catch {
			// not valid percent-encoding; use it as written
		}
		if (target) {
			found.push({ from: m.index ?? 0, to: (m.index ?? 0) + m[0].length, linktext: target });
		}
	}

	found.sort((a, b) => a.from - b.from);
	// Drop anything overlapping an earlier match so decorations stay ordered.
	const result: LinkMatch[] = [];
	let lastEnd = -1;
	for (const link of found) {
		if (link.from >= lastEnd) {
			result.push(link);
			lastEnd = link.to;
		}
	}
	return result;
}

/** Class names match those in main.ts / styles.css. */
const LIVE_ICON_CLASS = "autoicons-icon autoicons-link-icon autoicons-live-icon";
const LIVE_ICON_MARKER = "autoicons-live-icon";

class LinkIconWidget extends WidgetType {
	constructor(private readonly resolved: ResolvedIcon) {
		super();
	}

	/** Lets CodeMirror reuse the existing element instead of recreating it. */
	eq(other: LinkIconWidget): boolean {
		return other.resolved.icon === this.resolved.icon && other.resolved.color === this.resolved.color;
	}

	toDOM(): HTMLElement {
		const el = createSpan({ cls: LIVE_ICON_CLASS });
		renderIconInto(el, this.resolved.icon);
		if (this.resolved.color) {
			el.style.color = this.resolved.color;
		}
		return el;
	}

	/**
	 * The icon element gets moved inside the link's own element after it is
	 * rendered (see link-icon-placement.ts), where CodeMirror's normal DOM
	 * cleanup would not find it. Remove it explicitly when the widget goes away.
	 */
	destroy(dom: HTMLElement): void {
		dom.remove();
	}
}

function buildDecorations(view: EditorView, plugin: AutoIconsPlugin): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const state = view.state;

	// Only Live Preview. Source mode intentionally shows raw markdown.
	if (!plugin.settings.linkIconsEnabled || !state.field(editorLivePreviewField, false)) {
		return builder.finish();
	}

	const sourcePath = state.field(editorInfoField, false)?.file?.path ?? "";
	const selection = state.selection.ranges;
	const doc = state.doc;

	for (const { from, to } of view.visibleRanges) {
		let pos = from;
		while (pos <= to) {
			const line = doc.lineAt(pos);
			for (const link of findLinks(line.text)) {
				const start = line.from + link.from;
				const end = line.from + link.to;

				// When the cursor is inside a link Live Preview shows its raw
				// [[source]]; skip the icon there, like the rendered state does.
				if (selection.some((range) => range.from <= end && range.to >= start)) {
					continue;
				}

				const { path } = parseLinktext(link.linktext);
				if (!path) {
					continue; // e.g. [[#Heading]] — a link within the same note
				}
				const dest = plugin.app.metadataCache.getFirstLinkpathDest(path, sourcePath);
				if (!dest) {
					continue;
				}
				const resolved = plugin.resolveItem(dest.path, false);
				if (!resolved) {
					continue;
				}
				builder.add(start, start, Decoration.widget({ widget: new LinkIconWidget(resolved), side: -1 }));
			}
			pos = line.to + 1;
		}
	}

	return builder.finish();
}

/** The CodeMirror extension to pass to Plugin.registerEditorExtension(). */
export function createLinkIconExtension(plugin: AutoIconsPlugin): Extension {
	const decorationsPlugin = ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = buildDecorations(view, plugin);
			}

			update(update: ViewUpdate) {
				const forced = update.transactions.some((tr) => tr.effects.some((e) => e.is(REFRESH_LINK_ICONS)));
				const modeChanged =
					update.startState.field(editorLivePreviewField, false) !==
					update.state.field(editorLivePreviewField, false);
				if (forced || modeChanged || update.docChanged || update.viewportChanged || update.selectionSet) {
					this.decorations = buildDecorations(update.view, plugin);
				}
			}
		},
		{ decorations: (instance) => instance.decorations }
	);
	return [decorationsPlugin, linkIconPlacement(LIVE_ICON_MARKER)];
}

/**
 * Asks every open markdown editor to rebuild its link icons. Needed because
 * the extension above otherwise only rebuilds when the editor's own document,
 * viewport or selection changes — not when a setting or another note's
 * frontmatter does.
 */
export function refreshLinkIcons(app: App): void {
	app.workspace.iterateAllLeaves((leaf) => {
		if (!(leaf.view instanceof MarkdownView)) {
			return;
		}
		// `editor.cm` is the underlying CodeMirror 6 EditorView. It is not in
		// Obsidian's public typings, but is widely relied upon by plugins.
		const cm = (leaf.view.editor as unknown as { cm?: EditorView }).cm;
		cm?.dispatch({ effects: REFRESH_LINK_ICONS.of(null) });
	});
}
