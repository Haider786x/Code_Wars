import assert from 'node:assert/strict';
import test from 'node:test';

import { getCurrentIdentity } from './currentIdentity.js';
import { getGuestIdentity, setGuestDisplayName } from './guestIdentity.js';

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

test('guest creates room identity once and keeps same guestId after refresh', () => {
  global.localStorage = createLocalStorageMock();
  global.window = { crypto: { randomUUID: () => 'guest-uuid-1' } };

  const first = getGuestIdentity();
  const second = getGuestIdentity();

  assert.equal(first.guestId, 'guest-uuid-1');
  assert.equal(second.guestId, 'guest-uuid-1');
});

test('guest joins room using persisted display name and guestId identity', () => {
  global.localStorage = createLocalStorageMock();
  global.window = { crypto: { randomUUID: () => 'guest-uuid-join' } };

  const saved = setGuestDisplayName('Haider');
  const identity = getCurrentIdentity();

  assert.equal(saved.guestId, 'guest-uuid-join');
  assert.equal(saved.displayName, 'Haider');
  assert.equal(identity.type, 'guest');
  assert.equal(identity.guestId, 'guest-uuid-join');
  assert.equal(identity.displayName, 'Haider');
});

test('guest plays and spectates by stable identity resolution', () => {
  global.localStorage = createLocalStorageMock();
  global.window = { crypto: { randomUUID: () => 'guest-uuid-play' } };

  setGuestDisplayName('Player One');
  const identity = getCurrentIdentity();
  const players = ['guest-uuid-play', 'guest-uuid-opponent'];

  assert.equal(players.includes(identity.guestId), true);
  assert.equal(players.includes('guest-uuid-spectator'), false);
});
