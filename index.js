'use strict';
require('dotenv').config();

// We require a separate function that handles the Bluesky posting:
const doBlueskyPost = require('./lib/bluesky');

hexo.on('generateAfter', async () => {
  await doBlueskyPost.call(hexo);
});
