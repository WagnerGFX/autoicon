import { App, PluginSettingTab, Setting, setIcon } from "obsidian";
import type AutoIconsPlugin from "./main";
import { IconPickerModal } from "./icon-picker";
import { createRule, IconRule, RuleMatchType, RuleTarget } from "./settings";

export class AutoIconsSettingTab extends PluginSettingTab {
	plugin: AutoIconsPlugin;

	constructor(app: App, plugin: AutoIconsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

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
			.setDesc('Property name that holds the icon, e.g. "icon".')
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

		new Setting(containerEl)
			.setName("Default folder icon")
			.setDesc("Shown on every folder that has no matching rule.")
			.addButton((button) =>
				button
					.setButtonText(this.plugin.settings.folderIcon.replace(/^lucide-/, ""))
					.onClick(() => {
						new IconPickerModal(this.app, async (icon) => {
							this.plugin.settings.folderIcon = icon;
							await this.plugin.saveSettings();
							this.display();
						}).open();
					})
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.folderIconEnabled)
					.onChange(async (value) => {
						this.plugin.settings.folderIconEnabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Default note icon")
			.setDesc(
				"Shown on every note that has no frontmatter icon and no matching rule."
			)
			.addButton((button) =>
				button
					.setButtonText(this.plugin.settings.noteIcon.replace(/^lucide-/, ""))
					.onClick(() => {
						new IconPickerModal(this.app, async (icon) => {
							this.plugin.settings.noteIcon = icon;
							await this.plugin.saveSettings();
							this.display();
						}).open();
					})
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.noteIconEnabled)
					.onChange(async (value) => {
						this.plugin.settings.noteIconEnabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("Rules").setHeading();

		new Setting(containerEl)
			.setName("Custom rules")
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
						this.display();
					})
			);

		this.plugin.settings.rules.forEach((rule, index) => {
			this.renderRule(containerEl, rule, index);
		});
	}

	private renderRule(containerEl: HTMLElement, rule: IconRule, index: number) {
		const setting = new Setting(containerEl);
		setting.setClass("autoicons-rule");

		const preview = createSpan({ cls: "autoicons-rule-preview" });
		setting.nameEl.appendChild(preview);
		this.updatePreview(preview, rule.icon);

		setting
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						both: "Files and folders",
						file: "Files only",
						folder: "Folders only",
					})
					.setValue(rule.target)
					.onChange(async (value) => {
						rule.target = value as RuleTarget;
						await this.plugin.saveSettings();
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
					.onChange(async (value) => {
						rule.matchType = value as RuleMatchType;
						await this.plugin.saveSettings();
					})
			)
			.addText((text) =>
				text
					.setPlaceholder("Pattern")
					.setValue(rule.pattern)
					.onChange(async (value) => {
						rule.pattern = value;
						await this.plugin.saveSettings();
					})
			)
			.addButton((button) => {
				button
					.setButtonText(rule.icon ? rule.icon.replace(/^lucide-/, "") : "Pick icon")
					.onClick(() => {
						new IconPickerModal(this.app, async (icon) => {
							rule.icon = icon;
							await this.plugin.saveSettings();
							this.display();
						}).open();
					});
			})
			.addExtraButton((button) =>
				button
					.setIcon("arrow-up")
					.setTooltip("Move up")
					.setDisabled(index === 0)
					.onClick(async () => {
						const rules = this.plugin.settings.rules;
						[rules[index - 1], rules[index]] = [rules[index], rules[index - 1]];
						await this.plugin.saveSettings();
						this.display();
					})
			)
			.addExtraButton((button) =>
				button
					.setIcon("trash")
					.setTooltip("Delete rule")
					.onClick(async () => {
						this.plugin.settings.rules.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					})
			);
	}

	private updatePreview(preview: HTMLElement, icon: string) {
		preview.empty();
		if (this.plugin.isKnownIcon(icon)) {
			setIcon(preview, icon);
		}
	}
}
