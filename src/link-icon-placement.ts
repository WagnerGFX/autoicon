import { EditorView, ViewPlugin } from "@codemirror/view";

/**
 * Moves link-icon widgets from beside a link to inside it.
 *
 * Why this exists: in Live Preview, Obsidian renders a link as a CodeMirror
 * "mark" (<span class="cm-hmd-internal-link"><span class="cm-underline">…).
 * CodeMirror always renders a widget that sits at the edge of a mark as a
 * *sibling* of the mark's element, never as a child, and Obsidian's marks are
 * not something this plugin controls. So a widget decoration alone can never
 * end up inside the link element the way the icon does in Reading mode.
 *
 * The workaround: keep the icon a real CodeMirror widget (so CodeMirror still
 * owns it, skips it when reading text out of the DOM, and removes it through
 * WidgetType.destroy), and after each render move its element to be the first
 * child of the link's innermost wrapper element.
 */

/** The part of CodeMirror's (internal) DOM observer we rely on. */
interface DomObserver {
	/** Runs the function without CodeMirror treating its DOM changes as user edits. */
	ignore<T>(fn: () => T): T;
}

interface Placement {
	icon: HTMLElement;
	host: HTMLElement;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

function isElement(node: Node | null): node is HTMLElement {
	return node !== null && node.nodeType === ELEMENT_NODE;
}

/**
 * `view.observer` is not part of CodeMirror's public typings, but it has been
 * stable across the 6.x series. If it ever disappears we return null and the
 * icons simply stay where the widget put them (beside the link) instead of
 * risking CodeMirror re-rendering in a loop against our DOM changes.
 */
function getObserver(view: EditorView): DomObserver | null {
	const observer = (view as unknown as { observer?: Partial<DomObserver> }).observer;
	return typeof observer?.ignore === "function" ? (observer as DomObserver) : null;
}

function isHidden(el: HTMLElement): boolean {
	const win = el.ownerDocument.defaultView;
	return !!win && win.getComputedStyle(el).display === "none";
}

/** True for elements CodeMirror itself owns (replaced syntax, buffers). */
function isWidgetElement(el: HTMLElement): boolean {
	return el.getAttribute("contenteditable") === "false";
}

/**
 * Descends through leading wrapper elements to the element that directly
 * holds the link's first text, e.g. .cm-hmd-internal-link > .cm-underline.
 * Inserting there puts the icon inside every wrapper, so a style applied to
 * any of them (background, border-radius, padding, ...) also covers the icon.
 */
function innermostWrapper(el: HTMLElement): HTMLElement {
	let host = el;
	for (;;) {
		const first = host.firstChild;
		if (isElement(first) && first.nodeName !== "IMG" && !isWidgetElement(first)) {
			host = first;
		} else {
			return host;
		}
	}
}

/**
 * Finds the link element rendered right after an icon widget. Between the two
 * there are only CodeMirror's invisible helpers: cursor buffers and the
 * replaced "[[" syntax. The first visible element with text is the link.
 */
function findLinkHost(icon: HTMLElement, iconClass: string): HTMLElement | null {
	let node: Node | null = icon.nextSibling;
	while (node) {
		if (node.nodeType === TEXT_NODE) {
			if (node.textContent) {
				// Bare text with no wrapper element: nothing to move into.
				return null;
			}
		} else if (isElement(node)) {
			if (node.classList.contains(iconClass)) {
				return null; // reached the next link's icon
			}
			// Skip buffer images, the replaced "[[" widget and hidden syntax.
			if (node.textContent && !isHidden(node)) {
				return isWidgetElement(node) ? null : innermostWrapper(node);
			}
		}
		node = node.nextSibling;
	}
	return null;
}

/**
 * Registers the placement step for icon widgets carrying `iconClass`.
 * Runs in CodeMirror's measure cycle, which happens before the browser paints,
 * so the icon is never seen in its temporary position.
 */
export function linkIconPlacement(iconClass: string) {
	return ViewPlugin.fromClass(
		class {
			constructor(private readonly view: EditorView) {
				this.schedule();
			}

			update() {
				this.schedule();
			}

			private schedule() {
				this.view.requestMeasure<Placement[]>({
					key: this,
					read: (view) => {
						const placements: Placement[] = [];
						view.contentDOM.querySelectorAll<HTMLElement>(`.${iconClass}`).forEach((icon) => {
							const host = findLinkHost(icon, iconClass);
							if (host) {
								placements.push({ icon, host });
							}
						});
						return placements;
					},
					write: (placements, view) => {
						const observer = getObserver(view);
						if (!observer || placements.length === 0) {
							return;
						}
						observer.ignore(() => {
							for (const { icon, host } of placements) {
								host.insertBefore(icon, host.firstChild);
							}
						});
					},
				});
			}
		}
	);
}
