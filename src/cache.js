// src/cache.js
// Tiny in-memory cache wrapper used by dataProviders.js

const backingStore = new Map();

export const _inMemoryCache = {
  has: (key) => backingStore.has(key),
  get: (key) => backingStore.get(key),
  set: (key, value) => backingStore.set(key, value),
  clear: () => backingStore.clear(),
};
