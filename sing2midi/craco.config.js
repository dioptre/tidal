const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const path = require('path');

// Support PUBLIC_URL environment variable for deployment base path
// Examples:
//   - GitHub Pages: PUBLIC_URL=/tidal/ npm run build
//   - Custom domain: PUBLIC_URL=/ npm run build
//   - Subdirectory: PUBLIC_URL=/my-app/ npm run build
// CRA automatically uses this for asset paths in index.html

module.exports = {
  devServer: {
    // Configure historyApiFallback to support base path
    historyApiFallback: {
      disableDotRule: true,
      // Redirect all requests to index.html with base path
      index: process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/index.html` : '/index.html',
    },
    setupMiddlewares: (middlewares, devServer) => {
      // Add WASM MIME type to webpack-dev-server
      if (!devServer) {
        throw new Error('webpack-dev-server is not defined');
      }

      // Set correct MIME type for WASM files
      devServer.app.use((req, res, next) => {
        if (req.path.endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm');
        }
        next();
      });

      return middlewares;
    },
  },
  webpack: {
    plugins: {
      add: [new NodePolyfillPlugin()]
    },
    configure: (webpackConfig) => {
      // Remove the ModuleScopePlugin which restricts imports to src/
      webpackConfig.resolve.plugins = webpackConfig.resolve.plugins.filter(
        plugin => plugin.constructor.name !== 'ModuleScopePlugin'
      );

      // Find and update the babel-loader rule to include @shopify/react-native-skia
      const babelRule = webpackConfig.module.rules.find(rule =>
        rule.oneOf && Array.isArray(rule.oneOf)
      );

      if (babelRule) {
        const jsRule = babelRule.oneOf.find(rule =>
          rule.test && rule.test.toString().includes('jsx')
        );

        if (jsRule) {
          // Extend the JS/JSX rule to include @shopify/react-native-skia
          jsRule.include = [
            jsRule.include,
            path.resolve(__dirname, 'node_modules/@shopify/react-native-skia')
          ].filter(Boolean);
        }
      }

      // Add aliases for React Native modules
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        'react-native$': 'react-native-web',
        'react-native-reanimated': 'react-native-reanimated/lib/module/web',
        'react-native/Libraries/Image/AssetRegistry': 'react-native-web/dist/modules/AssetRegistry',
        '@react-native-async-storage/async-storage': '@react-native-async-storage/async-storage/lib/commonjs',
        'expo-modules-core': false,
        'react-native-fs': false,
        '@tensorflow/tfjs-react-native': false,
        'expo-gl': false,
        'react-native-audio-api': 'react-native-audio-api/lib/commonjs',
        'react-native-worklets': false,
        'react-native-worklets/package.json': false,
      };

      // Ensure canvaskit.wasm is accessible
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        fs: false,
        path: require.resolve('path-browserify'),
        'react-native-reanimated': false,
        'react-native-reanimated/package.json': false,
      };

      // Configure webpack to resolve extensions for ESM modules
      webpackConfig.resolve.extensions = [
        '.web.js',
        '.web.jsx',
        '.web.ts',
        '.web.tsx',
        '.js',
        '.jsx',
        '.ts',
        '.tsx',
        '.json'
      ];

      // Add rule to disable fullySpecified for specific node_modules
      webpackConfig.module.rules.push({
        test: /\.m?js/,
        resolve: {
          fullySpecified: false
        }
      });

      // Add rule to handle WASM files
      webpackConfig.module.rules.push({
        test: /\.wasm$/,
        type: 'asset/resource',
      });

      // Configure experiments for WebAssembly
      webpackConfig.experiments = {
        ...webpackConfig.experiments,
        asyncWebAssembly: true,
      };

      return webpackConfig;
    }
  }
};
