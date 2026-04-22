# Meridian

A modern DragonRealms front-end built with Electron, React, and TypeScript.

## Features

- **Native SGE authentication** — logs in directly via Simutronics' eaccess protocol, no launcher required
- **Lich integration** — optionally runs Lich as the game broker, enabling `;script` commands
- **Resizable panel system** — drag-to-resize sidebar panels for Room, Vitals, Experience, Spells, Conversation, and Inventory
- **Command history** — arrow keys cycle through previously sent commands
- **Command echo** — sent commands appear inline in the output stream
- **Settings** — configurable font family, font size, and Lich path

## Requirements

- [Node.js](https://nodejs.org/) 18+
- [Lich 5](https://github.com/elanthia-online/lich-5) *(optional, for scripting)*

## Getting Started

```bash
npm install
npm run dev
```

## Lich Setup

Lich is optional. Without it, Meridian connects directly to the game server.

With Lich configured, Meridian launches Lich as the game broker and you get full `;script` support.

1. Install [Lich 5](https://github.com/elanthia-online/lich-5) and Ruby via the Ruby4Lich5 installer
2. Open Lich's GTK UI (`ruby lich.rbw`), log in with your character, and check **"Save this info for quick game entry"** — this creates the `entry.yaml` credentials file Lich needs for headless login
3. In Meridian's Settings (⚙ in the status bar), set the **Lich path** to your `lich.rbw` (e.g. `C:\Ruby4Lich5\Lich5\lich.rbw`)
4. Log in — Meridian will launch Lich automatically. Lich may take 1–2 minutes on first run while it downloads map data.

Once connected with Lich active, `;commands` are routed to Lich's scripting engine.

## Connection Modes

**With Lich path configured:**
Lich connects to the game server, Meridian connects to Lich's local proxy on port 11024. Full scripting support.

**Without Lich path:**
Meridian connects directly to `dr.simutronics.net` using the key from SGE auth. No scripting, but faster to connect.

## Development

```bash
npm run dev      # Start with hot reload
npm run build    # Build for production
npm run preview  # Preview production build
```

Built with [electron-vite](https://electron-vite.org/), [React](https://react.dev/), [Jotai](https://jotai.org/), and TypeScript.

## Project Structure

```
src/
  main/           Electron main process
    index.ts        IPC handlers, app lifecycle
    sge-auth.ts     SGE eaccess authentication protocol
    game-connection.ts  TCP connection to game server or Lich proxy
    lich-manager.ts     Lich process management
    settings-store.ts   Persistent settings (no passwords stored)
  preload/        Context bridge (main ↔ renderer)
  renderer/       React UI
    components/
      game/         Status bar, command input, game output
      layout/       Resizable panel system and panel content
      ui/           Login flow, settings modal
    store/          Jotai atoms (game state)
    lib/            SGE XML stream parser
    hooks/          Game connection hook
```
