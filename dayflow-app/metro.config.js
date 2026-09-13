const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Чтобы Metro включал mp3-файлы в бандл
config.resolver.assetExts.push("mp3");

module.exports = config;
