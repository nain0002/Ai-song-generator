# Rage Multiplayer Basic Server

This project provides a starter Rage Multiplayer game-mode featuring:

- File-backed player registration with salted+hashed passwords (PBKDF2)
- In-game registration UI built with CEF
- Persistent player inventory with default starter items
- Inventory UI (toggle with `I`) that supports removing items
- Basic chat relay that only permits registered players to speak
- Utility commands such as `/inventory`, `/giveitem`, and an `End` key debug reset

Use it as a foundation for experiments, tutorials, or to bootstrap a custom gamemode.

## Directory Layout

- `server-files/conf.json` ? RageMP server configuration that loads the `core` resource
- `server-files/packages/core/` ? Node-based server logic, including registration, inventory, and chat handlers
- `server-files/client_packages/index.js` ? Client-side scripting for UI management and keybinds
- `server-files/client_packages/cef/` ? CEF HTML/JS for registration and inventory interfaces
- `data/users.json` ? Simple JSON database storing registered players and inventory contents

## Getting Started

1. **Install Rage Multiplayer server binaries**
   - Download the latest server package from [https://rage.mp/](https://rage.mp/)
   - Unzip the archive and copy the contents of this repository into the root `server-files` folder (overwrite if prompted)
   - Remove any legacy `server-files/packages/client_packages` folder from older gamemodes; this template ships a placeholder to prevent stale requires

2. **Enable Node.js support**
   - Make sure `conf.json` contains `"modules": ["node-module"]` (already configured)

3. **Start the server**
   - On Windows, run `ragemp-server.exe`
   - On Linux, run `./ragemp-server` (ensure it is executable)

4. **Connect with the RageMP client**
   - Launch the RageMP client, add your server (`127.0.0.1:22005` by default), and connect

## Gameplay Flow

- New players are prompted with a registration form. The username must be unique and passwords require six characters.
- Successful registration unlocks chat access and grants three starter items.
- Press the `I` key (or use `/inventory`) to open the inventory UI. Items can be removed from the UI. Use `/giveitem <name>` to test adding custom items.
- The End key (`END`) can be used during development to re-open the registration UI for the current session.

## Persistence

Player data is stored in `data/users.json`. Each entry contains:

```json
{
  "username": "PlayerName",
  "password": {
    "salt": "...",
    "hash": "..."
  },
  "inventory": [
    { "id": "water", "name": "Bottle of Water", "description": "..." }
  ],
  "createdAt": "2025-11-02T12:00:00.000Z"
}
```

Feel free to replace this simple JSON store with your preferred database (MySQL, MongoDB, etc.) by modifying `server-files/packages/core/index.js`.

## Development Notes

- UI files live under `client_packages/cef`. You can iterate with live reload by re-opening the UI (`I` key or reconnecting).
- The server uses bcrypt-style PBKDF2 hashing via Node's `crypto` module to keep dependencies minimal.
- When extending gameplay, prefer adding new remote events and keeping client/server responsibilities separated, following the existing structure.

## License

This template is provided under the MIT License. See `LICENSE` for details.
