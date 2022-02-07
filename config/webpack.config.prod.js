const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    //'ol-themes-ext-webpack': './src/api.js'
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
  optimization: {
    minimize: false
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/*.d.ts', to: '[name][ext]' },
        { from: 'src/*.js', to: '[name][ext]' }
      ]
    })
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          { loader: 'babel-loader',
            options: { presets: [ '@babel/preset-env' ] }
          }
        ],
        exclude: /node_modules/,
      }
    ]
  }
};