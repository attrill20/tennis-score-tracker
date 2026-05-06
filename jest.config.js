const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

// Base config that next/jest generates (handles transforms, module mappers etc)
const baseConfig = createJestConfig({
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
});

module.exports = async () => {
  const base = await baseConfig();
  return {
    ...base,
    projects: [
      {
        ...base,
        displayName: 'components',
        testEnvironment: 'jsdom',
        setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
        testMatch: ['**/__tests__/components/**/*.test.tsx'],
      },
      {
        ...base,
        displayName: 'api',
        testEnvironment: 'node',
        testMatch: ['**/__tests__/api/**/*.test.ts'],
      },
    ],
  };
};
