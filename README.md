# hexo-bluesky-feed

A Hexo deployer plugin that automatically publishes updates to your Bluesky account when you deploy your Hexo site.

## Installation

Install the package via npm in your Hexo site directory:

```bash
npm install hexo-bluesky-feed --save
```

## Configuration

### Securely Setting Your Bluesky Credentials

**Do not** place sensitive data (like your access token) directly in your `_config.yml`. Instead, you can use environment variables or a `.env` file.

#### Option A: Using a `.env` File

1. Create a file named `.env` in your Hexo root directory (the same directory as your `_config.yml`):
2. Make sure to add `.env` to your `.gitignore:`

#### Option B: Using Shell Environment Variables
Export your variables before deploying:

```bash
export BLUESKY_API_URL="https://api.bluesky.example.com/posts"
export BLUESKY_ACCESS_TOKEN="YOUR_SECRET_ACCESS_TOKEN"
hexo deploy
```

### Hexo Configuration

In your Hexo site's `_config.yml`, add a deploy section that uses the bluesky-feed deployer. You can also include non-sensitive defaults under the `blueskyFeed` section:


```yml
# _config.yml

# Your site URL (used to construct links in the deploy message)
url: https://yourblog.example.com

deploy:
  type: bluesky
  message: "I just published a new post on my blog!"

# Bluesky configuration
bluesky:
  apiUrl: "https://api.bluesky.example.com/posts"  # Replace with the actual Bluesky endpoint URL.
  accessToken: "YOUR_SECRET_ACCESS_TOKEN"           # Keep this secret and do not commit it to public repositories.
```

## Obtaining Your BLUESKY_ACCESS_TOKEN

To let the plugin post updates to your Bluesky account, you’ll need to obtain a valid access token. Follow these steps:

1. Create a Bluesky Account
If you haven’t already, sign up for a Bluesky account at [https://bsky.app](https://bsky.app). This is your starting point for accessing the platform.

2. Generate an App Password
   
Once logged in, navigate to your account settings and look for the “App Password” section. Generate an app password dedicated to API integrations. Using an app password instead of your primary password improves security by granting limited access.
   
3. Obtain an Access Token via the API

With your Bluesky handle (e.g., yourusername.bsky.social) and app password in hand, make a POST request to the Bluesky authentication endpoint. For example, you can use curl:

```bash
curl -X POST https://bsky.social/xrpc/com.atproto.server.createSession \
  -H "Content-Type: application/json" \
  -d '{"identifier": "yourusername.bsky.social", "password": "YOUR_APP_PASSWORD"}'
```

The response will be a JSON object that includes two tokens:

- **accessJwt**: This is your short-lived access token (BLUESKY_ACCESS_TOKEN) that authorizes API requests.
- **refreshJwt**: This token can be used to obtain a new access token once the current one expires.

For more details on the API endpoints and the returned payload, refer to the [Bluesky Get Started documentation](https://docs.bsky.app/docs/get-started) and the [AT Protocol XRPC API](https://docs.bsky.app/docs/api/at-protocol-xrpc-api) reference.

4. Store Your Tokens Securely

Once you have the tokens, store the access token in an environment variable (or a secure, git‑ignored file like a `.env` file) so that it isn’t accidentally committed to version control. For example, your `.env` file might include:

```bash
BLUESKY_API_URL=https://bsky.social/xrpc/com.atproto.repo.createRecord
BLUESKY_ACCESS_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important**: Do not store your app password or tokens in your public repository. Always add your `.env` file to your `.gitignore`.

5. Token Expiration and Refresh

The access token (`accessJwt`) expires after a short period (typically minutes to a few hours). When it expires, use the refresh token (`refreshJwt`) to request a new access token by calling the `com.atproto.server.refreshSession` endpoint. This process ensures that your integration remains authenticated without requiring you to re-enter credentials.

By following these steps, you’ll be able to securely obtain and manage your `BLUESKY_ACCESS_TOKEN`, keeping your credentials safe while allowing the plugin to post updates on your behalf.

## Usage
After configuring your credentials and updating your `_config.yml`, simply run:

```bash
hexo deploy
```

The deployer will build your site and send an update to your Bluesky account using the provided configuration.


## License
This project is licensed under the MIT License. See the LICENSE file for details.
