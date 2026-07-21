import { App, FuzzyMatch, FuzzySuggestModal, getIconIds, setIcon } from "obsidian";
import { ICON_PACKS, packIdForIconId } from "./icon-packs";
import { isPackEnabled, type AutoIconsSettings } from "./settings";

const PACK_NAME_BY_ID = new Map(ICON_PACKS.map((pack) => [pack.id, pack.name]));

/** Fuzzy-search modal listing every icon registered in the app, filtered by enabled packs. */
export class IconPickerModal extends FuzzySuggestModal<string> {
	private settings: AutoIconsSettings;
	private onChoose: (icon: string) => void;

	constructor(app: App, settings: AutoIconsSettings, onChoose: (icon: string) => void) {
		super(app);
		this.settings = settings;
		this.onChoose = onChoose;
		this.setPlaceholder("Search icons…");
	}

	getItems(): string[] {
		return getIconIds().filter((id) => {
			const packId = packIdForIconId(id);
			return packId === null || isPackEnabled(this.settings, packId);
		});
	}

	getItemText(item: string): string {
		const packId = packIdForIconId(item);
		if (packId === null) {
			return item.replace(/^lucide-/, "");
		}
		const name = item.slice(packId.length + 1);
		return `${name} — ${PACK_NAME_BY_ID.get(packId)}`;
	}

	renderSuggestion(match: FuzzyMatch<string>, el: HTMLElement): void {
		super.renderSuggestion(match, el);
		el.addClass("autoicons-suggestion");
		const iconEl = createSpan({ cls: "autoicons-suggestion-icon" });
		setIcon(iconEl, match.item);
		el.prepend(iconEl);
	}

	onChooseItem(item: string): void {
		this.onChoose(item);
	}
}
