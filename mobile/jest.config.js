module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/coverage/**'
  ],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/node_modules/react-native',
    '^@/(.*)$': '<rootDir>/$1'
  },
  // Prevent memory leaks in watch mode
  maxWorkers: '50%',
  workerIdleMemoryLimit: '512MB',
  // Clear mocks automatically to prevent memory accumulation
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
