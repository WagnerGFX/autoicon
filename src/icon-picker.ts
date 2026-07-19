import { App, FuzzyMatch, FuzzySuggestModal, getIconIds, setIcon } from "obsidian";

/** Fuzzy-search modal listing every icon registered in the app. */
export class IconPickerModal extends FuzzySuggestModal<string> {
	private onChoose: (icon: string) => void;

	constructor(app: App, onChoose: (icon: string) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder("Search icons…");
	}

	getItems(): string[] {
		return getIconIds();
	}

	getItemText(item: string): string {
		return item.replace(/^lucide-/, "");
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
