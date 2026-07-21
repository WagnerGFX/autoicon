import { addIcon, removeIcon } from "obsidian";
import uilIcons from "./generated/uil.json";
import uimIcons from "./generated/uim.json";
import cuidaIcons from "./generated/cuida.json";
import msoutIcons from "./generated/msout.json";

export type IconPackId = "uil" | "uim" | "cuida" | "msout";

export interface IconPackInfo {
	id: IconPackId;
	name: string;
	icons: Record<string, string>;
}

/**
 * Bundled at build time by scripts/generate-icon-packs.mjs from the
 * corresponding @iconify-json packages (all Apache 2.0). No network
 * requests are made at runtime — see README for attribution.
 */
export const ICON_PACKS: IconPackInfo[] = [
	{ id: "uil", name: "Unicons", icons: uilIcons as Record<string, string> },
	{ id: "uim", name: "Unicons Monochrome", icons: uimIcons as Record<string, string> },
	{ id: "cuida", name: "Cuida Icons", icons: cuidaIcons as Record<string, string> },
	{
		id: "msout",
		name: "Material Symbols (Outlined)",
		icons: msoutIcons as Record<string, string>,
	},
];

/** Returns the owning pack id for a bundled icon id, or null for Lucide/native icons. */
export function packIdForIconId(iconId: string): IconPackId | null {
	for (const pack of ICON_PACKS) {
		if (iconId.startsWith(`${pack.id}-`)) {
			return pack.id;
		}
	}
	return null;
}

let registeredIds: string[] | null = null;

/**
 * Registers every bundled icon with Obsidian's global icon registry so
 * setIcon()/getIconIds() see them the same as built-in Lucide icons. Always
 * registers all packs regardless of the per-pack "show in picker" setting,
 * since an icon already assigned via frontmatter or a rule must keep
 * rendering even if its pack is later hidden from the picker.
 */
export function registerIconPacks(): void {
	if (registeredIds !== null) {
		return;
	}
	const ids: string[] = [];
	for (const pack of ICON_PACKS) {
		for (const [name, svg] of Object.entries(pack.icons)) {
			const id = `${pack.id}-${name}`;
			addIcon(id, svg);
			ids.push(id);
		}
	}
	registeredIds = ids;
}

export function unregisterIconPacks(): void {
	if (registeredIds === null) {
		return;
	}
	for (const id of registeredIds) {
		removeIcon(id);
	}
	registeredIds = null;
}
