'use strict';

const axios = require('axios');
require('dotenv').config();

console.log("hexo-bluesky-feed loaded");

module.exports = function(hexo) {
  hexo.extend.deployer.register('bluesky-feed', async function(args) {
    // Allow users to skip posting via a command-line flag.
    if (args.skipBluesky) {
      hexo.log.info("Skipping Bluesky update due to '--skipBluesky' flag.");
      return;
    }

    // Hardcode endpoint URLs (we manage these internally).
    const createSessionUrl = "https://bsky.social/xrpc/com.atproto.server.createSession";
    const createRecordUrl  = "https://bsky.social/xrpc/com.atproto.repo.createRecord";

    // Retrieve the required credentials from environment variables.
    const handle = process.env.BLUESKY_HANDLE;
    const appPassword = process.env.BLUESKY_APP_PASSWORD;
    if (!handle || !appPassword) {
      hexo.log.error("Missing BLUESKY_HANDLE or BLUESKY_APP_PASSWORD in your environment.");
      return;
    }

    // Retrieve additional configuration from _config.yml under the blueskyFeed section.
    // Set blueskyFeed.url to your actual website URL (e.g. https://yourwebsite.com/), which is used for constructing post links.
    const config = hexo.config.blueskyFeed || {};
    const customMessageTemplate = config.message || "Just published new blog post: {title}. Check it out here: {url}";
    const blueskyBaseUrl = config.url;
    if (!blueskyBaseUrl) {
      hexo.log.error("Missing blueskyFeed.url in _config.yml (set it to your website URL, e.g. https://yourwebsite.com/).");
      return;
    }

    // Get the latest post's metadata from Hexo's locals.
    const posts = hexo.locals.get('posts');
    if (!posts || posts.length === 0) {
      hexo.log.error("No posts found in Hexo locals; cannot determine the post URL.");
      return;
    }
    const latestPost = posts.first();
    const postTitle = latestPost.title || "New post";
    // Allow user to override the post URL via a command-line option (--postUrl).
    let postUrl = args.postUrl;
    if (!postUrl) {
      if (!latestPost.path) {
        hexo.log.error("Latest post does not have a valid path.");
        return;
      }
      // Combine your Bluesky-specific website URL with the post's relative path.
      postUrl = blueskyBaseUrl + latestPost.path;
    }

    // Construct the message using the template.
    const message = customMessageTemplate
      .replace('{title}', postTitle)
      .replace('{url}', postUrl);

    // --- STEP 1: Obtain a Fresh Access Token and DID ---
    // Call the createSession endpoint with your handle and app password.
    let sessionResponse;
    try {
      sessionResponse = await axios.post(
        createSessionUrl,
        {
          identifier: handle,
          password: appPassword
        },
        {
          headers: { "Content-Type": "application/json" }
        }
      );
    } catch (error) {
      hexo.log.error("Failed to create session with Bluesky:", error.response ? error.response.data : error.message);
      return;
    }

    // Extract the access token and DID from the session response.
    const sessionData = sessionResponse.data;
    const accessJwt = sessionData.accessJwt;
    const did = sessionData.did;
    if (!accessJwt || !did) {
      hexo.log.error("Session response did not contain accessJwt or did.");
      return;
    }
    hexo.log.info("Obtained fresh access token and DID from Bluesky.");

    // --- STEP 2: Post the Update to Bluesky ---
    // Build the record payload according to Bluesky's API schema.
    const recordPayload = {
      repo: did, // Use the DID returned by the session creation.
      collection: "app.bsky.feed.post",
      record: {
        "$type": "app.bsky.feed.post",
        text: message,
        createdAt: new Date().toISOString()
      }
    };

    hexo.log.info("Publishing update to Bluesky with payload:", recordPayload);

    try {
      const recordResponse = await axios.post(
        createRecordUrl,
        recordPayload,
        {
          headers: {
            "Authorization": `Bearer ${accessJwt}`,
            "Content-Type": "application/json"
          }
        }
      );
      hexo.log.info("Successfully published update to Bluesky:", recordResponse.data);
    } catch (error) {
      hexo.log.error("Failed to publish update to Bluesky:", error.response ? error.response.data : error.message);
    }
  });
};
