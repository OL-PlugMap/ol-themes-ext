const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    'ol-themes-ext': './src/api.js'
  },
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, "..", 'dist'),
    filename: '[name].js',
    library: {
      name: "ol_themes_ext",
      type: 'umd'
    }
  },
  plugins: [
    new CopyWebpackPlugin({
        patterns: [
            { from: 'src/*.d.ts', to: '[name][ext]' },
            { from: 'package.json', to: '[name][ext]' }
        ]
    })
]
};