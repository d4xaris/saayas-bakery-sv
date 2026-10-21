# Story Translation Editor

A local, browser-based editor for translating **BanG Dream!** stories into Ukrainian, by Saaya's Bakery.
It supports **Our Notes** and **Girls Band Party** (events and card stories): import a story, translate it line by line next to the original and the official English, preview it in a built-in player, and export it.

- Stories are stored **in your browser** (IndexedDB), not on a server.
- **Export JSON** (Home and Save pages) makes a backup or hands a story to someone else. Import it on Home.
- **Export DOCX / TXT** produces a document ready to send.

> If you clear your browser data, your stories are gone. Export JSON regularly.

## What you need to install

Install these once, in this order. Default options are fine.

| Tool | Where | Why |
| --- | --- | --- |
| **Git** | https://git-scm.com/downloads | Download the project |
| **Node.js** (LTS) | https://nodejs.org | Needed by Vite |
| **Bun** | see below | Installs dependencies and runs the project |
| **Google Chrome** | https://www.google.com/chrome | Most reliable browser for the player (needs WebGL2) |

Install Bun, then **close and reopen the terminal**:

```powershell
# Windows (PowerShell)
irm bun.sh/install.ps1 | iex
```

```bash
# macOS (Terminal). If Git is missing, run `xcode-select --install` first.
curl -fsSL https://bun.sh/install | bash
```

Check everything works (each command should print a version):

```
git --version
node --version
bun --version
```

## First run

```
git clone -b story-editor https://github.com/d4xaris/saayas-bakery-sv.git
cd saayas-bakery-sv
bun install
```

Create your settings file by copying the example:

```powershell
# Windows
copy .env.example .env
```

```bash
# macOS
cp .env.example .env
```

Start the editor:

```
bun run dev
```

Open the address shown in the terminal (usually `http://localhost:5173`) in Chrome. Keep the terminal open while you work; stop with `Ctrl + C`.

**Next time:** `cd saayas-bakery-sv`, then `bun run dev`.
**Update:** `git pull`, `bun install`, `bun run dev`. Restart `bun run dev` if `.env.example` changed.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `bun` or `node` not found | Close the terminal and open a new one. If that fails, reinstall. |
| "Could not reach Bestdori" in the Event or Card tab | Check that `.env` exists in the project root, then restart `bun run dev`. |
| Player is blank or does not start | Use Chrome (WebGL2 is required). |
| Page does not work via an address like `http://192.168...` | Open it only through `localhost`; some browser features (needed for Preview) are disabled on other addresses. |
| macOS: missing `.node` file after `bun install` | `rm -rf node_modules`, then `bun install` again. |
| Stories disappeared | They live in the browser. Import your JSON backup on Home. |

## For developers

```
bunx tsc -b      # type check
bun run lint     # lint
bun run build    # production build
```

Bestdori is reached through a proxy defined in `vite.config.ts`, which only exists in `bun run dev`. A deployed build needs its own proxy, because Bestdori does not allow direct browser requests from other sites (CORS).

## Credits and licenses

**Origin.** This project is a fork of [MoeNotes](https://github.com/StarMoe-org/moenotes) by the [StarMoe](https://github.com/StarMoe-org) team, and its Our Notes player is built on `ournotes-player`. Our thanks to them for the original work. Changes in this fork include the translation editor, Girls Band Party support, and Ukrainian text rendering.

**Data sources.** Not ours; please be considerate and do not overload them.
- Our Notes stories and images: `storage.bdon.moe` and `assets.bdon.moe`.
- Girls Band Party stories, cards, events and voices: [Bestdori](https://bestdori.com) and its community. Its API is undocumented and may change.

**Code license.** [AGPL-3.0](LICENSE). Keep the `LICENSE` file. If you run a modified version as a public website, you must make its source code available to its users.

**Third-party components.**
- Ukrainian font: Noto Sans (SIL Open Font License), via `@fontsource/noto-sans`.
- Live2D Cubism Core is proprietary and loaded from Live2D's website at runtime. Do not add it to the repository.

**Game content.** All artwork, audio, stories, Live2D models and other game assets belong to **Bushiroad / Craft Egg / Ishimori**. This is a non-commercial fan project and is not affiliated with the rights holders.