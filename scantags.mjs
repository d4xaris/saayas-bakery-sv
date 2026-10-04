import { gunzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const BASE = "https://storage.bdon.moe/moenotes/";
const id = process.argv[2] ?? "10946";

const manifest = await (await fetch(`${BASE}stories/${id}.json`)).json();
const entry = manifest.files["episode.json"];
const res = await fetch(BASE + entry.asset);
if (!res.ok) throw new Error(`HTTP ${res.status} for ${BASE + entry.asset}`);
const buf = Buffer.from(await res.arrayBuffer());
const raw = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf;
const episode = JSON.parse(raw.toString("utf8"));

const TAG = /<\/?[a-zA-Z][^>]*>/g;
const counts = new Map();
const examples = [];

function walk(node, path) {
  if (typeof node === "string") {
    const found = node.match(TAG);
    if (found) {
      for (const t of found) {
        const name = t
          .replace(/^<\/?/, "")
          .replace(/[=\s>].*$/, "")
          .toLowerCase();
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      if (examples.length < 40)
        examples.push(`${path}\n    ${JSON.stringify(node)}`);
    }
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, `${path}[${i}]`));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
  }
}
walk(episode, "episode");

const out = [
  `story ${id}`,
  `tag counts:`,
  ...[...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([n, c]) => `  ${n}: ${c}`),
  ``,
  `examples (first ${examples.length}):`,
  ...examples,
].join("\n");

writeFileSync("tags.txt", out, "utf8");
console.log(`done: ${counts.size} tag types, see tags.txt`);
