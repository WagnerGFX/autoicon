import { getIconIds, normalizePath, Plugin, setIcon } from "obsidian";
import { IconPickerModal } from "./icon-picker";
import { registerIconPacks, unregisterIconPacks } from "./icon-packs";
import {
	AutoIconsSettings,
	colorForPath,
	DEFAULT_SETTINGS,
	IconRule,
	resolveCategoryIcon,
	TYPE_ICONS,
} from "./settings";
import { AutoIconsSettingTab } from "./settings-tab";

const ICON_CLASS = "autoicons-icon";

export default class AutoIconsPlugin extends Plugin {
	settings: AutoIconsSettings;

	private observers: MutationObserver[] = [];
	private refreshTimeout: number | null = null;
	private knownIconIds: Set<string> | null = null;

	async onload() {
		registerIconPacks();
		await this.loadSettings();

		this.addSettingTab(new AutoIconsSettingTab(this.app, this));

		this.addCommand({
			id: "set-icon",
			name: "Set icon for current file",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) {
					return false;
				}
				if (!checking) {
					new IconPickerModal(this.app, this.settings, (icon) => {
						void this.app.fileManager.processFrontMatter(
							file,
							(frontmatter: Record<string, unknown>) => {
								frontmatter[this.settings.frontmatterProperty] = icon;
							}
						);
					}).open();
				}
				return true;
			},
		});

		this.addCommand({
			id: "remove-icon",
			name: "Remove icon from current file",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				const property = this.settings.frontmatterProperty;
				const frontmatter = file
					? this.app.metadataCache.getFileCache(file)?.frontmatter
					: undefined;
				if (!file || frontmatter?.[property] === undefined) {
					return false;
				}
				if (!checking) {
					void this.app.fileManager.processFrontMatter(
						file,
						(fm: Record<string, unknown>) => {
							delete fm[property];
						}
					);
				}
				return true;
			},
		});

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
			this.app.metadataCache.on("changed", () => {
				if (this.settings.frontmatterEnabled) {
					this.scheduleRefresh();
				}
			})
		);

		this.registerEvent(this.app.vault.on("create", () => this.scheduleRefresh()));
		this.registerEvent(this.app.vault.on("rename", () => this.scheduleRefresh()));
		this.registerEvent(this.app.vault.on("delete", () => this.scheduleRefresh()));
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
		unregisterIconPacks();
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<AutoIconsSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
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
				this.setItemIcon(titleEl, this.resolveIcon(path, isFolder), path);
			});
		}
	}

	private setItemIcon(titleEl: HTMLElement, icon: string | null, path: string) {
		let iconEl = titleEl.querySelector<HTMLElement>(`:scope > .${ICON_CLASS}`);
		if (!icon) {
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
		if (iconEl.dataset.autoiconsIcon !== icon) {
			iconEl.dataset.autoiconsIcon = icon;
			setIcon(iconEl, icon);
		}
		if (this.settings.colorfulIconsEnabled) {
			iconEl.style.color = colorForPath(path);
		} else {
			iconEl.style.removeProperty("color");
		}
	}

	/** Priority: frontmatter property, then custom rules in order, then file type. */
	resolveIcon(path: string, isFolder: boolean): string | null {
		if (!isFolder && this.settings.frontmatterEnabled) {
			const frontmatter = this.app.metadataCache.getCache(path)?.frontmatter;
			const value: unknown = frontmatter?.[this.settings.frontmatterProperty];
			if (typeof value === "string" && this.isKnownIcon(value.trim())) {
				return value.trim();
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
				return rule.icon;
			}
		}

		if (isFolder) {
			if (
				this.settings.folderIconEnabled &&
				this.isKnownIcon(this.settings.folderIcon)
			) {
				return this.settings.folderIcon;
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
						return resolveCategoryIcon(category, this.settings.activeIconStyle);
					}
				}
			}
		}

		if (
			this.settings.noteIconEnabled &&
			path.toLowerCase().endsWith(".md") &&
			this.isKnownIcon(this.settings.noteIcon)
		) {
			return this.settings.noteIcon;
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
				if (isFolder) {
					return false;
				}
				const extension = name.includes(".")
					? name.split(".").pop()?.toLowerCase()
					: undefined;
				return extension === rule.pattern.toLowerCase().replace(/^\./, "");
			}
			case "name":
				return name.toLowerCase().includes(rule.pattern.toLowerCase());
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
		if (!icon) {
			return false;
		}
		if (this.knownIconIds === null || this.knownIconIds.size === 0) {
			this.knownIconIds = new Set(getIconIds());
		}
		return (
			this.knownIconIds.has(icon) || this.knownIconIds.has("lucide-" + icon)
		);
	}
}
