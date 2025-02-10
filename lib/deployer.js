'use strict';

const axios = require('axios');

module.exports = async function(args) {
  const log = this.log;
  log.info("Executing bluesky-feed deployer");

  // --- Configuration & Credentials ---
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
  const publicUrl = config.url;
  const messageTemplate = config.message || "Just published new blog post: {title}. Check it out here: {url}";

  // --- Debug: Log Hexo locals and posts ---
  console.log("DEBUG: Hexo locals:", this.locals);
  const postsCollection = this.locals.get('posts');
  if (!postsCollection) {
    log.error("hexo.locals.get('posts') returned undefined");
    return;
  }
  log.debug("DEBUG: Posts collection (raw):", postsCollection);

  // --- Retrieve Latest Post Metadata using date field ---
  let postsArray = typeof postsCollection.toArray === 'function' ? postsCollection.toArray() : postsCollection;
  log.debug("DEBUG: Number of posts found: " + postsArray.length);

  if (postsArray.length === 0) {
    log.error("No posts found in Hexo locals.");
    return;
  }
  // Sort posts by their date field descending using the Moment instance's toDate()
  postsArray.sort((a, b) => {
    // If date is a Moment instance, use toDate(); otherwise, fallback to new Date()
    const dateA = typeof a.date.toDate === 'function' ? a.date.toDate() : new Date(a.date);
    const dateB = typeof b.date.toDate === 'function' ? b.date.toDate() : new Date(b.date);
    return dateB - dateA;
  });
  const latestPost = postsArray[0];
  log.debug("DEBUG: Latest post object after sorting by date:", latestPost);

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

  // --- Attach URL Facet for Clickable Link ---
  const urlStart = message.indexOf(postUrl);
  let facets;
  if (urlStart !== -1) {
    const urlEnd = urlStart + postUrl.length;
    facets = [
      {
        index: {
          byteStart: urlStart,
          byteEnd: urlEnd
        },
        features: [
          { "$type": "app.bsky.richtext.facet#link", "uri": postUrl }
        ]
      }
    ];
    log.debug("DEBUG: Constructed facets:", facets);
  } else {
    log.warn("Post URL not found in message; link facet will not be attached.");
  }

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
    log.debug("DEBUG: Session response:", sessionResponse.data);
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
    repo: did,
    collection: "app.bsky.feed.post",
    record: {
      "$type": "app.bsky.feed.post",
      text: message,
      createdAt: new Date().toISOString()
    }
  };

  if (facets) {
    recordPayload.record.facets = facets;
  }

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
