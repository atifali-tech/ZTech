'use strict';
const permCache    = require('../../lib/permCache');
const sessionCache = require('../../lib/sessionCache');

// Clear all in-process caches before each test to prevent cross-test bleed.
beforeEach(() => {
  permCache.invalidate();    // role → permissions map
  sessionCache.invalidate(); // user → token version map
});
