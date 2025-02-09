'use strict';

const axios = require('axios');
require('dotenv').config();

module.exports = function(hexo) {
  hexo.extend.deployer.register('bluesky-feed', async function(args) {
    // Allow users to skip posting via a command‑line flag.
    if (args.skipBluesky) {
      hexo.log.info("Skipping Bluesky update due to '--skipBluesky' flag.");
      return;
    }

    // Retrieve configuration from _config.yml and environment variables.
    const config = hexo.config.blueskyFeed || {};
    const apiUrl = process.env.BLUESKY_API_URL || config.apiUrl;
    const accessToken = process.env.BLUESKY_ACCESS_TOKEN || config.accessToken;
    if (!apiUrl || !accessToken) {
      hexo.log.error('Missing configuration: Ensure BLUESKY_API_URL and BLUESKY_ACCESS_TOKEN are set.');
      return;
    }

    // Determine the post URL.
    // If a --postUrl argument is passed, use that; otherwise, compute from Hexo's locals.
    let postUrl = args.postUrl;
    if (!postUrl) {
      const posts = hexo.locals.get('posts');
      if (posts && posts.length > 0) {
        const latestPost = posts.first();
        if (!latestPost) {
          hexo.log.error("Could not retrieve the latest post from Hexo locals.");
          return;
        }
        // Ensure the base URL is defined in _config.yml.
        if (!hexo.config.url) {
          hexo.log.error("hexo.config.url is not defined. Cannot automatically construct the post URL.");
          return;
        }
        // Combine the base URL with the post's relative path.
        postUrl = hexo.config.url + latestPost.path;
      } else {
        hexo.log.error("No posts found in Hexo locals; cannot determine the post URL.");
        return;
      }
    }

    // Retrieve the post title for use in the message.
    let postTitle = "";
    if (hexo.locals.get('posts') && hexo.locals.get('posts').length > 0) {
      postTitle = hexo.locals.get('posts').first().title || "New post";
    } else {
      postTitle = "New post";
    }

    // Construct the dynamic message.
    // Allow users to specify a custom template in _config.yml (blueskyFeed.message).
    // Default: "Just published new blog post: {title}. Check it out here: {url}"
    const defaultTemplate = config.message || "Just published new blog post: {title}. Check it out here: {url}";
    const message = defaultTemplate
      .replace('{title}', postTitle)
      .replace('{url}', postUrl);

    hexo.log.info("Publishing update to Bluesky:", message);

    try {
      const response = await axios.post(
        apiUrl,
        { content: message },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      hexo.log.info("Successfully published update to Bluesky:", response.data);
    } catch (error) {
      hexo.log.error("Failed to publish update to Bluesky:", error.message);
    }
  });
};
