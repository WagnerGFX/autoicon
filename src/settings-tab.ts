import {
	App,
	ButtonComponent,
	ColorComponent,
	DropdownComponent,
	ExtraButtonComponent,
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
	TextComponent,
} from "obsidian";
import type AutoIconsPlugin from "./main";
import { describeIconId, IconPickerModal } from "./icon-picker";
import { renderIconInto } from "./icons";
import {
	createRule,
	DEFAULT_ICON_SIZE,
	IconRule,
	MAIN_COLORS,
	RuleMatchType,
	RuleTarget,
} from "./settings";

const COLOR_INHERITANCE_DESC =
	"When a color is not set, inherit it from the next level: frontmatter property, then rules, then colorful icons, then no color. Icons are inherited the same way, so a rule can set only an icon or only a color.";

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
		this.refreshDomState();
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "Frontmatter icons",
				desc: "Read the icon, and optionally its color, for a note from frontmatter properties. Frontmatter takes priority over rules and file type icons.",
				control: {
					type: "toggle",
					key: "frontmatterEnabled",
					defaultValue: true,
				},
			},
			{
				name: "Frontmatter icon property",
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
				name: "Frontmatter icon color property",
				desc: 'Property name that holds the icon color as a hex RGB or RGBA value, e.g. color: "#3b82f6" or "#3b82f66e". Only applied to notes that have a valid icon property, unless color inheritance is on.',
				control: {
					type: "text",
					key: "frontmatterColorProperty",
					defaultValue: "color",
					placeholder: "color",
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
						name: "Color inheritance",
						desc: COLOR_INHERITANCE_DESC,
						control: {
							type: "toggle",
							key: "colorInheritanceEnabled",
							defaultValue: false,
						},
					},
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
					"No rules yet. Add one to assign icons by path, extension, name, tag, or regex. Rules are checked top to bottom; the first match wins (with color inheritance on, the icon and the color each come from the first matching rule that sets them).",
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
					render: (setting: Setting) => this.renderRule(setting, rule, index),
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
					.setButtonText(describeIconId(settings[iconKey]) || "Pick icon")
					.onClick(() => {
						new IconPickerModal(this.app, (icon) => {
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
					this.update();
				})
		);
	}

	/**
	 * Lays a rule out as a compact two-part card instead of one long row:
	 *
	 *   [#][preview]  [target v] [match type v] [pattern ........]   [x][=]
	 *                 [icon ............][clear] [color][clear]
	 *
	 * Everything is built inside our own wrapper elements (see styles.css), which
	 * wrap and shrink, so the rule never overflows the settings pane however
	 * narrow it gets or however long a label or icon name is. Obsidian's own
	 * delete and drag-handle buttons are appended to the control element after
	 * this runs and are positioned by the same stylesheet.
	 */
	private renderRule(setting: Setting, rule: IconRule, index: number) {
		const { settingEl, nameEl, controlEl } = setting;
		settingEl.addClass("autoicons-rule");

		// Leading badge: rule number (its priority) and a preview of the result.
		nameEl.empty();
		nameEl.setAttr(
			"title",
			`Rule ${index + 1}. Rules are checked top to bottom; the first match wins.`
		);
		nameEl.createSpan({ cls: "autoicons-rule-number", text: String(index + 1) });
		const preview = nameEl.createSpan({ cls: "autoicons-rule-preview" });
		this.renderRulePreview(preview, rule);

		const body = controlEl.createDiv({ cls: "autoicons-rule-body" });
		// "When": what the rule matches.
		const when = body.createDiv({ cls: "autoicons-rule-when" });
		// "Then": what the rule applies.
		const then = body.createDiv({ cls: "autoicons-rule-then" });

		const target = new DropdownComponent(when)
			.addOptions({
				both: "Files and folders",
				file: "Files only",
				folder: "Folders only",
			})
			.setValue(rule.target)
			.onChange((value) => {
				rule.target = value as RuleTarget;
				void this.plugin.saveSettings();
				labelSelect(target);
			});
		labelSelect(target);

		const matchType = new DropdownComponent(when)
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
				labelSelect(matchType);
			});
		labelSelect(matchType);

		const pattern = new TextComponent(when)
			.setPlaceholder("Pattern")
			.setValue(rule.pattern)
			.onChange((value) => {
				rule.pattern = value;
				void this.plugin.saveSettings();
			});
		pattern.inputEl.addClass("autoicons-rule-pattern");

		// Icon: a fixed-size button whose label is truncated, so picking a long
		// icon name can no longer push the other controls out of the row.
		const iconPair = then.createDiv({ cls: "autoicons-rule-pair autoicons-rule-icon-pair" });
		const iconName = rule.icon ? describeIconId(rule.icon) : "";
		const iconButton = new ButtonComponent(iconPair).onClick(() => {
			new IconPickerModal(this.app, (icon) => {
				rule.icon = icon;
				void this.plugin.saveSettings();
				this.update();
			}).open();
		});
		iconButton.buttonEl.addClass("autoicons-rule-icon-button");
		iconButton.buttonEl.toggleClass("is-empty", !iconName);
		iconButton.buttonEl.createSpan({
			cls: "autoicons-rule-icon-label",
			text: iconName || "Pick icon",
		});
		iconButton.buttonEl.setAttr("title", iconName ? `Icon: ${iconName}` : "Pick an icon");
		iconButton.buttonEl.setAttr("aria-label", iconName ? `Icon: ${iconName}` : "Pick an icon");

		const clearIcon = new ExtraButtonComponent(iconPair)
			.setIcon("eraser")
			.setTooltip("Clear icon (color-only rule, needs color inheritance)")
			.setDisabled(!rule.icon)
			.onClick(() => {
				rule.icon = "";
				void this.plugin.saveSettings();
				this.update();
			});
		clearIcon.extraSettingsEl.addClass("autoicons-rule-action");

		// Color.
		const colorPair = then.createDiv({ cls: "autoicons-rule-pair autoicons-rule-color-pair" });
		new ColorComponent(colorPair)
			.setValue(rule.color ?? "#888888")
			.onChange((value) => {
				rule.color = value;
				void this.plugin.saveSettings();
				this.updatePreviewColor(setting, rule);
			});

		const clearColor = new ExtraButtonComponent(colorPair)
			.setIcon("paint-bucket")
			.setTooltip("Clear color (inherit from colorful icons / theme default)")
			.onClick(() => {
				delete rule.color;
				void this.plugin.saveSettings();
				this.update();
			});
		clearColor.extraSettingsEl.addClass("autoicons-rule-action");
	}

	/**
	 * Draws the small preview next to a rule: its icon in its color. A rule with
	 * a color but no icon (possible with color inheritance) gets a placeholder
	 * swatch so the color is still visible.
	 */
	private renderRulePreview(preview: HTMLElement, rule: IconRule) {
		preview.empty();
		preview.style.removeProperty("color");
		const icon =
			this.plugin.resolveDisplayIcon(rule.icon) ?? (rule.color ? "lucide-circle" : null);
		if (!icon) {
			return;
		}
		renderIconInto(preview, icon);
		if (rule.color) {
			preview.style.color = rule.color;
		}
	}

	private updatePreviewColor(setting: Setting, rule: IconRule) {
		const preview = setting.nameEl.querySelector<HTMLElement>(".autoicons-rule-preview");
		if (preview) {
			this.renderRulePreview(preview, rule);
		}
	}
}

/**
 * Mirrors a dropdown's selected label into its tooltip. A narrow rule may have
 * to truncate the text shown in the dropdown, so the full label stays
 * available on hover.
 */
function labelSelect(dropdown: DropdownComponent): void {
	const label = dropdown.selectEl.selectedOptions[0]?.text ?? "";
	dropdown.selectEl.setAttr("title", label);
}
