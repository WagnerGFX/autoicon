import {
	FileView,
	getAllTags,
	getIconIds,
	MarkdownView,
	normalizePath,
	Plugin,
	TAbstractFile,
	TFile,
	WorkspaceLeaf,
} from "obsidian";
import { registerAutoIconFormula } from "./formula";
import { IconPickerModal } from "./icon-picker";
import { createLinkIconExtension, refreshLinkIcons } from "./live-preview";
import { isEmojiIcon, renderIconInto } from "./icons";
import {
	AutoIconsSettings,
	colorForPath,
	DEFAULT_SETTINGS,
	IconRule,
	parseHexColor,
	resolveCategoryIcon,
	TYPE_ICONS,
} from "./settings";
import { AutoIconsSettingTab } from "./settings-tab";

const ICON_CLASS = "autoicons-icon";
const TAB_ICON_CLASS = "autoicons-tab-icon";
const INLINE_ICON_CLASS = "autoicons-inline-icon";
const LINK_ICON_CLASS = "autoicons-link-icon";
const HIDDEN_CLASS = "autoicons-hidden";

/** An icon plus the color to render it in (null = theme default). */
export interface ResolvedIcon {
	icon: string;
	color: string | null;
}

/** Undocumented but long-stable field carrying a leaf's tab-header icon element. */
interface TabHeaderLeaf extends WorkspaceLeaf {
	tabHeaderInnerIconEl?: HTMLElement;
}

export default class AutoIconsPlugin extends Plugin {
	settings: AutoIconsSettings;

	private observers: MutationObserver[] = [];
	private refreshTimeout: number | null = null;
	private knownIconIds: Set<string> | null = null;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new AutoIconsSettingTab(this.app, this));

		// Bases: expose autoicon() as a formula function.
		this.registerFormulaFunction();

		// Reading view: post-process the rendered HTML.
		this.registerMarkdownPostProcessor((el, ctx) => {
			if (!this.settings.linkIconsEnabled) {
				return;
			}
			el.querySelectorAll<HTMLAnchorElement>("a.internal-link").forEach((anchor) => {
				if (anchor.querySelector(`.${LINK_ICON_CLASS}`)) {
					return;
				}
				const target = anchor.getAttribute("data-href") ?? anchor.getAttribute("href");
				if (!target) {
					return;
				}
				const dest = this.app.metadataCache.getFirstLinkpathDest(target, ctx.sourcePath);
				if (!dest) {
					return;
				}
				const resolved = this.resolveItem(dest.path, false);
				if (!resolved) {
					return;
				}
				const iconEl = createSpan({ cls: `${ICON_CLASS} ${LINK_ICON_CLASS}` });
				this.updateIconEl(iconEl, resolved);
				anchor.prepend(iconEl);
			});
		});

		// Live Preview: a CodeMirror extension adds icon widgets to links.
		this.registerEditorExtension(createLinkIconExtension(this));

		this.app.workspace.onLayoutReady(() => {
			this.attachToExplorers();
			this.scheduleRefresh();
		});

		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.attachToExplorers();
				this.scheduleRefresh();
			})
		);

		this.registerEvent(
			this.app.workspace.on("file-open", () => this.scheduleRefresh())
		);

		this.registerEvent(
			this.app.metadataCache.on("changed", () => this.scheduleRefresh())
		);

		this.registerEvent(this.app.vault.on("create", () => this.scheduleRefresh()));
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				this.moveCustomIcons(file.path, oldPath);
				this.scheduleRefresh();
			})
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				this.removeCustomIcons(file.path);
				this.scheduleRefresh();
			})
		);
	}

	onunload() {
		this.disconnectObservers();
		if (this.refreshTimeout !== null) {
			window.clearTimeout(this.refreshTimeout);
			this.refreshTimeout = null;
		}
		document
			.querySelectorAll(`.${ICON_CLASS}`)
			.forEach((el) => el.remove());
		this.clearTabIcons();
		document.body.style.removeProperty("--autoicons-icon-size");
	}

	/**
	 * Registers the autoicon() Bases formula function as early as possible so
	 * bases restored at startup can already use it. If that fails (Bases not
	 * initialized yet), retry once when the layout is ready.
	 */
	private registerFormulaFunction() {
		if (registerAutoIconFormula(this)) {
			return;
		}
		this.app.workspace.onLayoutReady(() => {
			if (!registerAutoIconFormula(this)) {
				console.warn(
					"AutoIcons: the autoicon() Bases formula function is not available in this version of Obsidian."
				);
			}
		});
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<AutoIconsSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		this.migrateRemovedIconPacks();
		if (!this.settings.customIcons || typeof this.settings.customIcons !== "object") {
			this.settings.customIcons = {};
		}
		if (!Array.isArray(this.settings.colorPalette)) {
			this.settings.colorPalette = [];
		}
	}

	/**
	 * The bundled icon packs (Unicons, Unicons Monochrome, Cuida, Material
	 * Symbols) were removed. Default folder/note icons chosen from one of them
	 * would no longer render, so reset those to the Lucide defaults and drop
	 * the obsolete "icon style" setting. Icons set per note or per rule that
	 * used a pack simply stop rendering until a new icon is chosen.
	 */
	private migrateRemovedIconPacks() {
		const removedPack = /^(uil|uim|cuida|msout)-/;
		if (removedPack.test(this.settings.folderIcon)) {
			this.settings.folderIcon = DEFAULT_SETTINGS.folderIcon;
		}
		if (removedPack.test(this.settings.noteIcon)) {
			this.settings.noteIcon = DEFAULT_SETTINGS.noteIcon;
		}
		delete (this.settings as unknown as Record<string, unknown>).activeIconStyle;
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.scheduleRefresh();
	}

	/** Debounced refresh so bursts of vault/DOM events cause a single repaint. */
	scheduleRefresh() {
		if (this.refreshTimeout !== null) {
			return;
		}
		this.refreshTimeout = window.setTimeout(() => {
			this.refreshTimeout = null;
			this.applyAll();
		}, 100);
	}

	// ---------------------------------------------------------------- explicit icons

	/** Opens the icon picker and stores the choice: frontmatter for notes, settings for everything else. */
	openIconPicker(file: TAbstractFile) {
		new IconPickerModal(this.app, (icon) => {
			if (file instanceof TFile && file.extension === "md") {
				void this.app.fileManager.processFrontMatter(
					file,
					(frontmatter: Record<string, unknown>) => {
						frontmatter[this.settings.frontmatterProperty] = icon;
					}
				);
			} else {
				this.settings.customIcons[file.path] = icon;
				void this.saveSettings();
			}
		}).open();
	}

	/** True when the item has an icon assigned directly (frontmatter or context menu). */
	hasExplicitIcon(file: TAbstractFile): boolean {
		if (this.settings.customIcons[file.path]) {
			return true;
		}
		if (file instanceof TFile && file.extension === "md") {
			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			return frontmatter?.[this.settings.frontmatterProperty] !== undefined;
		}
		return false;
	}

	clearExplicitIcon(file: TAbstractFile) {
		if (this.settings.customIcons[file.path]) {
			delete this.settings.customIcons[file.path];
			void this.saveSettings();
		}
		if (file instanceof TFile && file.extension === "md") {
			const property = this.settings.frontmatterProperty;
			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (frontmatter?.[property] !== undefined) {
				void this.app.fileManager.processFrontMatter(
					file,
					(fm: Record<string, unknown>) => {
						delete fm[property];
					}
				);
			}
		}
	}

	/** Re-keys custom icons when an item (or a folder with children) is renamed or moved. */
	private moveCustomIcons(newPath: string, oldPath: string) {
		const icons = this.settings.customIcons;
		let changed = false;
		if (icons[oldPath]) {
			icons[newPath] = icons[oldPath];
			delete icons[oldPath];
			changed = true;
		}
		const prefix = oldPath + "/";
		for (const key of Object.keys(icons)) {
			if (key.startsWith(prefix)) {
				icons[newPath + "/" + key.slice(prefix.length)] = icons[key];
				delete icons[key];
				changed = true;
			}
		}
		if (changed) {
			void this.saveData(this.settings);
		}
	}

	private removeCustomIcons(path: string) {
		const icons = this.settings.customIcons;
		let changed = false;
		if (icons[path]) {
			delete icons[path];
			changed = true;
		}
		const prefix = path + "/";
		for (const key of Object.keys(icons)) {
			if (key.startsWith(prefix)) {
				delete icons[key];
				changed = true;
			}
		}
		if (changed) {
			void this.saveData(this.settings);
		}
	}

	// ---------------------------------------------------------------- rendering

	private getExplorerRoots(): HTMLElement[] {
		return this.app.workspace
			.getLeavesOfType("file-explorer")
			.map((leaf) => leaf.view.containerEl);
	}

	/**
	 * The file explorer re-renders its DOM on expand/collapse, sort, and
	 * scrolling, which discards injected icons. Watch it and re-apply.
	 */
	private attachToExplorers() {
		this.disconnectObservers();
		for (const root of this.getExplorerRoots()) {
			const observer = new MutationObserver((mutations) => {
				if (mutations.some((m) => this.isExternalMutation(m))) {
					this.scheduleRefresh();
				}
			});
			observer.observe(root, { childList: true, subtree: true });
			this.observers.push(observer);
		}
	}

	/** Ignore mutations caused by our own icon injection to avoid feedback loops. */
	private isExternalMutation(mutation: MutationRecord): boolean {
		const nodes = [
			...Array.from(mutation.addedNodes),
			...Array.from(mutation.removedNodes),
		];
		return nodes.some(
			(node) =>
				node.instanceOf(HTMLElement) &&
				!node.matches(`.${ICON_CLASS}, .${ICON_CLASS} *`)
		);
	}

	private disconnectObservers() {
		for (const observer of this.observers) {
			observer.disconnect();
		}
		this.observers = [];
	}

	private applyAll() {
		document.body.style.setProperty(
			"--autoicons-icon-size",
			`${this.settings.iconSize}px`
		);
		this.applyExplorerIcons();
		this.applyTabIcons();
		this.applyInlineTitleIcons();
		refreshLinkIcons(this.app);
	}

	private applyExplorerIcons() {
		for (const root of this.getExplorerRoots()) {
			const titles = root.querySelectorAll<HTMLElement>(
				".nav-file-title[data-path], .nav-folder-title[data-path]"
			);
			titles.forEach((titleEl) => {
				const path = titleEl.dataset.path;
				if (!path || path === "/") {
					return;
				}
				const isFolder = titleEl.classList.contains("nav-folder-title");
				const resolved = this.resolveItem(path, isFolder);
				let iconEl = titleEl.querySelector<HTMLElement>(`:scope > .${ICON_CLASS}`);
				if (!resolved) {
					iconEl?.remove();
					return;
				}
				if (!iconEl) {
					iconEl = createSpan({ cls: ICON_CLASS });
					const content = titleEl.querySelector(
						":scope > .nav-file-title-content, :scope > .nav-folder-title-content"
					);
					titleEl.insertBefore(iconEl, content ?? titleEl.firstChild);
				}
				this.updateIconEl(iconEl, resolved);
			});
		}
	}

	/** Swaps each file tab's default header icon for the file's AutoIcons icon. */
	private applyTabIcons() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			const headerIconEl = (leaf as TabHeaderLeaf).tabHeaderInnerIconEl;
			const parent = headerIconEl?.parentElement;
			if (!headerIconEl || !parent) {
				return;
			}
			const file = leaf.view instanceof FileView ? leaf.view.file : null;
			const resolved =
				this.settings.tabIconsEnabled && file
					? this.resolveItem(file.path, false)
					: null;
			let iconEl = parent.querySelector<HTMLElement>(`:scope > .${TAB_ICON_CLASS}`);
			if (!resolved) {
				iconEl?.remove();
				headerIconEl.removeClass(HIDDEN_CLASS);
				return;
			}
			if (!iconEl) {
				iconEl = createSpan({ cls: `${ICON_CLASS} ${TAB_ICON_CLASS}` });
				parent.insertBefore(iconEl, headerIconEl);
			}
			this.updateIconEl(iconEl, resolved);
			headerIconEl.addClass(HIDDEN_CLASS);
		});
	}

	private clearTabIcons() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			const headerIconEl = (leaf as TabHeaderLeaf).tabHeaderInnerIconEl;
			headerIconEl?.removeClass(HIDDEN_CLASS);
			headerIconEl?.parentElement
				?.querySelectorAll(`:scope > .${TAB_ICON_CLASS}`)
				.forEach((el) => el.remove());
		});
	}

	/** Shows the note's icon before the inline title inside open markdown views. */
	private applyInlineTitleIcons() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (!(leaf.view instanceof MarkdownView) || !leaf.view.file) {
				return;
			}
			const resolved = this.settings.inlineTitleIconsEnabled
				? this.resolveItem(leaf.view.file.path, false)
				: null;
			const titles = leaf.view.contentEl.querySelectorAll<HTMLElement>(".inline-title");
			titles.forEach((titleEl) => {
				const previous = titleEl.previousElementSibling;
				let iconEl =
					previous instanceof HTMLElement && previous.classList.contains(INLINE_ICON_CLASS)
						? previous
						: null;
				if (!resolved) {
					iconEl?.remove();
					return;
				}
				if (!iconEl) {
					iconEl = createSpan({ cls: `${ICON_CLASS} ${INLINE_ICON_CLASS}` });
					titleEl.parentElement?.insertBefore(iconEl, titleEl);
				}
				this.updateIconEl(iconEl, resolved);
			});
		});
	}

	/** Renders icon + color into the element, skipping work when nothing changed. */
	private updateIconEl(iconEl: HTMLElement, resolved: ResolvedIcon) {
		const key = `${resolved.icon}|${resolved.color ?? ""}`;
		if (iconEl.dataset.autoicons === key) {
			return;
		}
		iconEl.dataset.autoicons = key;
		renderIconInto(iconEl, resolved.icon);
		if (resolved.color) {
			iconEl.style.color = resolved.color;
		} else {
			iconEl.style.removeProperty("color");
		}
	}

	// ---------------------------------------------------------------- resolution

	/**
	 * Resolves the icon and color for a file or folder.
	 *
	 * Without color inheritance the item gets one icon from the first source
	 * that has one (per-item icon, frontmatter, first matching rule, default),
	 * and a color only from that same source or colorful icons. With color
	 * inheritance on, icon and color are resolved independently; see
	 * resolveInherited().
	 */
	resolveItem(path: string, isFolder: boolean): ResolvedIcon | null {
		return this.settings.colorInheritanceEnabled
			? this.resolveInherited(path, isFolder)
			: this.resolveLegacy(path, isFolder);
	}

	/**
	 * Inheriting resolution. The icon and the color are looked up separately,
	 * each taking the first level that sets it:
	 *
	 *   icon:  per-item icon > frontmatter icon > rules > default icons
	 *   color: frontmatter color > rules > colorful icons > none (theme color)
	 *
	 * Among rules, the first matching rule that sets an icon provides the icon
	 * and the first matching rule that sets a color provides the color; they can
	 * be different rules. A frontmatter icon of "none" still hides the icon
	 * entirely. A color with no icon to put it on renders nothing.
	 */
	private resolveInherited(path: string, isFolder: boolean): ResolvedIcon | null {
		const frontmatter =
			!isFolder && this.settings.frontmatterEnabled
				? this.app.metadataCache.getCache(path)?.frontmatter
				: undefined;

		// Icon: per-item icon, then frontmatter.
		const custom = this.settings.customIcons[path];
		let icon: string | null = custom ? this.resolveDisplayIcon(custom) : null;
		if (!icon && frontmatter) {
			const value: unknown = frontmatter[this.settings.frontmatterProperty];
			if (typeof value === "string") {
				const trimmed = value.trim();
				if (trimmed.toLowerCase() === "none") {
					return null;
				}
				icon = this.resolveDisplayIcon(trimmed);
			}
		}

		// Color: frontmatter. Unlike the non-inheriting mode, it does not need
		// a frontmatter icon next to it.
		let color: string | null = frontmatter
			? parseHexColor(frontmatter[this.settings.frontmatterColorProperty])
			: null;

		// Rules fill in whichever of icon and color is still unset.
		if (!icon || !color) {
			for (const rule of this.settings.rules) {
				if (!rule.pattern) {
					continue;
				}
				const ruleIcon = !icon && rule.icon ? this.resolveDisplayIcon(rule.icon) : null;
				const ruleColor = !color && rule.color ? rule.color : null;
				if (!ruleIcon && !ruleColor) {
					continue;
				}
				if (rule.target === "file" && isFolder) {
					continue;
				}
				if (rule.target === "folder" && !isFolder) {
					continue;
				}
				if (!this.ruleMatches(rule, path, isFolder)) {
					continue;
				}
				icon = icon ?? ruleIcon;
				color = color ?? ruleColor;
				if (icon && color) {
					break;
				}
			}
		}

		// Defaults: file type / folder / note icon, and the colorful palette.
		icon = icon ?? this.resolveDefaultIcon(path, isFolder);
		if (!icon) {
			return null;
		}
		if (!color && this.settings.colorfulIconsEnabled) {
			color = colorForPath(path, this.settings.colorPalette);
		}
		return { icon, color };
	}

	/**
	 * Original resolution, used while color inheritance is off. Priority: per-item
	 * icon (context menu), frontmatter (notes), custom rules in order, then
	 * file-type / default icons. The first source with an icon wins and brings
	 * its own color (if it has one), falling back to the colorful-icons color.
	 * A frontmatter value of "none" suppresses the icon entirely. The frontmatter
	 * color property is only honored together with a valid frontmatter icon, and
	 * a rule needs an icon to match.
	 */
	private resolveLegacy(path: string, isFolder: boolean): ResolvedIcon | null {
		const baseColor = this.settings.colorfulIconsEnabled
			? colorForPath(path, this.settings.colorPalette)
			: null;

		const custom = this.settings.customIcons[path];
		if (custom) {
			const icon = this.resolveDisplayIcon(custom);
			if (icon) {
				return { icon, color: baseColor };
			}
		}

		if (!isFolder && this.settings.frontmatterEnabled) {
			const frontmatter = this.app.metadataCache.getCache(path)?.frontmatter;
			const value: unknown = frontmatter?.[this.settings.frontmatterProperty];
			if (typeof value === "string") {
				const trimmed = value.trim();
				if (trimmed.toLowerCase() === "none") {
					return null;
				}
				const icon = this.resolveDisplayIcon(trimmed);
				if (icon) {
					// The note has a usable icon, so its color property (if any)
					// applies and wins over the colorful-icons palette.
					const color = parseHexColor(
						frontmatter?.[this.settings.frontmatterColorProperty]
					);
					return { icon, color: color ?? baseColor };
				}
			}
		}

		for (const rule of this.settings.rules) {
			if (!rule.pattern || !this.isKnownIcon(rule.icon)) {
				continue;
			}
			if (rule.target === "file" && isFolder) {
				continue;
			}
			if (rule.target === "folder" && !isFolder) {
				continue;
			}
			if (this.ruleMatches(rule, path, isFolder)) {
				const icon = this.resolveDisplayIcon(rule.icon);
				if (icon) {
					return { icon, color: rule.color ?? baseColor };
				}
			}
		}

		const icon = this.resolveDefaultIcon(path, isFolder);
		return icon ? { icon, color: baseColor } : null;
	}

	/**
	 * The lowest-priority icon: the folder icon for folders, otherwise the
	 * per-file-type icon, then the default note icon. Null when none applies
	 * (or the relevant default is turned off).
	 */
	private resolveDefaultIcon(path: string, isFolder: boolean): string | null {
		if (isFolder) {
			if (
				this.settings.folderIconEnabled &&
				this.isKnownIcon(this.settings.folderIcon)
			) {
				return this.resolveDisplayIcon(this.settings.folderIcon) ?? this.settings.folderIcon;
			}
			return null;
		}

		if (this.settings.typeIconsEnabled) {
			const name = (path.split("/").pop() ?? path).toLowerCase();
			const parts = name.split(".");
			if (parts.length > 1 && parts[0] !== "") {
				// Longest compound extension wins, e.g. "excalidraw.md" over "md".
				for (let i = 1; i < parts.length; i++) {
					const category = TYPE_ICONS[parts.slice(i).join(".")];
					if (category) {
						return resolveCategoryIcon(category);
					}
				}
			}
		}

		if (
			this.settings.noteIconEnabled &&
			path.toLowerCase().endsWith(".md") &&
			this.isKnownIcon(this.settings.noteIcon)
		) {
			return this.resolveDisplayIcon(this.settings.noteIcon) ?? this.settings.noteIcon;
		}

		return null;
	}

	private ruleMatches(rule: IconRule, path: string, isFolder: boolean): boolean {
		const name = path.split("/").pop() ?? path;
		switch (rule.matchType) {
			case "path": {
				const prefix = normalizePath(rule.pattern);
				return path === prefix || path.startsWith(prefix + "/");
			}
			case "extension": {
				if (isFolder || !name.includes(".")) {
					return false;
				}
				const target = rule.pattern.toLowerCase().replace(/^\./, "");
				const suffixes = name.toLowerCase().split(".").slice(1);
				// Match a bare segment (e.g. "excalidraw" in "sketch.excalidraw.md")
				// or a full compound suffix (e.g. "excalidraw.md"), so a rule for
				// either form catches the common "sketch.excalidraw.md" filename.
				if (suffixes.includes(target)) {
					return true;
				}
				return suffixes.some((_, i) => suffixes.slice(i).join(".") === target);
			}
			case "name":
				return name.toLowerCase().includes(rule.pattern.toLowerCase());
			case "tag": {
				if (isFolder) {
					return false;
				}
				const cache = this.app.metadataCache.getCache(path);
				if (!cache) {
					return false;
				}
				const tags = getAllTags(cache) ?? [];
				const target = "#" + rule.pattern.toLowerCase().replace(/^#/, "");
				return tags.some((tag) => {
					const lower = tag.toLowerCase();
					return lower === target || lower.startsWith(target + "/");
				});
			}
			case "regex":
				try {
					return new RegExp(rule.pattern).test(path);
				} catch {
					return false;
				}
		}
	}

	/**
	 * Validates against registered icon ids so a typo never injects an empty
	 * element (which would otherwise re-trigger the mutation observer forever).
	 */
	isKnownIcon(icon: string): boolean {
		return this.resolveDisplayIcon(icon) !== null;
	}

	/**
	 * Returns the renderable form of an icon value, or null if it can't be
	 * rendered: a registered icon id passes through, a bare Lucide name like
	 * "rocket" (which a user might type into frontmatter) is normalized to
	 * "lucide-rocket", and a short emoji string is accepted as-is.
	 */
	resolveDisplayIcon(icon: string): string | null {
		if (!icon) {
			return null;
		}
		if (this.knownIconIds === null || this.knownIconIds.size === 0) {
			this.knownIconIds = new Set(getIconIds());
		}
		if (this.knownIconIds.has(icon)) {
			return icon;
		}
		if (this.knownIconIds.has("lucide-" + icon)) {
			return "lucide-" + icon;
		}
		if (isEmojiIcon(icon)) {
			return icon;
		}
		return null;
	}
}
