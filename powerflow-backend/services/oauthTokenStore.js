const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_TOKEN_PATH = path.join(__dirname, '../secure/google-oauth-token.enc');

function getTokenPath() {
  const configuredPath = process.env.GOOGLE_TOKEN_PATH || DEFAULT_TOKEN_PATH;
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(path.join(__dirname, '..', configuredPath));
}

function getEncryptionKey() {
  const secret = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;

  if (!secret || secret.length < 32) {
    throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY must be set and at least 32 characters long.');
  }

  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

async function ensureTokenDirectoryExists(tokenPath) {
  const directory = path.dirname(tokenPath);
  await fs.mkdir(directory, { recursive: true });
}

async function saveGoogleTokens(tokens) {
  const tokenPath = getTokenPath();
  const key = getEncryptionKey();

  await ensureTokenDirectoryExists(tokenPath);

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const plaintext = JSON.stringify(tokens);
  const encryptedBuffer = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const payload = {
    version: 1,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: encryptedBuffer.toString('base64'),
  };

  await fs.writeFile(tokenPath, JSON.stringify(payload), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

async function loadGoogleTokens() {
  const tokenPath = getTokenPath();
  const key = getEncryptionKey();

  try {
    const encryptedText = await fs.readFile(tokenPath, 'utf8');
    const payload = JSON.parse(encryptedText);

    const iv = Buffer.from(payload.iv, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decryptedBuffer = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return JSON.parse(decryptedBuffer.toString('utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw new Error(`Failed to load encrypted Google OAuth token: ${error.message}`);
  }
}

async function deleteGoogleTokens() {
  const tokenPath = getTokenPath();
  try {
    await fs.unlink(tokenPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

module.exports = {
  getTokenPath,
  saveGoogleTokens,
  loadGoogleTokens,
  deleteGoogleTokens,
};
