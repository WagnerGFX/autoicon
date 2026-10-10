import {
	App,
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
} from "obsidian";
import type AutoIconsPlugin from "./main";
import { describeIconId, IconPickerModal } from "./icon-picker";
import { ICON_PACKS, renderIconInto } from "./icon-packs";
import {
	createRule,
	DEFAULT_ICON_SIZE,
	IconRule,
	IconStyle,
	MAIN_COLORS,
	resolveCategoryIcon,
	RuleMatchType,
	RuleTarget,
} from "./settings";

export class AutoIconsSettingTab extends PluginSettingTab {
	plugin: AutoIconsPlugin;

	constructor(app: App, plugin: AutoIconsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.icon = "lucide-wand-sparkles";
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		await super.setControlValue(key, value);
		this.plugin.scheduleRefresh();
		if (typeof this.refreshDomState === "function") {
			this.refreshDomState();
		}
	}

	/**
	 * update() only exists on Obsidian versions that support the declarative
	 * settings API — the same versions that call getSettingDefinitions() in
	 * the first place. Helpers shared with the display() fallback (below) use
	 * this instead of calling either directly, so they work correctly
	 * whichever rendering path the running app actually uses.
	 */
	private refreshSettingsView(): void {
		if (typeof this.update === "function") {
			this.update();
		} else {
			this.display();
		}
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "Frontmatter icons",
				desc: "Read the icon for a note from a frontmatter property. Frontmatter takes priority over rules and file type icons.",
				control: {
					type: "toggle",
					key: "frontmatterEnabled",
					defaultValue: true,
				},
			},
			{
				name: "Frontmatter property",
				desc: 'Property name that holds the icon, e.g. "icon". Set the property to "none" in a note to hide its icon entirely.',
				control: {
					type: "text",
					key: "frontmatterProperty",
					defaultValue: "icon",
					placeholder: "icon",
					validate: (value: string) =>
						value.trim() ? undefined : "Property name cannot be empty.",
					disabled: () => !this.plugin.settings.frontmatterEnabled,
				},
			},
			{
				name: "Default icons by file type",
				desc: "Show a generic icon for common file types such as images, audio, video, PDF, and code files.",
				control: {
					type: "toggle",
					key: "typeIconsEnabled",
					defaultValue: true,
				},
			},
			{
				name: "Icon style",
				desc: "Choose which icon set powers the automatic file-type, folder, and note icons below. Frontmatter and custom rules can still use any icon from any pack, regardless of this setting.",
				render: (setting) => this.renderIconStyle(setting),
			},
			{
				name: "Default folder icon",
				desc: "Shown on every folder that has no matching rule.",
				render: (setting) => this.renderFallbackIcon(setting, "folder"),
			},
			{
				name: "Default note icon",
				desc: "Shown on every note that has no frontmatter icon and no matching rule.",
				render: (setting) => this.renderFallbackIcon(setting, "note"),
			},
			{
				name: "Icon size",
				desc: "Size of the icons the plugin renders, in pixels.",
				control: {
					type: "slider",
					key: "iconSize",
					defaultValue: DEFAULT_ICON_SIZE,
					min: 12,
					max: 32,
					step: 1,
					displayFormat: (value: number) => `${value}px`,
				},
			},
			{
				type: "group",
				heading: "Where icons appear",
				items: [
					{
						name: "Tab headers",
						desc: "Show each open file's icon in its tab header.",
						control: {
							type: "toggle",
							key: "tabIconsEnabled",
							defaultValue: true,
						},
					},
					{
						name: "Inline titles",
						desc: "Show the note's icon next to its inline title.",
						control: {
							type: "toggle",
							key: "inlineTitleIconsEnabled",
							defaultValue: true,
						},
					},
					{
						name: "Links in notes",
						desc: "Show the target note's icon on internal links, in both Live Preview and reading view. Reading view updates as notes are (re)rendered.",
						control: {
							type: "toggle",
							key: "linkIconsEnabled",
							defaultValue: true,
						},
					},
				],
			},
			{
				type: "group",
				heading: "Colors",
				items: [
					{
						name: "Colorful icons",
						desc: "Assign each file and folder a color from the palette below, based on its path. The color stays the same every time — it won't change on reload.",
						control: {
							type: "toggle",
							key: "colorfulIconsEnabled",
							defaultValue: false,
						},
					},
					{
						name: "Palette",
						desc: "Colors used by colorful icons.",
						visible: () => this.plugin.settings.colorfulIconsEnabled,
						render: (setting: Setting) => this.renderPalette(setting),
					},
				],
			},
			{
				type: "list",
				heading: "Rules",
				emptyState:
					"No rules yet. Add one to assign icons by path, extension, name, tag, or regex. Rules are checked top to bottom; the first match wins.",
				addItem: {
					name: "Add rule",
					action: () => {
						this.plugin.settings.rules.push(createRule());
						void this.plugin.saveSettings();
						this.refreshSettingsView();
					},
				},
				onDelete: (index) => {
					this.plugin.settings.rules.splice(index, 1);
					void this.plugin.saveSettings();
					this.refreshSettingsView();
				},
				onReorder: (oldIndex, newIndex) => {
					const rules = this.plugin.settings.rules;
					const [moved] = rules.splice(oldIndex, 1);
					rules.splice(newIndex, 0, moved);
					void this.plugin.saveSettings();
					this.refreshSettingsView();
				},
				items: this.plugin.settings.rules.map((rule, index) => ({
					name: `Rule ${index + 1}`,
					render: (setting: Setting) => this.renderRule(setting, rule),
				})),
			},
		];
	}

	/**
	 * Fallback for Obsidian versions that don't invoke getSettingDefinitions().
	 * Per Obsidian's own docs, display() is simply never called when
	 * getSettingDefinitions() returns a non-empty array, so this only runs on
	 * older apps — otherwise the settings pane renders blank on them, since
	 * the inherited base display() is a no-op.
	 */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Frontmatter icons")
			.setDesc(
				"Read the icon for a note from a frontmatter property. Frontmatter takes priority over rules and file type icons."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.frontmatterEnabled)
					.onChange(async (value) => {
						this.plugin.settings.frontmatterEnabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Frontmatter property")
			.setDesc(
				'Property name that holds the icon, e.g. "icon". Set the property to "none" in a note to hide its icon entirely.'
			)
			.addText((text) =>
				text
					.setPlaceholder("icon")
					.setValue(this.plugin.settings.frontmatterProperty)
					.onChange(async (value) => {
						this.plugin.settings.frontmatterProperty = value.trim() || "icon";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Default icons by file type")
			.setDesc(
				"Show a generic icon for common file types such as images, audio, video, PDF, and code files."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.typeIconsEnabled)
					.onChange(async (value) => {
						this.plugin.settings.typeIconsEnabled = value;
						await this.plugin.saveSettings();
					})
			);

		this.renderIconStyle(
			new Setting(containerEl)
				.setName("Icon style")
				.setDesc(
					"Choose which icon set powers the automatic file-type, folder, and note icons below. Frontmatter and custom rules can still use any icon from any pack, regardless of this setting."
				)
		);

		this.renderFallbackIcon(
			new Setting(containerEl)
				.setName("Default folder icon")
				.setDesc("Shown on every folder that has no matching rule."),
			"folder"
		);

		this.renderFallbackIcon(
			new Setting(containerEl)
				.setName("Default note icon")
				.setDesc(
					"Shown on every note that has no frontmatter icon and no matching rule."
				),
			"note"
		);

		new Setting(containerEl)
			.setName("Icon size")
			.setDesc("Size of the icons the plugin renders, in pixels.")
			.addSlider((slider) =>
				slider
					.setLimits(12, 32, 1)
					.setValue(this.plugin.settings.iconSize)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.iconSize = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("Where icons appear").setHeading();

		new Setting(containerEl)
			.setName("Tab headers")
			.setDesc("Show each open file's icon in its tab header.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.tabIconsEnabled)
					.onChange(async (value) => {
						this.plugin.settings.tabIconsEnabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Inline titles")
			.setDesc("Show the note's icon next to its inline title.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.inlineTitleIconsEnabled)
					.onChange(async (value) => {
						this.plugin.settings.inlineTitleIconsEnabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Links in notes")
			.setDesc(
				"Show the target note's icon on internal links, in both Live Preview and reading view. Reading view updates as notes are (re)rendered."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.linkIconsEnabled)
					.onChange(async (value) => {
						this.plugin.settings.linkIconsEnabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("Colors").setHeading();

		new Setting(containerEl)
			.setName("Colorful icons")
			.setDesc(
				"Assign each file and folder a color from the palette below, based on its path. The color stays the same every time — it won't change on reload."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.colorfulIconsEnabled)
					.onChange(async (value) => {
						this.plugin.settings.colorfulIconsEnabled = value;
						await this.plugin.saveSettings();
					})
			);

		this.renderPalette(
			new Setting(containerEl)
				.setName("Palette")
				.setDesc("Colors used by colorful icons.")
		);

		new Setting(containerEl).setName("Rules").setHeading();
		new Setting(containerEl)
			.setDesc(
				"Rules are checked top to bottom; the first match wins. A path rule also applies to everything inside the matched folder."
			)
			.addButton((button) =>
				button
					.setButtonText("Add rule")
					.setCta()
					.onClick(async () => {
						this.plugin.settings.rules.push(createRule());
						await this.plugin.saveSettings();
						this.refreshSettingsView();
					})
			);

		this.plugin.settings.rules.forEach((rule, index) => {
			const setting = new Setting(containerEl).setName(`Rule ${index + 1}`);
			this.renderRule(setting, rule);
			setting
				.addExtraButton((button) =>
					button
						.setIcon("arrow-up")
						.setTooltip("Move up")
						.setDisabled(index === 0)
						.onClick(async () => {
							const rules = this.plugin.settings.rules;
							[rules[index - 1], rules[index]] = [rules[index], rules[index - 1]];
							await this.plugin.saveSettings();
							this.refreshSettingsView();
						})
				)
				.addExtraButton((button) =>
					button
						.setIcon("trash")
						.setTooltip("Delete rule")
						.onClick(async () => {
							this.plugin.settings.rules.splice(index, 1);
							await this.plugin.saveSettings();
							this.refreshSettingsView();
						})
				);
		});
	}

	/** Sets activeIconStyle and re-derives the folder/note default icons from it. */
	private async applyIconStyle(style: IconStyle): Promise<void> {
		const settings = this.plugin.settings;
		settings.activeIconStyle = style;
		settings.folderIcon = resolveCategoryIcon("folder", style);
		settings.noteIcon = resolveCategoryIcon("document", style);
		await this.plugin.saveSettings();
	}

	private renderIconStyle(setting: Setting) {
		setting.addDropdown((dropdown) => {
			dropdown.addOption("lucide", "Lucide (default)");
			for (const pack of ICON_PACKS) {
				dropdown.addOption(pack.id, pack.name);
			}
			dropdown
				.setValue(this.plugin.settings.activeIconStyle)
				.onChange(async (value) => {
					await this.applyIconStyle(value as IconStyle);
					this.refreshSettingsView();
				});
		});
	}

	private renderFallbackIcon(setting: Setting, kind: "folder" | "note") {
		const settings = this.plugin.settings;
		const iconKey = kind === "folder" ? "folderIcon" : "noteIcon";
		const enabledKey = kind === "folder" ? "folderIconEnabled" : "noteIconEnabled";
		setting
			.addButton((button) =>
				button
					.setButtonText(describeIconId(settings[iconKey]) || "Pick icon")
					.onClick(() => {
						new IconPickerModal(this.app, (icon) => {
							settings[iconKey] = icon;
							void this.plugin.saveSettings();
							this.refreshSettingsView();
						}).open();
					})
			)
			.addToggle((toggle) =>
				toggle.setValue(settings[enabledKey]).onChange((value) => {
					settings[enabledKey] = value;
					void this.plugin.saveSettings();
				})
			);
	}

	private renderPalette(setting: Setting) {
		const settings = this.plugin.settings;
		const palette = settings.colorPalette.length > 0 ? settings.colorPalette : [...MAIN_COLORS];
		palette.forEach((color, index) => {
			setting.addColorPicker((picker) =>
				picker.setValue(color).onChange((value) => {
					if (settings.colorPalette.length === 0) {
						settings.colorPalette = [...MAIN_COLORS];
					}
					settings.colorPalette[index] = value;
					void this.plugin.saveSettings();
				})
			);
		});
		setting.addExtraButton((button) =>
			button
				.setIcon("rotate-ccw")
				.setTooltip("Reset palette")
				.onClick(() => {
					settings.colorPalette = [];
					void this.plugin.saveSettings();
					this.refreshSettingsView();
				})
		);
	}

	private renderRule(setting: Setting, rule: IconRule) {
		const preview = createSpan({ cls: "autoicons-rule-preview" });
		setting.nameEl.appendChild(preview);
		const previewIcon = this.plugin.resolveDisplayIcon(rule.icon);
		if (previewIcon) {
			renderIconInto(preview, previewIcon);
			if (rule.color) {
				preview.style.color = rule.color;
			}
		}

		setting
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						both: "Files and folders",
						file: "Files only",
						folder: "Folders only",
					})
					.setValue(rule.target)
					.onChange((value) => {
						rule.target = value as RuleTarget;
						void this.plugin.saveSettings();
					})
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						path: "Path starts with",
						extension: "Extension is",
						name: "Name contains",
						tag: "Has tag",
						regex: "Path matches regex",
					})
					.setValue(rule.matchType)
					.onChange((value) => {
						rule.matchType = value as RuleMatchType;
						void this.plugin.saveSettings();
					})
			)
			.addText((text) =>
				text
					.setPlaceholder("Pattern")
					.setValue(rule.pattern)
					.onChange((value) => {
						rule.pattern = value;
						void this.plugin.saveSettings();
					})
			)
			.addButton((button) =>
				button
					.setButtonText(rule.icon ? describeIconId(rule.icon) : "Pick icon")
					.onClick(() => {
						new IconPickerModal(this.app, (icon) => {
							rule.icon = icon;
							void this.plugin.saveSettings();
							this.refreshSettingsView();
						}).open();
					})
			)
			.addColorPicker((picker) =>
				picker.setValue(rule.color ?? "#888888").onChange((value) => {
					rule.color = value;
					void this.plugin.saveSettings();
					this.updatePreviewColor(setting, rule);
				})
			)
			.addExtraButton((button) =>
				button
					.setIcon("paint-bucket")
					.setTooltip("Clear color (use colorful icons / theme default)")
					.onClick(() => {
						delete rule.color;
						void this.plugin.saveSettings();
						this.refreshSettingsView();
					})
			);
	}

	private updatePreviewColor(setting: Setting, rule: IconRule) {
		const preview = setting.nameEl.querySelector<HTMLElement>(".autoicons-rule-preview");
		if (preview) {
			if (rule.color) {
				preview.style.color = rule.color;
			} else {
				preview.style.removeProperty("color");
			}
		}
	}
}
