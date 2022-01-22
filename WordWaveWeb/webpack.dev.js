const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    mode: 'development',
    devtool: 'inline-source-map',
    devServer: {
        port: 9999,
        liveReload: true,
        open: true,
        static: {
            serveIndex: true,
            directory: __dirname
        },
        devMiddleware: {
            writeToDisk: false
        }
    }
});