const path = require('path');

module.exports = {
    entry: {
        main: './src/main.ts'
    },
    output: {
        filename: 'bundle.js',
        publicPath: '/WordWave_debug/dist',
        path: path.resolve(__dirname, 'dist')
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    watchOptions: {
        ignored: /node_modules/
    }
};