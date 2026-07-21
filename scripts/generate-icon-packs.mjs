import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "generated");
mkdirSync(outDir, { recursive: true });

// Material Symbols bundles Outlined (unsuffixed), Rounded, and Sharp shape
// families under one collection; we only want Outlined to keep the bundle
// a reasonable size and give a single consistent look.
const isOutlined = (name) => !name.endsWith("-rounded") && !name.endsWith("-sharp");

const PACKS = [
	{ id: "uil", pkg: "uil" },
	{ id: "uim", pkg: "uim" },
	{ id: "cuida", pkg: "cuida" },
	{ id: "msout", pkg: "material-symbols", filter: isOutlined },
];

function svgFor(width, height, body) {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="currentColor">${body}</svg>`;
}

const summary = [];

for (const pack of PACKS) {
	const data = require(`@iconify-json/${pack.pkg}/icons.json`);
	const defaultWidth = data.width ?? 24;
	const defaultHeight = data.height ?? 24;
	const icons = {};

	for (const [name, def] of Object.entries(data.icons)) {
		if (pack.filter && !pack.filter(name)) {
			continue;
		}
		icons[name] = svgFor(def.width ?? defaultWidth, def.height ?? defaultHeight, def.body);
	}

	if (data.aliases) {
		for (const [name, alias] of Object.entries(data.aliases)) {
			if (pack.filter && !pack.filter(name)) {
				continue;
			}
			const parentSvg = icons[alias.parent];
			if (parentSvg) {
				icons[name] = parentSvg;
			}
		}
	}

	const outPath = join(outDir, `${pack.id}.json`);
	const json = JSON.stringify(icons);
	writeFileSync(outPath, json);
	summary.push(`${pack.id}: ${Object.keys(icons).length} icons, ${(json.length / 1024).toFixed(0)} KB`);
}

console.log(summary.join("\n"));
