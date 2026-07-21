import type { IconPackId } from "./icon-packs";

export type RuleTarget = "file" | "folder" | "both";
export type RuleMatchType = "path" | "extension" | "name" | "regex";

export interface IconRule {
	id: string;
	target: RuleTarget;
	matchType: RuleMatchType;
	pattern: string;
	icon: string;
}

export interface AutoIconsSettings {
	frontmatterEnabled: boolean;
	frontmatterProperty: string;
	typeIconsEnabled: boolean;
	folderIconEnabled: boolean;
	folderIcon: string;
	noteIconEnabled: boolean;
	noteIcon: string;
	rules: IconRule[];
	packUilEnabled: boolean;
	packUimEnabled: boolean;
	packCuidaEnabled: boolean;
	packMsoutEnabled: boolean;
	colorfulIconsEnabled: boolean;
}

export const DEFAULT_SETTINGS: AutoIconsSettings = {
	frontmatterEnabled: true,
	frontmatterProperty: "icon",
	typeIconsEnabled: true,
	folderIconEnabled: true,
	folderIcon: "lucide-folder",
	noteIconEnabled: true,
	noteIcon: "lucide-file-text",
	rules: [],
	packUilEnabled: true,
	packUimEnabled: true,
	packCuidaEnabled: true,
	packMsoutEnabled: true,
	colorfulIconsEnabled: false,
};

const PACK_ENABLED_KEY: Record<IconPackId, keyof AutoIconsSettings> = {
	uil: "packUilEnabled",
	uim: "packUimEnabled",
	cuida: "packCuidaEnabled",
	msout: "packMsoutEnabled",
};

export function isPackEnabled(settings: AutoIconsSettings, packId: IconPackId): boolean {
	return Boolean(settings[PACK_ENABLED_KEY[packId]]);
}

/**
 * A small fixed palette of primary/secondary hues ("main colors") used for
 * the colorful icons feature. Each item gets one color, chosen
 * deterministically from its path so it stays stable across reloads instead
 * of re-rolling on every repaint.
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

export function colorForPath(path: string): string {
	let hash = 0;
	for (let i = 0; i < path.length; i++) {
		hash = (hash * 31 + path.charCodeAt(i)) | 0;
	}
	return MAIN_COLORS[Math.abs(hash) % MAIN_COLORS.length];
}

/** Default icons applied per file extension when "Default icons by file type" is enabled. */
export const TYPE_ICONS: Record<string, string> = {
	png: "image",
	jpg: "image",
	jpeg: "image",
	gif: "image",
	svg: "image",
	webp: "image",
	bmp: "image",
	avif: "image",
	mp3: "file-audio",
	wav: "file-audio",
	ogg: "file-audio",
	flac: "file-audio",
	m4a: "file-audio",
	"3gp": "file-audio",
	mp4: "file-video",
	webm: "file-video",
	mov: "file-video",
	mkv: "file-video",
	avi: "file-video",
	pdf: "file-text",
	canvas: "layout-dashboard",
	excalidraw: "pencil-ruler",
	"excalidraw.md": "pencil-ruler",
	base: "layout-list",
	js: "file-code",
	ts: "file-code",
	css: "file-code",
	html: "file-code",
	json: "file-code",
	yaml: "file-code",
	yml: "file-code",
	xml: "file-code",
	py: "file-code",
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
