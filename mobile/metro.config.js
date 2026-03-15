const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Exclude react-native-maps from web builds
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (platform === "web" && moduleName === "react-native-maps") {
      // Return a mock module for web
      return {
        type: "empty",
      };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
