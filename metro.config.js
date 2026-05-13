const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
if (process.env.CI) {
  config.maxWorkers = 2;
}
module.exports = config;