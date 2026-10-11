import { setIcon } from "obsidian";

/**
 * True when the value is a short emoji/pictographic string rather than an
 * icon id, e.g. "📚" or "🚀". Kept deliberately loose: anything short that
 * contains a pictographic character counts, so flag and ZWJ sequences work.
 */
export function isEmojiIcon(value: string): boolean {
	return (
		value.length > 0 &&
		value.length <= 16 &&
		// Regional_Indicator covers flag emoji, which are not Extended_Pictographic.
		/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(value)
	);
}

/** Renders an icon id via setIcon(), or an emoji as plain text, into the element. */
export function renderIconInto(el: HTMLElement, icon: string): void {
	if (isEmojiIcon(icon)) {
		el.empty();
		el.setText(icon);
	} else {
		setIcon(el, icon);
	}
}
