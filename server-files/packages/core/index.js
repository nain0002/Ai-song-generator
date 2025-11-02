const crypto = require('crypto');
const database = require('./database');

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

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
    .toString('hex');

  return { salt, hash };
}

function verifyPassword(password, record) {
  const hash = crypto
    .pbkdf2Sync(password, record.salt, 1000, 64, 'sha512')
    .toString('hex');

  return hash === record.hash;
}

function sendInventory(player, inventory) {
  player.call('inventory:update', [JSON.stringify(inventory)]);
}

let isDatabaseReady = false;
const databaseReadyPromise = database
  .initDatabase()
  .then(() => {
    isDatabaseReady = true;
    logInfo('Database connection initialised.');
  })
  .catch((error) => {
    logError(`Database initialisation failed: ${error.message}`);
  });

async function ensureDatabaseReady() {
  if (isDatabaseReady) {
    return true;
  }

  try {
    await databaseReadyPromise;
  } catch (error) {
    // Already logged inside the promise rejection
  }

  return isDatabaseReady;
}

mp.events.add('playerJoin', (player) => {
  player.outputChatBox('~b~Welcome to the Cursor RageMP Basic Server!');
  player.data.isLoggedIn = false;
  player.data.username = null;
  player.data.userId = null;
  player.call('auth:showRegistration');
});

mp.events.add('playerQuit', (player) => {
  if (!player?.data?.userId) {
    return;
  }

  database
    .updateLastSeen(player.data.userId)
    .catch((error) => logError(`Failed to update last seen: ${error.message}`));
});

mp.events.add('auth:register', async (player, username, password) => {
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

  if (!(await ensureDatabaseReady())) {
    player.call('auth:registrationResult', [false, 'Database is not ready. Please try again shortly.']);
    return;
  }

  try {
    const existingUser = await database.getUserByUsername(cleanUsername);
    if (existingUser) {
      const validPassword = verifyPassword(cleanPassword, {
        salt: existingUser.password_salt,
        hash: existingUser.password_hash
      });

      if (!validPassword) {
        player.call('auth:registrationResult', [false, 'Incorrect password for that account.']);
        return;
      }

      const inventory = await database.getInventoryForUser(existingUser.id);

      player.data.isLoggedIn = true;
      player.data.username = existingUser.username;
      player.data.userId = existingUser.id;
      sendInventory(player, inventory);

      player.call('auth:registrationResult', [true, `Welcome back, ${existingUser.username}!`]);
      player.outputChatBox(`~g~Welcome back, ${existingUser.username}!`);
      return;
    }

    const passwordRecord = createPasswordRecord(cleanPassword);
    const userId = await database.createUser(cleanUsername, passwordRecord);
    await database.addInventoryItems(userId, DEFAULT_INVENTORY);
    const inventory = await database.getInventoryForUser(userId);

    player.data.isLoggedIn = true;
    player.data.username = cleanUsername;
    player.data.userId = userId;
    sendInventory(player, inventory);

    player.call('auth:registrationResult', [true, `Welcome, ${cleanUsername}!`]);
    player.outputChatBox(`~g~Registration complete. Welcome, ${cleanUsername}!`);
  } catch (error) {
    logError(`Registration failed: ${error.message}`);
    player.call('auth:registrationResult', [false, 'An unexpected error occurred during registration.']);
  }
});

mp.events.add('inventory:request', async (player) => {
  if (!player.data.isLoggedIn) {
    player.outputChatBox('~r~You need to register before accessing your inventory.');
    return;
  }

  if (!(await ensureDatabaseReady())) {
    player.outputChatBox('~r~Database is not ready. Please try again.');
    return;
  }

  try {
    const inventory = await database.getInventoryForUser(player.data.userId);
    sendInventory(player, inventory);
    player.call('inventory:toggle', [true]);
  } catch (error) {
    logError(`Failed to load inventory: ${error.message}`);
    player.outputChatBox('~r~Failed to load your inventory.');
  }
});

mp.events.add('inventory:addItem', async (player, itemId, itemName, itemDescription) => {
  if (!player.data.isLoggedIn) {
    player.outputChatBox('~r~Register first before modifying inventory.');
    return;
  }

  if (!(await ensureDatabaseReady())) {
    player.outputChatBox('~r~Database is not ready. Please try again.');
    return;
  }

  const item = {
    id: String(itemId || `item-${Date.now()}`),
    name: String(itemName || 'Unknown Item'),
    description: String(itemDescription || 'No description provided.')
  };

  try {
    await database.addInventoryItem(player.data.userId, item);
    const inventory = await database.getInventoryForUser(player.data.userId);
    sendInventory(player, inventory);
    player.outputChatBox(`~g~Added ${item.name} to your inventory.`);
  } catch (error) {
    logError(`Failed to add inventory item: ${error.message}`);
    player.outputChatBox('~r~Failed to add that item to your inventory.');
  }
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

mp.events.add('inventory:removeItem', async (player, itemId) => {
  if (!player.data.isLoggedIn) {
    player.outputChatBox('~r~Register first before modifying inventory.');
    return;
  }

  if (!(await ensureDatabaseReady())) {
    player.outputChatBox('~r~Database is not ready. Please try again.');
    return;
  }

  try {
    const removed = await database.removeInventoryItem(player.data.userId, itemId);
    if (!removed) {
      player.outputChatBox('~y~No item with that ID found in your inventory.');
      return;
    }

    const inventory = await database.getInventoryForUser(player.data.userId);
    sendInventory(player, inventory);
    player.outputChatBox('~g~Item removed from your inventory.');
  } catch (error) {
    logError(`Failed to remove item: ${error.message}`);
    player.outputChatBox('~r~Failed to remove that item.');
  }
});

mp.events.add('auth:debugReset', (player) => {
  player.data.isLoggedIn = false;
  player.data.username = null;
  player.data.userId = null;
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
