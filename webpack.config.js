const path = require('path');
const PRODUCTION = process.env.NODE_ENV === 'production';

module.exports = {
  entry: path.resolve(__dirname, 'dist', 'index.js'),
  mode: PRODUCTION ? 'production' : 'development',
  devtool: PRODUCTION ? undefined : 'inline-source-map',
  output: {
    filename: 'standalone.js',
    path: __dirname,
    globalObject: 'this',
    library: {
      name: 'prettierPluginLiquid',
      type: 'umd',
    },
  },
  externals: {
    prettier: {
      commonjs: 'prettier',
      commonjs2: 'prettier',
      amd: 'prettier/standalone',
      root: 'prettier',
    },
  },
  resolve: {
    alias: {
      '../../grammar/liquid-html.ohm.js': path.resolve(
        __dirname,
        'build/shims/liquid-html-ohm.js',
      ),
    },
  },
  optimization: {
    minimize: PRODUCTION ? true : false,
  },
  node: {
    __dirname: true,
  },
};
