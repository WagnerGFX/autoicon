import {
	App,
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
	setIcon,
} from "obsidian";
import type AutoIconsPlugin from "./main";
import { IconPickerModal } from "./icon-picker";
import { ICON_PACKS } from "./icon-packs";
import { createRule, IconRule, RuleMatchType, RuleTarget } from "./settings";

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
				desc: 'Property name that holds the icon, e.g. "icon".',
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
				name: "Colorful icons",
				desc: "Assign each file and folder a color from a fixed palette, based on its path. The color stays the same every time — it won't change on reload.",
				control: {
					type: "toggle",
					key: "colorfulIconsEnabled",
					defaultValue: false,
				},
			},
			{
				type: "group",
				heading: "Icon packs",
				items: ICON_PACKS.map((pack, index) => ({
					name: pack.name,
					desc:
						index === 0
							? `${Object.keys(pack.icons).length} icons. Icons from enabled packs appear alongside Lucide's built-in icons in every icon picker; disabling a pack only hides it there — icons already assigned from it keep working.`
							: `${Object.keys(pack.icons).length} icons`,
					control: {
						type: "toggle" as const,
						key: `pack${pack.id[0].toUpperCase()}${pack.id.slice(1)}Enabled`,
						defaultValue: true,
					},
				})),
			},
			{
				type: "list",
				heading: "Rules",
				emptyState:
					"No rules yet. Add one to assign icons by path, extension, name, or regex. Rules are checked top to bottom; the first match wins.",
				addItem: {
					name: "Add rule",
					action: () => {
						this.plugin.settings.rules.push(createRule());
						void this.plugin.saveSettings();
						this.update();
					},
				},
				onDelete: (index) => {
					this.plugin.settings.rules.splice(index, 1);
					void this.plugin.saveSettings();
					this.update();
				},
				onReorder: (oldIndex, newIndex) => {
					const rules = this.plugin.settings.rules;
					const [moved] = rules.splice(oldIndex, 1);
					rules.splice(newIndex, 0, moved);
					void this.plugin.saveSettings();
					this.update();
				},
				items: this.plugin.settings.rules.map((rule, index) => ({
					name: `Rule ${index + 1}`,
					render: (setting: Setting) => this.renderRule(setting, rule),
				})),
			},
		];
	}

	private renderFallbackIcon(setting: Setting, kind: "folder" | "note") {
		const settings = this.plugin.settings;
		const iconKey = kind === "folder" ? "folderIcon" : "noteIcon";
		const enabledKey = kind === "folder" ? "folderIconEnabled" : "noteIconEnabled";
		setting
			.addButton((button) =>
				button
					.setButtonText(settings[iconKey].replace(/^lucide-/, "") || "Pick icon")
					.onClick(() => {
						new IconPickerModal(this.app, settings, (icon) => {
							settings[iconKey] = icon;
							void this.plugin.saveSettings();
							this.update();
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

	private renderRule(setting: Setting, rule: IconRule) {
		const preview = createSpan({ cls: "autoicons-rule-preview" });
		setting.nameEl.appendChild(preview);
		if (this.plugin.isKnownIcon(rule.icon)) {
			setIcon(preview, rule.icon);
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
					.setButtonText(
						rule.icon ? rule.icon.replace(/^lucide-/, "") : "Pick icon"
					)
					.onClick(() => {
						new IconPickerModal(this.app, this.plugin.settings, (icon) => {
							rule.icon = icon;
							void this.plugin.saveSettings();
							this.update();
						}).open();
					})
			);
	}
}
