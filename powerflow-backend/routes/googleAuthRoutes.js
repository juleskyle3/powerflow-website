const express = require('express');
const router = express.Router();
const {
  getGoogleAuthUrl,
  handleGoogleOAuthCallback,
  getAuthStatus,
  sendEmail,
  clearGoogleAuthorization,
} = require('../services/gmailService');
const {
  getDefaultAdminOrdersUrl,
  getGoogleOAuthSuccessRedirectUrl,
  getGoogleOAuthErrorRedirectUrl,
  appendQueryParams,
} = require('../config/redirects');

router.get('/auth/google', async (req, res, next) => {
  try {
    const authUrl = await getGoogleAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
});

router.get('/oauth2callback', async (req, res, next) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.redirect(appendQueryParams(getGoogleOAuthErrorRedirectUrl(), {
        gmailOAuth: 'error',
        reason: error,
      }));
    }

    if (!code) {
      return res.redirect(appendQueryParams(getGoogleOAuthErrorRedirectUrl(), {
        gmailOAuth: 'error',
        reason: 'missing_oauth_code',
      }));
    }

    const result = await handleGoogleOAuthCallback(code);

    return res.redirect(appendQueryParams(getGoogleOAuthSuccessRedirectUrl(), {
      gmailOAuth: 'success',
      authorized: result.authorized,
      hasRefreshToken: result.hasRefreshToken,
    }));
  } catch (callbackError) {
    return res.redirect(appendQueryParams(getGoogleOAuthErrorRedirectUrl(), {
      gmailOAuth: 'error',
      reason: callbackError.message || 'oauth_callback_failed',
    }));
  }
});

router.get('/api/auth/google/status', async (req, res, next) => {
  try {
    const status = await getAuthStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/api/auth/google/auth-url', async (req, res, next) => {
  try {
    const authUrl = await getGoogleAuthUrl();
    res.json({
      success: true,
      data: {
        authUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/api/auth/google/redirects', (req, res) => {
  res.json({
    success: true,
    data: {
      defaultAdminOrdersRedirect: getDefaultAdminOrdersUrl(),
      successRedirect: getGoogleOAuthSuccessRedirectUrl(),
      errorRedirect: getGoogleOAuthErrorRedirectUrl(),
      oauthCallback: process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3001/oauth2callback',
    },
  });
});

router.post('/api/auth/google/reset', async (req, res, next) => {
  try {
    await clearGoogleAuthorization();
    res.status(200).json({
      success: true,
      message: 'Google OAuth authorization has been reset. Re-authorize via /auth/google.',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/api/auth/google/test-email', async (req, res, next) => {
  try {
    const { to, subject, message } = req.body || {};

    if (!to) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing "to" email in request body',
        },
      });
    }

    const result = await sendEmail(
      to,
      subject || 'Power Flow Gmail OAuth Test',
      message || 'This is a Gmail OAuth test email from Power Flow backend.'
    );

    return res.status(200).json({
      success: true,
      message: 'Test email sent successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
