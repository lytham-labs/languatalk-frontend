const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
const { join } = require('path');

module.exports = {
  resolve: {
    alias: {
      '@languatalk-frontend/data-access-auth': join(__dirname, '../../dist/libs/data-access/auth'),
      '@languatalk-frontend/data-access-user-settings': join(__dirname, '../../dist/libs/data-access/user-settings'),
      '@languatalk-frontend/data-access-websocket': join(__dirname, '../../dist/libs/data-access/websocket'),
      '@languatalk-frontend/util-reading-aid': join(__dirname, '../../dist/libs/util/reading-aid'),
      '@languatalk-frontend/ui-shared-layout': join(__dirname, '../../dist/libs/ui/shared-layout'),
    },
  },
  output: {
    path: join(__dirname, 'dist'),
  },
  devServer: {
    port: 4200,
    historyApiFallback: {
      index: '/index.html',
      disableDotRule: true,
      htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
    },
  },
  plugins: [
    new NxAppRspackPlugin({
      tsConfig: './tsconfig.app.json',
      main: './src/main.tsx',
      index: './src/index.html',
      baseHref: '/',
      assets: ['./src/favicon.ico', './src/assets'],
      styles: ['./src/styles.css'],
      outputHashing: process.env['NODE_ENV'] === 'production' ? 'all' : 'none',
      optimization: process.env['NODE_ENV'] === 'production',
    }),
    new NxReactRspackPlugin({
      // Uncomment this line if you don't want to use SVGR
      // See: https://react-svgr.com/
      // svgr: false
    }),
  ],
};
