const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../..', 'data');
const USERS_PATH = path.join(DATA_DIR, 'users.json');

const DEFAULT_INVENTORY = [
  { id: 'water', name: 'Bottle of Water', description: 'Restores a small amount of stamina.' },
  { id: 'snack', name: 'Quick Snack', description: 'A tasty snack that restores a bit of health.' },
  { id: 'bandage', name: 'Bandage', description: 'Use this to slowly heal superficial wounds.' }
];

function logInfo(message) {
  if (global.mp?.console?.logInfo) {
    global.mp.console.logInfo(message);
  } else {
    console.log(`[core] ${message}`);
  }
}

function logError(message) {
  if (global.mp?.console?.logError) {
    global.mp.console.logError(message);
  } else {
    console.error(`[core] ${message}`);
  }
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(USERS_PATH)) {
    fs.writeFileSync(USERS_PATH, JSON.stringify({ users: [] }, null, 2));
  }
}

function loadUsers() {
  ensureDataFile();

  try {
    const buffer = fs.readFileSync(USERS_PATH, 'utf8');
    const parsed = JSON.parse(buffer);
    if (Array.isArray(parsed?.users)) {
      return parsed.users;
    }
  } catch (error) {
    logError(`Failed to load users.json: ${error.message}`);
  }

  return [];
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_PATH, JSON.stringify({ users }, null, 2));
  } catch (error) {
    logError(`Failed to save users.json: ${error.message}`);
  }
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
    .toString('hex');

  return { salt, hash };
}

function findUser(users, username) {
  const lower = String(username).toLowerCase();
  return users.find((user) => user.username.toLowerCase() === lower);
}

function createUser(username, password) {
  const passwordRecord = createPasswordRecord(password);
  return {
    username,
    password: passwordRecord,
    inventory: [...DEFAULT_INVENTORY],
    createdAt: new Date().toISOString()
  };
}

function sendInventory(player, inventory) {
  player.call('inventory:update', [JSON.stringify(inventory)]);
}

const users = loadUsers();

mp.events.add('playerJoin', (player) => {
  player.outputChatBox('~b~Welcome to the Cursor RageMP Basic Server!');
  player.data.isLoggedIn = false;
  player.data.username = null;
  player.call('auth:showRegistration');
});

mp.events.add('playerQuit', (player) => {
  if (!player?.data?.username) {
    return;
  }

  const user = findUser(users, player.data.username);
  if (user) {
    user.lastSeenAt = new Date().toISOString();
    saveUsers(users);
  }
});

mp.events.add('auth:register', (player, username, password) => {
  const cleanUsername = String(username ?? '').trim();
  const cleanPassword = String(password ?? '').trim();

  if (!cleanUsername || cleanUsername.length < 3) {
    player.call('auth:registrationResult', [false, 'Username must be at least 3 characters.']);
    return;
  }

  if (!cleanPassword || cleanPassword.length < 6) {
    player.call('auth:registrationResult', [false, 'Password must be at least 6 characters.']);
    return;
  }

  if (findUser(users, cleanUsername)) {
    player.call('auth:registrationResult', [false, 'That username is already registered.']);
    return;
  }

  const newUser = createUser(cleanUsername, cleanPassword);
  users.push(newUser);
  saveUsers(users);

  player.data.isLoggedIn = true;
  player.data.username = newUser.username;
  sendInventory(player, newUser.inventory);

  player.call('auth:registrationResult', [true, `Welcome, ${newUser.username}!`]);
  player.outputChatBox(`~g~Registration complete. Welcome, ${newUser.username}!`);
});

mp.events.add('inventory:request', (player) => {
  if (!player.data.isLoggedIn) {
    player.outputChatBox('~r~You need to register before accessing your inventory.');
    return;
  }

  const user = findUser(users, player.data.username);
  if (!user) {
    player.outputChatBox('~r~Could not find your inventory record.');
    return;
  }

  sendInventory(player, user.inventory);
  player.call('inventory:toggle', [true]);
});

mp.events.add('inventory:addItem', (player, itemId, itemName, itemDescription) => {
  if (!player.data.isLoggedIn) {
    player.outputChatBox('~r~Register first before modifying inventory.');
    return;
  }

  const user = findUser(users, player.data.username);
  if (!user) {
    player.outputChatBox('~r~Inventory not found.');
    return;
  }

  user.inventory.push({
    id: String(itemId || `item-${Date.now()}`),
    name: String(itemName || 'Unknown Item'),
    description: String(itemDescription || 'No description provided.')
  });

  saveUsers(users);
  sendInventory(player, user.inventory);
  player.outputChatBox(`~g~Added ${itemName} to your inventory.`);
});

mp.events.addCommand('inventory', (player) => {
  mp.events.call('inventory:request', player);
});

mp.events.add('playerChat', (player, message) => {
  const cleanMessage = String(message ?? '').trim();
  if (!cleanMessage.length) {
    return false;
  }

  if (!player.data.isLoggedIn) {
    player.outputChatBox('~r~Register before using the chat.');
    return false;
  }

  const formatted = `${player.data.username}: ${cleanMessage}`;
  mp.players.broadcast(`!{#00c0ff}${formatted}`);
  return false;
});

mp.events.add('inventory:close', (player) => {
  player.call('inventory:toggle', [false]);
});

mp.events.add('inventory:removeItem', (player, itemId) => {
  if (!player.data.isLoggedIn) {
    player.outputChatBox('~r~Register first before modifying inventory.');
    return;
  }

  const user = findUser(users, player.data.username);
  if (!user) {
    player.outputChatBox('~r~Inventory not found.');
    return;
  }

  const previousLength = user.inventory.length;
  user.inventory = user.inventory.filter((item) => item.id !== itemId);

  if (user.inventory.length === previousLength) {
    player.outputChatBox('~y~No item with that ID found in your inventory.');
    return;
  }

  saveUsers(users);
  sendInventory(player, user.inventory);
  player.outputChatBox('~g~Item removed from your inventory.');
});

mp.events.add('auth:debugReset', (player) => {
  player.data.isLoggedIn = false;
  player.data.username = null;
  player.call('auth:showRegistration');
});

mp.events.addCommand('giveitem', (player, fullText) => {
  if (!player.data.isLoggedIn) {
    player.outputChatBox('~r~Register before adding items.');
    return;
  }

  const input = String(fullText ?? '').trim();
  if (!input.length) {
    player.outputChatBox('~y~Usage: /giveitem <item name>');
    return;
  }

  const itemId = input.toLowerCase().replace(/\s+/g, '-').slice(0, 32) || `item-${Date.now()}`;
  const description = `Custom item: ${input}`;

  mp.events.call('inventory:addItem', player, itemId, input, description);
});

logInfo('Core package loaded: registration, inventory, and chat are ready.');
