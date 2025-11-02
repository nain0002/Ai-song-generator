# Rage Multiplayer Basic Server

This project provides a starter Rage Multiplayer game-mode featuring:

- MySQL-backed player registration/login with salted+hashed passwords (PBKDF2)
- In-game registration UI built with CEF
- Persistent player inventory with default starter items
- Inventory UI (toggle with `I`) that supports removing items
- Basic chat relay that only permits registered players to speak
- Utility commands such as `/inventory`, `/giveitem`, and an `End` key debug reset

Use it as a foundation for experiments, tutorials, or to bootstrap a custom gamemode.

## Directory Layout

- `server-files/conf.json` ? RageMP server configuration that loads the `core` resource
- `server-files/packages/core/` ? Node-based server logic, including registration, inventory, and chat handlers
- `server-files/packages/core/config/database.example.json` ? Sample MySQL connection details (copy to `database.json`)
- `server-files/client_packages/index.js` ? Client-side scripting for UI management and keybinds
- `server-files/client_packages/cef/` ? CEF HTML/JS for registration and inventory interfaces
- `database/schema.sql` ? SQL schema for accounts and inventory tables

## Getting Started

1. **Install Rage Multiplayer server binaries**
   - Download the latest server package from [https://rage.mp/](https://rage.mp/)
   - Unzip the archive and copy the contents of this repository into the root `server-files` folder (overwrite if prompted)
   - Remove any legacy `server-files/packages/client_packages` folder from older gamemodes; this template ships a placeholder to prevent stale requires

2. **Enable Node.js support**
   - Make sure `conf.json` contains `"modules": ["node-module"]` (already configured)

3. **Install server dependencies**
   - Open a terminal in `server-files/packages/core`
   - Run `npm install` to fetch the `mysql2` driver

4. **Configure the database**
   - Create a MySQL database (for example, `ragemp`)
   - Execute the statements inside `database/schema.sql`
   - Copy `server-files/packages/core/config/database.example.json` to `database.json`
   - Update host/user/password to match your environment

5. **Start the server**
   - On Windows, run `ragemp-server.exe`
   - On Linux, run `./ragemp-server` (ensure it is executable)

6. **Connect with the RageMP client**
   - Launch the RageMP client, add your server (`127.0.0.1:22005` by default), and connect

## Gameplay Flow

- New players are prompted with a registration form. The username must be unique and passwords require six characters.
- Successful registration unlocks chat access and grants three starter items.
- Returning players can enter the same credentials to log back in and load their saved inventory.
- Press the `I` key (or use `/inventory`) to open the inventory UI. Items can be removed from the UI. Use `/giveitem <name>` to test adding custom items.
- The End key (`END`) can be used during development to re-open the registration UI for the current session.

## Persistence

Data lives in MySQL using the schema from `database/schema.sql`:

- `users` ? stores username, password salt+hash, created timestamp, and last seen timestamp
- `inventory_items` ? stores each inventory row linked to a user

If you prefer another database, adjust `server-files/packages/core/database.js` accordingly.

## Development Notes

- UI files live under `client_packages/cef`. You can iterate with live reload by re-opening the UI (`I` key or reconnecting).
- The server uses bcrypt-style PBKDF2 hashing via Node's `crypto` module to keep dependencies minimal.
- When extending gameplay, prefer adding new remote events and keeping client/server responsibilities separated, following the existing structure.

## License

This template is provided under the MIT License. See `LICENSE` for details.
