'use strict';
module.exports = {
  testEnvironment:     'node',
  globalSetup:         './tests/setup/globalSetup.js',
  globalTeardown:      './tests/setup/globalTeardown.js',
  setupFilesAfterEnv:  ['./tests/setup/jest.setup.js'],
  testMatch:           ['**/tests/integration/**/*.test.js'],
  testTimeout:         30000,
  maxWorkers:          1,
  forceExit:           true,
  verbose:             true,
};
