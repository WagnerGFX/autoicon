import { App, FuzzyMatch, FuzzySuggestModal, getIconIds } from "obsidian";
import { isEmojiIcon, renderIconInto } from "./icons";

/** Friendly label for an icon value, e.g. "rocket" for "lucide-rocket", or "📚". */
export function describeIconId(id: string): string {
	return id.replace(/^lucide-/, "");
}

/**
 * Fuzzy-search modal listing every icon registered in the app. Typing or
 * pasting an emoji offers it as the first suggestion so emoji can be used
 * anywhere an icon can.
 */
export class IconPickerModal extends FuzzySuggestModal<string> {
	private onChoose: (icon: string) => void;

	constructor(app: App, onChoose: (icon: string) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder("Search icons, or paste an emoji…");
	}

	getItems(): string[] {
		return getIconIds();
	}

	getItemText(item: string): string {
		return describeIconId(item);
	}

	getSuggestions(query: string): FuzzyMatch<string>[] {
		const suggestions = super.getSuggestions(query);
		const trimmed = query.trim();
		if (isEmojiIcon(trimmed)) {
			suggestions.unshift({
				item: trimmed,
				match: { score: Number.MAX_SAFE_INTEGER, matches: [] },
			});
		}
		return suggestions;
	}

	renderSuggestion(match: FuzzyMatch<string>, el: HTMLElement): void {
		super.renderSuggestion(match, el);
		el.addClass("autoicons-suggestion");
		const iconEl = createSpan({ cls: "autoicons-suggestion-icon" });
		renderIconInto(iconEl, match.item);
		el.prepend(iconEl);
	}

	onChooseItem(item: string): void {
		this.onChoose(item);
	}
}
