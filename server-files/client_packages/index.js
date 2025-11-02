let registrationBrowser = null;
let inventoryBrowser = null;
let latestInventoryPayload = '[]';

function showCursor(show) {
  mp.gui.cursor.show(show, show);
  mp.game.ui.displayHud(!show);
  mp.game.ui.displayRadar(!show);
}

function destroyRegistrationBrowser() {
  if (registrationBrowser) {
    registrationBrowser.destroy();
    registrationBrowser = null;
  }
  showCursor(false);
}

mp.events.add('auth:showRegistration', () => {
  if (registrationBrowser) {
    registrationBrowser.execute('window.resetForm && window.resetForm();');
    return;
  }

  showCursor(true);
  registrationBrowser = mp.browsers.new('package://cef/registration/index.html');
});

mp.events.add('auth:registrationResult', (success, message) => {
  if (registrationBrowser) {
    const payload = `window.handleRegistrationResult && window.handleRegistrationResult(${success}, ${JSON.stringify(message)});`;
    registrationBrowser.execute(payload);

    if (success) {
      setTimeout(() => destroyRegistrationBrowser(), 500);
    }
  }
});

mp.events.add('auth:submit', (username, password) => {
  mp.events.callRemote('auth:register', username, password);
});

mp.events.add('inventory:update', (payload) => {
  latestInventoryPayload = payload || '[]';

  if (inventoryBrowser) {
    const script = `window.updateInventory && window.updateInventory(${latestInventoryPayload});`;
    inventoryBrowser.execute(script);
  }
});

mp.events.add('inventory:toggle', (shouldShow) => {
  const show = Boolean(shouldShow);

  if (show) {
    if (!inventoryBrowser) {
      inventoryBrowser = mp.browsers.new('package://cef/inventory/index.html');
      setTimeout(() => {
        if (inventoryBrowser) {
          const initScript = `window.updateInventory && window.updateInventory(${latestInventoryPayload});`;
          inventoryBrowser.execute(initScript);
        }
      }, 200);
    }

    showCursor(true);
  } else {
    if (inventoryBrowser) {
      inventoryBrowser.destroy();
      inventoryBrowser = null;
    }

    showCursor(false);
  }
});

// NUI Hooks from CEF
mp.events.add('cef:auth:submit', (username, password) => {
  mp.events.call('auth:submit', username, password);
});

mp.events.add('cef:inventory:close', () => {
  mp.events.callRemote('inventory:close');
});

mp.events.add('cef:inventory:removeItem', (itemId) => {
  mp.events.callRemote('inventory:removeItem', itemId);
});

mp.keys.bind(0x49, true, () => { // I key
  mp.events.callRemote('inventory:request');
});

mp.keys.bind(0x23, true, () => { // End key to reset auth (debug)
  mp.events.callRemote('auth:debugReset');
});
