/* global hexo */
'use strict';
require('dotenv').config();

console.log("hexo-bluesky-feed loaded");

// Register the deployer by delegating to our lib/deployer.js module
hexo.extend.deployer.register('bluesky-feed', require('./lib/deployer'));