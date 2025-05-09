import express from 'express';
import { query } from 'express-validator';

import { handleError, sanitize } from '../helpers/routing.js';
import { getDeeplink, getToken } from '../helpers/zoom-api.js';

import session from '../session.js';
import { saveTokensForUser } from '../helpers/token-store.js';
import { recallConfig } from '../../config.js';
// import fetch from 'node-fetch';

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

        // Save in the JSON File
        await saveTokensForUser(user_id, {
            accessToken: access_token,
            refresh_Token: refresh_token,
            expiresAt: Date.now() + (expires_in * 1000)
        });

        // Check if a credential already exists for this user
        const listUrl = `https://us-east-1.recall.ai/api/v2/zoom-oauth-credentials/?oauth_app=${recallConfig.oauthAppId}&user_id=${user_id}`;
        const listResponse = await fetch(listUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Token ${recallConfig.apiKey}`,
                'Accept': 'application/json'
            }
        });

        let shouldCreateCredential = true;
        
        if (listResponse.ok) {
            const credentialsData = await listResponse.json();
            if (credentialsData.results && credentialsData.results.length > 0) {
                const existingCredential = credentialsData.results[0];
                
                // Construct the expected URL to compare
                const expectedCallbackUrl = `${recallConfig.callbackBaseURL}/api/recall/callback?user_id=${user_id}&auth_token=${recallConfig.authToken}`;
                
                // Check both the status and the callback URL
                if (existingCredential.status === 'healthy' && 
                    existingCredential.access_token_callback_url === expectedCallbackUrl) {
                    shouldCreateCredential = false;
                    console.log('✅ Healthy credential exists with correct callback URL');
                } else {
                    console.log('ℹ️ Credential exists but needs update because:');
                    if (existingCredential.status !== 'healthy') {
                        console.log(`- Status is "${existingCredential.status}" (expected "healthy")`);
                    }
                    if (existingCredential.access_token_callback_url !== expectedCallbackUrl) {
                        // Extract only the base domain for display
                        const existingBase = existingCredential.access_token_callback_url?.split('/api')[0];
                        const expectedBase = expectedCallbackUrl?.split('/api')[0];
                        
                        console.log('- Callback URL mismatch:');
                        console.log('  Existing:', existingBase);
                        console.log('  Expected:', expectedBase);
                    }
                }
            }
        } else {
            const errText = await listResponse.text();
            console.error('Error al listar credenciales existentes:', errText);
        }

        // Create Zoom OAuth credentials in Recall only if needed
        if (shouldCreateCredential) {
            const recallResponse = await fetch('https://us-east-1.recall.ai/api/v2/zoom-oauth-credentials/', {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${recallConfig.apiKey}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    oauth_app: recallConfig.oauthAppId,
                    access_token_callback_url: `${recallConfig.callbackBaseURL}/api/recall/callback?user_id=${user_id}&auth_token=${recallConfig.authToken}`
                })
            });

            if (!recallResponse.ok) {
                const errText = await recallResponse.text();
                console.error('Recall credential creation failed:', errText);
                throw new Error('Failed to register OAuth credential with Recall');
            } else {
                console.log('New credential created successfully');
            }
        }

        // Generate and redirect to the URL to download the app in the Zoom Marketplace Client
        const deeplink = await getDeeplink(access_token); // fetch deeplink from Zoom API
        res.redirect(deeplink);
    } catch (e) {
        next(handleError(e));
    }
});

export default router;