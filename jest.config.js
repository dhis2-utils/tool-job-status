const path = require('path')

// The cli-app-scripts test runner merges this over its default config, but the
// merge is shallow — so pull in the default moduleNameMapper (CSS/asset mocks)
// and extend it with our "@/" path alias rather than replacing it.
const defaultConfig = require('./node_modules/@dhis2/cli-app-scripts/config/jest.config.js')

module.exports = {
    ...defaultConfig,
    moduleNameMapper: {
        ...defaultConfig.moduleNameMapper,
        '^@/(.+)$': path.resolve(__dirname, 'src/$1'),
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
}
