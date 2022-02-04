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
  optimization: {
    minimize: false
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/*.d.ts', to: '[name][ext]' }
      ]
    })
  ],
  // module: {
  //   rules: [
  //     {
  //       test: /\.js$/,
  //       use: 'babel-loader',
  //       exclude: /node_modules/,
  //       // query: {
  //       //   presets: ['react', 'es2015', 'react-hmre'],
  //       //   plugins: ['transform-class-properties']
  //       // }
  //     }
  //   ]
  // }
};