import type { IconPackId } from "./icon-packs";

export type RuleTarget = "file" | "folder" | "both";
export type RuleMatchType = "path" | "extension" | "name" | "tag" | "regex";

export interface IconRule {
	id: string;
	target: RuleTarget;
	matchType: RuleMatchType;
	pattern: string;
	icon: string;
	/** Optional fixed color for icons this rule assigns; overrides colorful icons. */
	color?: string;
}

export type IconStyle = "lucide" | IconPackId;

export interface AutoIconsSettings {
	frontmatterEnabled: boolean;
	/** Frontmatter property holding the icon. */
	frontmatterProperty: string;
	/** Frontmatter property holding the icon's hex color (only read when the icon property is valid). */
	frontmatterColorProperty: string;
	typeIconsEnabled: boolean;
	activeIconStyle: IconStyle;
	folderIconEnabled: boolean;
	folderIcon: string;
	noteIconEnabled: boolean;
	noteIcon: string;
	rules: IconRule[];
	/** Per-item icons assigned via the context menu, keyed by vault path (folders and non-note files). */
	customIcons: Record<string, string>;
	colorfulIconsEnabled: boolean;
	colorPalette: string[];
	tabIconsEnabled: boolean;
	inlineTitleIconsEnabled: boolean;
	linkIconsEnabled: boolean;
	/** Icon size in pixels for all icons the plugin renders. */
	iconSize: number;
}

export const DEFAULT_ICON_SIZE = 16;

export const DEFAULT_SETTINGS: AutoIconsSettings = {
	frontmatterEnabled: true,
	frontmatterProperty: "icon",
	frontmatterColorProperty: "color",
	typeIconsEnabled: true,
	activeIconStyle: "lucide",
	folderIconEnabled: true,
	folderIcon: "lucide-folder",
	noteIconEnabled: true,
	noteIcon: "lucide-file-text",
	rules: [],
	customIcons: {},
	colorfulIconsEnabled: false,
	colorPalette: [],
	tabIconsEnabled: true,
	inlineTitleIconsEnabled: true,
	linkIconsEnabled: true,
	iconSize: DEFAULT_ICON_SIZE,
};

/** The semantic category behind each per-extension default icon, folder icon, and note icon. */
export type IconCategory =
	| "image"
	| "audio"
	| "video"
	| "document"
	| "canvas"
	| "drawing"
	| "list"
	| "code"
	| "archive"
	| "table"
	| "folder";

const LUCIDE_CATEGORY_ICONS: Record<IconCategory, string> = {
	image: "image",
	audio: "file-audio",
	video: "file-video",
	document: "file-text",
	canvas: "layout-dashboard",
	drawing: "pencil-ruler",
	list: "layout-list",
	code: "file-code",
	archive: "archive",
	table: "table",
	folder: "folder",
};

/**
 * Bare (unprefixed) icon names within each bundled pack for each category.
 * Verified to exist in the generated pack data (see scripts/generate-icon-packs.mjs).
 * A pack that lacks a suitable icon for a category simply omits that key —
 * resolveCategoryIcon() then falls back to the Lucide icon for it.
 */
const PACK_CATEGORY_ICONS: Record<IconPackId, Partial<Record<IconCategory, string>>> = {
	uil: {
		image: "image",
		audio: "music",
		video: "video",
		document: "file-alt",
		canvas: "dashboard",
		drawing: "edit-alt",
		list: "list-ul",
		code: "code",
		archive: "archive",
		table: "table",
		folder: "folder",
	},
	uim: {
		image: "image-v",
		document: "document-layout-center",
		canvas: "apps",
		list: "list-ul",
		archive: "box",
		table: "table",
	},
	cuida: {
		image: "image-outline",
		audio: "headphone-outline",
		video: "videocam-outline",
		document: "document-outline",
		canvas: "dashboard-outline",
		drawing: "edit-outline",
		list: "list-outline",
		archive: "box-outline",
		table: "grid-outline",
	},
	msout: {
		image: "image",
		audio: "headphones",
		video: "movie",
		document: "description",
		canvas: "dashboard",
		drawing: "draw",
		list: "list",
		code: "code",
		archive: "archive",
		table: "table",
		folder: "folder",
	},
};

/**
 * Resolves a category to an icon id for the given active style, falling back
 * to Lucide. Also falls back for an unrecognized style value — e.g. stored
 * settings referencing a pack from a future version that no longer exists —
 * rather than throwing.
 */
export function resolveCategoryIcon(category: IconCategory, style: IconStyle): string {
	const name = PACK_CATEGORY_ICONS[style as IconPackId]?.[category];
	if (name) {
		return `${style}-${name}`;
	}
	return `lucide-${LUCIDE_CATEGORY_ICONS[category]}`;
}

/**
 * The default palette of primary/secondary hues ("main colors") used for
 * the colorful icons feature. Each item gets one color, chosen
 * deterministically from its path so it stays stable across reloads instead
 * of re-rolling on every repaint. Users can override the palette in settings;
 * an empty stored palette means "use these defaults".
 */
export const MAIN_COLORS: string[] = [
	"#e53935", // red
	"#fb8c00", // orange
	"#fdd835", // yellow
	"#43a047", // green
	"#00897b", // teal
	"#1e88e5", // blue
	"#8e24aa", // purple
	"#d81b60", // pink
];

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Validates a frontmatter color value: a hex RGB or RGBA string such as
 * "#3b82f6", "#3b82f66e", "#38f" or "#38f6". Returns the trimmed value ready
 * to use as a CSS color, or null for anything else (non-strings, named colors,
 * malformed hex), so a bad value never produces a broken style.
 */
export function parseHexColor(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	return HEX_COLOR.test(trimmed) ? trimmed : null;
}

export function colorForPath(path: string, palette: string[]): string {
	const colors = palette.length > 0 ? palette : MAIN_COLORS;
	let hash = 0;
	for (let i = 0; i < path.length; i++) {
		hash = (hash * 31 + path.charCodeAt(i)) | 0;
	}
	return colors[Math.abs(hash) % colors.length];
}

/**
 * Category applied per file extension when "Default icons by file type" is
 * enabled. Resolved to an actual icon id via resolveCategoryIcon() using the
 * active icon style, so switching styles re-skins every one of these at once.
 */
export const TYPE_ICONS: Record<string, IconCategory> = {
	png: "image",
	jpg: "image",
	jpeg: "image",
	gif: "image",
	svg: "image",
	webp: "image",
	bmp: "image",
	avif: "image",
	mp3: "audio",
	wav: "audio",
	ogg: "audio",
	flac: "audio",
	m4a: "audio",
	"3gp": "audio",
	mp4: "video",
	webm: "video",
	mov: "video",
	mkv: "video",
	avi: "video",
	pdf: "document",
	canvas: "canvas",
	excalidraw: "drawing",
	"excalidraw.md": "drawing",
	base: "list",
	js: "code",
	ts: "code",
	css: "code",
	html: "code",
	json: "code",
	yaml: "code",
	yml: "code",
	xml: "code",
	py: "code",
	zip: "archive",
	rar: "archive",
	"7z": "archive",
	csv: "table",
	xlsx: "table",
};

export function createRule(): IconRule {
	return {
		id: crypto.randomUUID(),
		target: "both",
		matchType: "path",
		pattern: "",
		icon: "",
	};
}
