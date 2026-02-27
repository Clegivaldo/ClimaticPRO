const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Alias various react-native-web/resolution paths so Expo's imports resolve
  config.resolve = config.resolve || {};
  config.resolve.alias = config.resolve.alias || {};
  const rnWeb = require.resolve('react-native-web');

  // Map export paths Expo may reference to the installed package
  config.resolve.alias['react-native-web/dist/exports/AppRegistry'] = rnWeb;
  config.resolve.alias['react-native-web/dist/exports/View'] = rnWeb;
  config.resolve.alias['react-native-web/dist/exports/Text'] = rnWeb;
  config.resolve.alias['react-native-web/dist/exports/Image'] = rnWeb;
  config.resolve.alias['react-native-web/dist/exports/ScrollView'] = rnWeb;
  config.resolve.alias['react-native-web/dist/exports'] = rnWeb;

  // Ensure imports of 'react-native' resolve to react-native-web for web builds
  config.resolve.alias['react-native$'] = rnWeb;
  config.resolve.alias['react-native'] = rnWeb;

  return config;
};
