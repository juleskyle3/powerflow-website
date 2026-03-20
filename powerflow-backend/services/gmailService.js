const fs = require('fs');
const path = require('path');
const {
  loadGoogleTokens,
  saveGoogleTokens,
  deleteGoogleTokens,
  getTokenPath,
} = require('./oauthTokenStore');

let google = null;
let googleImportError = null;

try {
  ({ google } = require('googleapis'));
} catch (error) {
  googleImportError = error;
}

let oauthClientPromise = null;
let cachedTokens = null;
const DEFAULT_SENDER_EMAIL = 'powerflowservicesltd@gmail.com';

function extractEmailAddress(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const angleMatch = raw.match(/<([^>]+)>/);
  if (angleMatch && angleMatch[1]) {
    return angleMatch[1].trim();
  }
  return raw.includes('@') ? raw : '';
}

function parseJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function resolveCredentialsPath() {
  const configuredPath = process.env.GOOGLE_CREDENTIALS_PATH || 'credentials.json';
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(path.join(__dirname, '..', configuredPath));
}

function ensureGoogleApisInstalled() {
  if (!google) {
    throw new Error(
      `googleapis package is not installed. Install it with: npm install googleapis (details: ${googleImportError?.message || 'unknown error'})`
    );
  }
}

function loadOAuthCredentials() {
  const credentialsPath = resolveCredentialsPath();

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Google credentials file not found at ${credentialsPath}`);
  }

  const raw = fs.readFileSync(credentialsPath, 'utf8');
  const parsed = JSON.parse(raw);
  const config = parsed.web || parsed.installed || parsed;

  const clientId = process.env.GOOGLE_CLIENT_ID || config.client_id;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || config.client_secret;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || (Array.isArray(config.redirect_uris) ? config.redirect_uris[0] : undefined);

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Google OAuth credentials. Ensure client_id, client_secret, and redirect URI are set.');
  }

  const looksLikePlaceholder = (value) => /^replace[_\-\s]?with/i.test(String(value || '').trim());
  if (looksLikePlaceholder(clientSecret)) {
    throw new Error('Google client_secret is still a placeholder. Update credentials.json with your real client secret.');
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

function getScopes() {
  const configured = String(process.env.GOOGLE_OAUTH_SCOPES || '').trim();
  const defaults = [
    'https://www.googleapis.com/auth/gmail.send',
    // Used for best-effort mailbox verification via gmail.users.getProfile.
    'https://www.googleapis.com/auth/gmail.readonly',
  ];

  const raw = configured ? configured.split(/[\s,]+/g) : defaults;
  const cleaned = raw.map((scope) => scope.trim()).filter(Boolean);
  const scopes = new Set(cleaned);
  // Hard requirement for sending invoices.
  scopes.add('https://www.googleapis.com/auth/gmail.send');
  return Array.from(scopes);
}

async function initializeOAuthClient() {
  if (!oauthClientPromise) {
    oauthClientPromise = (async () => {
      ensureGoogleApisInstalled();
      const { clientId, clientSecret, redirectUri } = loadOAuthCredentials();

      const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

      const storedTokens = await loadGoogleTokens();
      if (storedTokens) {
        cachedTokens = storedTokens;
        client.setCredentials(storedTokens);
      }

      client.on('tokens', async (newTokens) => {
        cachedTokens = {
          ...(cachedTokens || {}),
          ...newTokens,
        };

        await saveGoogleTokens(cachedTokens);
      });

      return client;
    })();
  }

  return oauthClientPromise;
}

async function getGoogleAuthUrl() {
  const client = await initializeOAuthClient();
  const SCOPES = getScopes();

  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force permission screen
    include_granted_scopes: true,
    scope: SCOPES,
  });
}


async function handleGoogleOAuthCallback(code) {
  const client = await initializeOAuthClient();
  const { tokens } = await client.getToken(code);

  cachedTokens = {
    ...(cachedTokens || {}),
    ...tokens,
  };

  if (!cachedTokens.refresh_token && client.credentials.refresh_token) {
    cachedTokens.refresh_token = client.credentials.refresh_token;
  }

  client.setCredentials(cachedTokens);
  await saveGoogleTokens(cachedTokens);

  return {
    authorized: true,
    hasRefreshToken: Boolean(cachedTokens.refresh_token),
    expiryDate: cachedTokens.expiry_date || null,
  };
}

function toBase64Url(input) {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function wrapBase64(base64Text, width = 76) {
  const lines = [];
  for (let i = 0; i < base64Text.length; i += width) {
    lines.push(base64Text.slice(i, i + width));
  }
  return lines.join('\r\n');
}

function buildRawMimeMessage({ from, to, subject, text, html, attachments = [] }) {
  const boundary = `boundary_${Date.now().toString(16)}`;
  const hasHtml = Boolean(html);

  const mimeLines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: ${hasHtml ? 'text/html' : 'text/plain'}; charset="UTF-8"`,
    'Content-Transfer-Encoding: 7bit',
    '',
    hasHtml ? html : text,
    '',
  ];

  attachments.forEach((attachment) => {
    const contentType = attachment.contentType || 'application/octet-stream';
    const fileName = attachment.filename || 'attachment.bin';
    const content = Buffer.isBuffer(attachment.content)
      ? attachment.content
      : Buffer.from(String(attachment.content || ''), 'utf8');

    mimeLines.push(`--${boundary}`);
    mimeLines.push(`Content-Type: ${contentType}; name="${fileName}"`);
    mimeLines.push('Content-Transfer-Encoding: base64');
    mimeLines.push(`Content-Disposition: attachment; filename="${fileName}"`);
    mimeLines.push('');
    mimeLines.push(wrapBase64(content.toString('base64')));
    mimeLines.push('');
  });

  mimeLines.push(`--${boundary}--`);

  return toBase64Url(mimeLines.join('\r\n'));
}

async function getAuthStatus() {
  try {
    ensureGoogleApisInstalled();
    const credentials = loadOAuthCredentials();
    const tokens = await loadGoogleTokens();
    const tokenPayload = parseJwtPayload(tokens?.id_token);
    const configuredScopes = getScopes();
    const grantedScopes = typeof tokens?.scope === 'string'
      ? Array.from(new Set(tokens.scope.split(/[\s,]+/g).map((scope) => scope.trim()).filter(Boolean)))
      : null;
    const tokenPath = getTokenPath();
    const tokenFileExists = fs.existsSync(tokenPath);
    const configuredSender = extractEmailAddress(
      process.env.GMAIL_SENDER_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || DEFAULT_SENDER_EMAIL
    );

    let oauthMailbox = null;
    if (tokens && (tokens.refresh_token || tokens.access_token)) {
      try {
        const client = await initializeOAuthClient();
        const gmail = google.gmail({ version: 'v1', auth: client });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        oauthMailbox = profile?.data?.emailAddress || null;
      } catch (_) {
        oauthMailbox = null;
      }
    }

    return {
      configured: Boolean(credentials.clientId && credentials.redirectUri),
      authorized: Boolean(tokens && (tokens.refresh_token || tokens.access_token)),
      hasRefreshToken: Boolean(tokens && tokens.refresh_token),
      redirectUri: credentials.redirectUri,
      credentialsPath: resolveCredentialsPath(),
      tokenPath,
      tokenFileExists,
      configuredScopes,
      grantedScopes,
      configuredSender,
      oauthAccountEmail: tokenPayload?.email || null,
      oauthMailbox,
    };
  } catch (error) {
    return {
      configured: false,
      authorized: false,
      error: error.message,
    };
  }
}

async function sendEmail(to, subject, message, options = {}) {
  if (!to || !subject || !message) {
    throw new Error('sendEmail requires to, subject, and message.');
  }

  const client = await initializeOAuthClient();

  const tokens = client.credentials || {};
  if (!tokens.refresh_token && !tokens.access_token) {
    throw new Error('Gmail OAuth is not authorized yet. Open /auth/google first.');
  }

  const gmail = google.gmail({
    version: 'v1',
    auth: client,
  });

  const configuredSender = extractEmailAddress(
    options.from
    || process.env.GMAIL_SENDER_EMAIL
    || process.env.SMTP_FROM
    || process.env.SMTP_USER
    || DEFAULT_SENDER_EMAIL
  );

  const fromEmail = configuredSender;

  if (!fromEmail) {
    throw new Error('Missing sender email. Set GMAIL_SENDER_EMAIL or SMTP_FROM or SMTP_USER in .env.');
  }

  const strictSenderMatch = String(process.env.GMAIL_STRICT_SENDER || 'true').toLowerCase() !== 'false';
  if (strictSenderMatch) {
    let oauthMailbox = '';

    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      oauthMailbox = extractEmailAddress(profile?.data?.emailAddress);
    } catch (error) {
      // Some OAuth setups only grant gmail.send; users.getProfile can fail with:
      // "Request had insufficient authentication scopes."
      // In that case, skip strict verification so sending can still proceed.
      const msg = String(error?.message || '');
      if (!/insufficient authentication scopes/i.test(msg)) {
        throw error;
      }

      // Try a secondary mailbox lookup using the Google OAuth2 userinfo API if available.
      // This requires userinfo.email scope.
      try {
        const oauth2 = google.oauth2({ version: 'v2', auth: client });
        const me = await oauth2.userinfo.get();
        oauthMailbox = extractEmailAddress(me?.data?.email);
      } catch (_) {
        oauthMailbox = '';
      }
    }

    if (oauthMailbox && configuredSender && oauthMailbox.toLowerCase() !== configuredSender.toLowerCase()) {
      throw new Error(
        `Gmail OAuth account mismatch. Authorized mailbox is "${oauthMailbox}" but configured sender is "${configuredSender}". ` +
        'Reset OAuth via POST /api/auth/google/reset, then re-authorize /auth/google with the company mailbox.'
      );
    }
  }

  const raw = buildRawMimeMessage({
    from: fromEmail,
    to,
    subject,
    text: message,
    html: options.html,
    attachments: options.attachments || [],
  });

  let response;
  try {
    response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });
  } catch (error) {
    const msg = String(error?.message || '');
    if (/insufficient authentication scopes/i.test(msg)) {
      const scopesHint = getScopes().join(' ');
      throw new Error(
        'Gmail send failed due to missing OAuth scopes. ' +
        `Update GOOGLE_OAUTH_SCOPES (currently configured as: ${scopesHint}), then reset OAuth (POST /api/auth/google/reset) and re-authorize via /auth/google. ` +
        `Original error: ${msg}`
      );
    }
    throw error;
  }

  return response.data;
}

async function isGmailReadyForSend() {
  try {
    const status = await getAuthStatus();
    return status.configured && status.authorized;
  } catch (_) {
    return false;
  }
}

async function clearGoogleAuthorization() {
  await deleteGoogleTokens();
  cachedTokens = null;
  oauthClientPromise = null;
}

module.exports = {
  getGoogleAuthUrl,
  handleGoogleOAuthCallback,
  sendEmail,
  getAuthStatus,
  isGmailReadyForSend,
  clearGoogleAuthorization,
};
