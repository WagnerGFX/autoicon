import {
	App,
	BasesEntry,
	Constructor,
	FileValue,
	getLinkpath,
	IconValue,
	LinkValue,
	normalizePath,
	NullValue,
	RenderContext,
	StringValue,
	TFile,
	TFolder,
	Value,
} from "obsidian";
import { renderIconInto } from "./icons";
import type AutoIconsPlugin from "./main";

/**
 * Bases formula function `autoicon()`.
 *
 * Bases has no documented API for plugin-provided formula functions yet (the
 * help page says "in the future, plugins will be able to add functions"), but
 * Obsidian ships an undocumented `Plugin.registerGlobalFunc()` that other
 * community plugins already rely on. Its shape below is taken from those
 * plugins' type definitions, not from Obsidian's own typings, so everything
 * here is feature-detected and degrades to "function not available" rather
 * than breaking the plugin.
 */

interface BasesFunctionParam {
	name: string;
	type: readonly Constructor<Value>[];
	optional?: boolean;
	variadic?: boolean;
}

interface BasesGlobalFunction {
	ctx: null;
	docString: () => string;
	name: string;
	params: readonly BasesFunctionParam[];
	applyWithContext: (ctx: BasesEntry, ...args: Value[]) => Value;
}

declare module "obsidian" {
	interface Plugin {
		/** Undocumented. Optional here so its absence can be detected at runtime. */
		registerGlobalFunc?(func: BasesGlobalFunction): void;
	}
}

const FUNCTION_NAME = "autoicon";
const FORMULA_ICON_CLASSES = "autoicons-icon autoicons-formula-icon";

interface Target {
	path: string;
	isFolder: boolean;
}

/**
 * Turns the formula argument into a vault file or folder. Accepts a vault
 * path ("Projects/Web/Plan.md", "Projects/Web"), a wikilink ("[[Plan]]",
 * "[[Plan#Heading|alias]]") or a bare link name, so it works with `file.path`,
 * `file.folder`, `file`, `file.asLink()` and link-typed note properties.
 */
function resolveTarget(app: App, raw: string, sourcePath: string): Target | null {
	let text = raw.trim();
	if (!text) {
		return null;
	}

	const resolveLink = (linktext: string): Target | null => {
		const dest = app.metadataCache.getFirstLinkpathDest(
			getLinkpath(linktext),
			sourcePath
		);
		return dest ? { path: dest.path, isFolder: false } : null;
	};

	// A wikilink always names a file; never let it match a same-named folder.
	const wikilink = /^!?\[\[([\s\S]*)\]\]$/.exec(text);
	if (wikilink) {
		text = wikilink[1].split("|")[0].trim();
		return text ? resolveLink(text) : null;
	}

	const exact = app.vault.getAbstractFileByPath(normalizePath(text));
	if (exact instanceof TFile) {
		return { path: exact.path, isFolder: false };
	}
	if (exact instanceof TFolder) {
		// The vault root has no icon.
		return exact.isRoot() ? null : { path: exact.path, isFolder: true };
	}
	return resolveLink(text);
}

/**
 * The value `autoicon()` returns. It extends IconValue so Bases treats it as
 * an icon (type checks, `link(file, autoicon(...))`), but renders through
 * AutoIcons so emoji and colors work, which the built-in icon() can't do.
 *
 * Created lazily: extending a class that doesn't exist at runtime would throw
 * while the module loads and take the whole plugin down with it.
 */
function createAutoIconValueClass() {
	return class AutoIconValue extends IconValue {
		private readonly color: string | null;

		constructor(icon: string, color: string | null) {
			super(icon);
			this.color = color;
		}

		renderTo(el: HTMLElement, _ctx: RenderContext): void {
			// Use el.createSpan so the icon is created in the element's own
			// document, which matters for pop-out windows.
			const iconEl = el.createSpan({ cls: FORMULA_ICON_CLASSES });
			renderIconInto(iconEl, this.toString());
			if (this.color) {
				iconEl.style.color = this.color;
			}
		}
	};
}

/**
 * Registers `autoicon([path])` as a global Bases formula function.
 * Returns false when this Obsidian build doesn't support it.
 */
export function registerAutoIconFormula(plugin: AutoIconsPlugin): boolean {
	if (
		typeof plugin.registerGlobalFunc !== "function" ||
		typeof IconValue !== "function" ||
		typeof NullValue !== "function"
	) {
		return false;
	}

	try {
		const AutoIconValue = createAutoIconValueClass();

		// Obsidian keeps the registration, so make the function inert once
		// the plugin unloads instead of calling into a dead instance.
		let active = true;
		plugin.register(() => {
			active = false;
		});

		plugin.registerGlobalFunc({
			ctx: null,
			name: FUNCTION_NAME,
			docString: () =>
				"Returns the AutoIcons icon (with its color) for a file or folder path, " +
				"link or file. With no argument, uses the file of the current row.",
			params: [
				{
					name: "path",
					// StringValue covers file.path / file.folder; LinkValue and
					// FileValue cover links and files. NullValue lets a missing
					// property produce an empty cell instead of an error.
					type: [StringValue, LinkValue, FileValue, NullValue],
					optional: true,
				},
			],
			applyWithContext: (ctx, ...args) => {
				if (!active) {
					return NullValue.value;
				}
				const arg = args[0];
				if (arg instanceof NullValue) {
					return NullValue.value;
				}

				// Links in a note's properties resolve relative to that note.
				const sourcePath = ctx?.file?.path ?? "";
				let target: Target | null = null;
				if (arg === undefined) {
					target = ctx?.file ? { path: ctx.file.path, isFolder: false } : null;
				} else {
					target = resolveTarget(plugin.app, arg.toString(), sourcePath);
				}

				const resolved = target
					? plugin.resolveItem(target.path, target.isFolder)
					: null;
				return resolved
					? new AutoIconValue(resolved.icon, resolved.color)
					: NullValue.value;
			},
		});
		return true;
	} catch (error) {
		console.warn("AutoIcons: could not register the autoicon() formula function.", error);
		return false;
	}
}
