import { App, FuzzyMatch, FuzzySuggestModal, getIconIds } from "obsidian";
import { ICON_PACKS, isEmojiIcon, packIdForIconId, renderIconInto } from "./icon-packs";

const PACK_NAME_BY_ID = new Map(ICON_PACKS.map((pack) => [pack.id, pack.name]));

/** Friendly label for an icon value, e.g. "folder — Material Symbols (Outlined)", "rocket", or "📚". */
export function describeIconId(id: string): string {
	const packId = packIdForIconId(id);
	if (packId === null) {
		return id.replace(/^lucide-/, "");
	}
	const name = id.slice(packId.length + 1);
	return `${name} — ${PACK_NAME_BY_ID.get(packId)}`;
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
