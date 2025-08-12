const { withAppBuildGradle, withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidSDK35(config) {
  // Add the warning suppression to gradle.properties
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.contents.includes('android.suppressUnsupportedCompileSdk=35')) {
      return config;
    }
    
    // Add suppression for SDK 35 warning
    config.modResults.contents = config.modResults.contents.replace(
      /android\.extraMavenRepos=\[\]/g,
      'android.extraMavenRepos=[]\n\n# Suppress Android Gradle Plugin warning for SDK 35\nandroid.suppressUnsupportedCompileSdk=35'
    );
    
    return config;
  });

  return config;
};