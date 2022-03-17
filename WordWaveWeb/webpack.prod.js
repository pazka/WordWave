const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = merge(common, {
    mode: 'production',
    devtool: 'source-map',
    plugins : [
        new CopyPlugin({
            patterns: [
                { from: "index.prod.html", to: "index.html" },
                { from: "src/styles.css", to: "." },
            ],
        }),]
});