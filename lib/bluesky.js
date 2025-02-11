'use strict';

const axios = require('axios');

module.exports = async function doBlueskyPost() {
  const hexo = this;
  const log = hexo.log;

  // 0. Optional: Skip if user passed --skipBluesky
  if (process.argv.includes('--skipBluesky')) {
    log.info('[Bluesky Feed] --skipBluesky set. Skipping Bluesky posting.');
    return;
  }

  log.info('[Bluesky Feed] Deployment finished. Preparing Bluesky update...');

  // 1. Check environment variables
  const handle = process.env.BLUESKY_HANDLE;
  const appPassword = process.env.BLUESKY_APP_PASSWORD;
  if (!handle || !appPassword) {
    log.warn('[Bluesky Feed] Missing BLUESKY_HANDLE or BLUESKY_APP_PASSWORD. Skipping...');
    return;
  }

  // 2. Grab config + last post
  const config = hexo.config.blueskyFeed || {};
  const siteUrl = config.url || hexo.config.url; // fallback to Hexo's main url
  if (!siteUrl) {
    log.warn('[Bluesky Feed] No site URL configured. Skipping...');
    return;
  }

  // Get the latest post from locals
  const posts = hexo.locals.get('posts');
  if (!posts || !posts.length) {
    log.info('[Bluesky Feed] No posts found. Skipping...');
    return;
  }

  const latestPost = posts.sort('-date').data[0];
  const postTitle = latestPost.title || 'New post';
  const postPath = latestPost.path;
  const postUrl = siteUrl.replace(/\/?$/, '/') + postPath; // ensure trailing slash

  // Construct message from config or default:
  const template = config.message || 'Just published new blog post: {title}. {url}';
  const message = template
    .replace('{title}', postTitle)
    .replace('{url}', postUrl);

  // 3. Obtain an access token from Bluesky
  let sessionData;
  try {
    const { data } = await axios.post(
      'https://bsky.social/xrpc/com.atproto.server.createSession',
      { identifier: handle, password: appPassword },
      { headers: { 'Content-Type': 'application/json' } }
    );
    sessionData = data;
  } catch (error) {
    log.error('[Bluesky Feed] Failed to create Bluesky session:', error.response?.data || error.message);
    return;
  }

  const { accessJwt, did } = sessionData || {};
  if (!accessJwt || !did) {
    log.error('[Bluesky Feed] Missing accessJwt or did in session response. Aborting...');
    return;
  }

  // 4. Post update to Bluesky
  const facets = makeLinkFacetIfPossible(message, postUrl);
  const recordPayload = {
    repo: did,
    collection: 'app.bsky.feed.post',
    record: {
      '$type': 'app.bsky.feed.post',
      text: message,
      createdAt: new Date().toISOString(),
      ...(facets ? { facets } : {})
    }
  };

  try {
    await axios.post('https://bsky.social/xrpc/com.atproto.repo.createRecord', recordPayload, {
      headers: {
        'Authorization': `Bearer ${accessJwt}`,
        'Content-Type': 'application/json'
      }
    });
    log.info('[Bluesky Feed] Successfully posted update to Bluesky!');
  } catch (error) {
    log.error('[Bluesky Feed] Failed to publish to Bluesky:', error.response?.data || error.message);
  }
};

/** Helper: Create a "link facet" for clickable link in Bluesky post if the URL is in the text. */
function makeLinkFacetIfPossible(message, url) {
  const start = message.indexOf(url);
  if (start === -1) return null;
  return [
    {
      index: {
        byteStart: start,
        byteEnd: start + url.length
      },
      features: [
        {
          '$type': 'app.bsky.richtext.facet#link',
          'uri': url
        }
      ]
    }
  ];
}
