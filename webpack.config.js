var path = require('path');
var webpack = require('webpack');

module.exports = {
  entry: './index.js',
  output: {
    filename: 'campaign_data.js',
    path: path.resolve(__dirname, 'dist')
  },
  plugins:[
    new webpack.optimize.UglifyJsPlugin()
  ]
};