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
    console.log(request);
    
    const user_id = request.query.user_id || request.session?.zoomTokens?.userId;
    console.log("user_id HERE");
    console.log(user_id);
    
    if (!user_id) throw createError(401, 'User ID not provided or not found in session');
    return user_id;
};

// 3. Function to obtain the user's access_token
// const get_access_token_by_user_id = async (request, user_id) => {

//     // 1. Check if there are tokens in session for that user_id
//     if (request.session?.zoomTokens?.userId === user_id) {
//         const { accessToken, refresh_Token, expiresAt } = request.session.zoomTokens;

//         // Renew the token if it is about to expire (2 minutes margin)
//         if (expiresAt < Date.now() + 120000) {
//             console.log('Refreshing token...');
//             const { access_token, refresh_token, expires_in } = await refreshToken(refresh_Token);

//             // Refresh the session with the new tokens
//             request.session.zoomTokens = {
//                 accessToken: access_token,
//                 refresh_Token: refresh_token || refreshToken, // The new refresh_token is used
//                 expiresAt: Date.now() + (expires_in * 1000), // New expiration timestamp
//                 userId: request.session.zoomTokens.userId
//             };

//             return access_token;
//         }
//         return accessToken;
//     }

//     // 2. If there are no tokens for that user_id, reauthentication is requested
//     throw createError(401, `No tokens found for user ${user_id}. Reauthenticate with Zoom.`);
// };
const get_access_token_by_user_id = async (request, user_id) => {
    const tokens = await getTokensForUser(user_id);
    if (!tokens) throw createError(401, `No tokens found for user ${user_id}.`);
  
    if (tokens.expiresAt < Date.now() + 120000) {
      console.log('Refreshing token...');
      const {
        access_token,
        refresh_token,
        expires_in
      } = await refreshToken(tokens.refreshToken);
  
      // 💾 Guardar nuevos tokens
      await saveTokensForUser(user_id, {
        accessToken: access_token,
        refreshToken: refresh_token || tokens.refreshToken,
        expiresAt: Date.now() + (expires_in * 1000)
      });
  
      return access_token;
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