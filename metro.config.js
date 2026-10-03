// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// exact/ is a separate Exact app; its Cargo target/ holds hundreds of thousands
// of build files Metro has no reason to crawl.
const exactDir = path.join(__dirname, "exact").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
config.resolver.blockList = [new RegExp(`^${exactDir}/.*`)];

module.exports = config;
