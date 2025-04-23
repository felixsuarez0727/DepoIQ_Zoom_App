import express from 'express';
import { query } from 'express-validator';

import { handleError, sanitize } from '../helpers/routing.js';
import { getDeeplink, getToken } from '../helpers/zoom-api.js';

import session from '../session.js';

const router = express.Router();

router.get('/', session, async (req, res, next) => {
    try {
        const { code } = req.query;
        const verifier = req.session.verifier;

        // DEBUG
        // console.log("Path that receives the Zoom redirected authentication");
        // console.log("code: ", code);
        // console.log("verifier: ", verifier);
        
        // Get Tokens + user_id from Zoom
        const { 
            access_token, 
            refresh_token, 
            expires_in,
            user_id
        } = await getToken(code, verifier);

        // DEBUG
        // console.log("Authenticated user_id:", user_id);
        // console.log("refresh_token:", refresh_token);

        // Save the tokens and user ID in the session
        req.session.zoomTokens = {
            accessToken: access_token,
            refresh_Token: refresh_token,
            expiresAt: Date.now() + (expires_in * 1000),
            userId: user_id
        };

        // Generate and redirect to the URL to download the app in the Zoom Marketplace Client
        const deeplink = await getDeeplink(access_token); // fetch deeplink from Zoom API
        res.redirect(deeplink);
    } catch (e) {
        next(handleError(e));
    }
});

export default router;
