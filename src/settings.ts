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
};

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
