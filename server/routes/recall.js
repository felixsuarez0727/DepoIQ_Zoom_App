import express from 'express';
import { recallConfig } from '../../config.js';
import { refreshToken } from '../helpers/zoom-api.js';
import createError from 'http-errors';
import session from '../session.js';
import { getTokensForUser, saveTokensForUser } from '../helpers/token-store.js';

const router = express.Router();

// 1. Function to verify that the request comes from Recall.ai
const verify_request_is_from_recall = (request) => {
    const auth_token = request.query?.auth_token || request.headers['x-auth-token'];
    return auth_token && auth_token === recallConfig.authToken;
};

// 2. Function to obtain the user_id of the request
const get_user_id_from_request = (request) => {
    // Prioritizes the user_id of the URL (required by Recall), if it is not present, the session's user_id is used    
    const user_id = request.query.user_id || request.session?.zoomTokens?.userId;
    console.log("user_id HERE");
    console.log(user_id);
    
    if (!user_id) throw createError(401, 'User ID not provided or not found in session');
    return user_id;
};

// 3. Function to obtain the user's access_token
const get_access_token_by_user_id = async (request, user_id) => {
  const tokens = await getTokensForUser(user_id);
  if (!tokens) {
      // Redirect logic could be triggered here if this function is called from a browser-based route
      throw createError(401, `No tokens found for user ${user_id}. User needs to reauthorize.`);
  }

  if (tokens.expiresAt < Date.now() + 120000) {
      console.log('Refreshing token...');
      try {
          const { access_token, refresh_token, expires_in } = await refreshToken(tokens.refreshToken);
          await saveTokensForUser(user_id, {
              accessToken: access_token,
              refreshToken: refresh_token || tokens.refreshToken,
              expiresAt: Date.now() + (expires_in * 1000)
          });
          return access_token;
      } catch (err) {
          // Refresh token invalid (possibly revoked), prompt re-auth
          throw createError(401, `Invalid refresh token for user ${user_id}. Needs reauthorization.`);
      }
  }

  return tokens.accessToken;
};


// 4. Main function that handles the request
// GET endpoint for Recall.ai (uses query params)
router.get('/callback', session, async (req, res) => {
    try {
        const { auth_token } = req.query;

        if (!auth_token) {
            return res.status(400).send('auth_token is required');
        }

        if (!verify_request_is_from_recall(req)) {
            return res.status(401).send('Unauthorized: Invalid auth_token');
        }

        const user_id = get_user_id_from_request(req);

        const access_token = await get_access_token_by_user_id(req, user_id);
        res.set('Content-Type', 'text/plain').send(access_token); // Return the access_token as plain text

    } catch (error) {
      console.error('Recall callback error:', error);

      if (error.status === 401) {
          // Render a view asking for reauthentication
          return res.status(401).render('reauth', {
              title: 'Reconnect Required',
              message: error.message || 'You need to reauthorize Zoom access.'
          });
      }

      // Other errors
      res.status(error.status || 500).send(error.message);
    }
});

/**
 * Test route to view session content (for DEBUG)
 */
router.get('/test', session, (req, res) => {
    console.log('Received Headers:', req.headers);
    console.log('Received Cookies:', req.headers.cookie);
    console.log('Complete Session:', req.session);
    
    res.json({
      status: 'success',
      headers: req.headers,
      cookies: req.headers.cookie,
      session: req.session || 'There is no session',
      sessionId: req.sessionID || 'There is no sessionID'
    });
  });

export default router;