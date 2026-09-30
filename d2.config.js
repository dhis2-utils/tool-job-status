/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    name: 'job-status',
    title: 'Job Status',
    description: 'Tool to monitor DHIS2 background jobs',
    icon: './src/app-icon.png',

    entryPoints: {
        app: './src/App.tsx',
    },

    viteConfigExtensions: './viteConfigExtensions.mts',
}

module.exports = config
