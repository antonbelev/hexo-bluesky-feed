'use strict';

const axios = require('axios');

module.exports = async function(args) {
  const log = this.log;
  log.info("Executing bluesky-feed deployer");

  // --- Configuration & Credentials ---
  // Required credentials are read from environment variables:
  // BLUESKY_HANDLE and BLUESKY_APP_PASSWORD.
  const handle = process.env.BLUESKY_HANDLE;
  const appPassword = process.env.BLUESKY_APP_PASSWORD;
  if (!handle || !appPassword) {
    log.error("Missing BLUESKY_HANDLE or BLUESKY_APP_PASSWORD in your environment.");
    return;
  }

  // Hardcoded API endpoints (managed internally)
  const sessionUrl = "https://bsky.social/xrpc/com.atproto.server.createSession";
  const createRecordUrl = "https://bsky.social/xrpc/com.atproto.repo.createRecord";

  // Additional configuration from _config.yml under blueskyFeed
  const config = this.config.blueskyFeed || {};
  if (!config.url) {
    log.error("Missing blueskyFeed.url in _config.yml. Please set it to your public website URL (e.g. https://belev.me/).");
    return;
  }
  const publicUrl = config.url; // URL used for constructing post links
  const messageTemplate = config.message || "Just published new blog post: {title}. Check it out here: {url}";

  // --- Retrieve Latest Post Metadata ---
  const posts = this.locals.get('posts');
  if (!posts || posts.length === 0) {
    log.error("No posts found in Hexo locals.");
    return;
  }
  const latestPost = posts.first();
  const postTitle = latestPost.title || "New post";
  let postUrl = args.postUrl;
  if (!postUrl) {
    if (!latestPost.path) {
      log.error("Latest post does not have a valid path.");
      return;
    }
    postUrl = publicUrl + latestPost.path;
  }
  const message = messageTemplate
    .replace("{title}", postTitle)
    .replace("{url}", postUrl);
  log.info("Constructed message: " + message);

  // --- Step 1: Obtain Fresh Access Token & DID ---
  let sessionResponse;
  try {
    sessionResponse = await axios.post(
      sessionUrl,
      {
        identifier: handle,
        password: appPassword
      },
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    log.error("Error creating session on Bluesky:", error.response ? error.response.data : error.message);
    return;
  }
  const sessionData = sessionResponse.data;
  if (!sessionData.accessJwt || !sessionData.did) {
    log.error("Session response missing accessJwt or did.");
    return;
  }
  const accessJwt = sessionData.accessJwt;
  const did = sessionData.did;
  log.info("Obtained access token and DID: " + did);

  // --- Step 2: Post Update to Bluesky ---
  const recordPayload = {
    repo: did, // Use the DID from the session response
    collection: "app.bsky.feed.post",
    record: {
      "$type": "app.bsky.feed.post",
      text: message,
      createdAt: new Date().toISOString()
    }
  };

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
    log.info("Successfully published update to Bluesky:");
    log.info(JSON.stringify(recordResponse.data, null, 2));
  } catch (error) {
    log.error("Failed to publish update to Bluesky:", error.response ? error.response.data : error.message);
    return;
  }
};
