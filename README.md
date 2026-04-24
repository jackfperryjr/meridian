# Meridian

A modern DragonRealms front-end built with Electron, React, and TypeScript.

## Screenshots

<p align="center">
  <img src="resources/Screenshot 2026-04-24 083909.png" alt="Login screen" width="48%">
  &nbsp;
  <img src="resources/Screenshot 2026-04-24 083954.png" alt="In-game interface" width="48%">
</p>

## Features

- **Native SGE authentication** — logs in directly via Simutronics' eaccess protocol, no launcher required
- **Lich integration** — optionally runs Lich as the game broker, enabling `;script` commands
- **Resizable panel system** — drag-to-resize sidebar panels for Room, Vitals, Experience, Spells, Combat, Conversation, and Inventory
- **Highlight rules** — configurable pattern-based text highlighting with color and bold options
- **Theme system** — multiple built-in themes including Meridian (default), Bloodstone, Thornwood, Parchment, Ironforge, and Final Fantasy IV
- **Command history** — arrow keys cycle through previously sent commands
- **Command echo** — sent commands appear inline in the output stream
- **Settings** — configurable font family, font size, theme, and Lich path

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
2. In Meridian's Settings (⚙ in the status bar), set the **Lich path** to your `lich.rbw` (e.g. `C:\Ruby4Lich5\Lich5\lich.rbw`)
3. Log in through Meridian as normal — it handles authentication and launches Lich automatically. Lich may take 1–2 minutes on first run while it downloads map data.

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
npm run package  # Build and package installers
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
      ui/           Login flow, settings modal, highlights modal
    store/          Jotai atoms (game state)
    lib/            SGE XML stream parser, theme definitions and application
    hooks/          Game connection hook
scripts/
  make-icon.js    Regenerates resources/icon.png from the crystal SVG design
```
