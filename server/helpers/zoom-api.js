import axios from 'axios';
import { URL } from 'url';
import { zoomApp } from '../../config.js';
import createError from 'http-errors';
import crypto from 'crypto';

// returns a base64 encoded url
const base64URL = (s) =>
    s
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

// returns a random string of format fmt
const rand = (fmt, depth = 32) => crypto.randomBytes(depth).toString(fmt);

// Get Zoom API URL from Zoom Host value
const host = new URL(zoomApp.host);
host.hostname = `api.${host.hostname}`;

const baseURL = host.href;

/**
 * Generic function for getting access or refresh tokens
 * @param {string} [id=''] - Username for Basic Auth
 * @param {string} [secret=''] - Password for Basic Auth
 * @param {Object} params - Request parameters (form-urlencoded)
 */
function tokenRequest(params, id = '', secret = '') {
    const username = id || zoomApp.clientId;
    const password = secret || zoomApp.clientSecret;

    return axios({
        data: new URLSearchParams(params).toString(),
        baseURL: zoomApp.host,
        url: '/oauth/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
            username,
            password,
        },
    }).then(({ data }) => Promise.resolve(data));
}

/**
 * Generic function for making requests to the Zoom API
 * @param {string} method - Request method (GET, POST, etc.)
 * @param {string | URL} endpoint - Zoom API endpoint
 * @param {string} token - Zoom access token
 * @param {object} [data=null] - Request body (for POST, PUT, etc.)
 * @param {object} [customHeaders={}] - Optional additional headers
 * @returns {Promise<object>} - Zoom API response data
 */
function apiRequest(method, endpoint, token, data = null, customHeaders = {}) {
    return axios({
        method,
        baseURL,
        url: `/v2${endpoint}`,
        data,
        headers: {
            Authorization: `Bearer ${token}`,
            ...customHeaders, // Optional custom headers go here
        },
    }).then(({ data }) => Promise.resolve(data));
}

/**
 * Return the url, state and verifier for the Zoom App Install
 * @return {{verifier: string, state: string, url: module:url.URL}}
 */
export function getInstallURL() {
    const state = rand('base64');
    const verifier = rand('ascii');

    const digest = crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64')
        .toString();

    const challenge = base64URL(digest);

    const url = new URL('/oauth/authorize', zoomApp.host);    
    
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', zoomApp.clientId);
    url.searchParams.set('redirect_uri', zoomApp.redirectUrl);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', state);

    // DEBUG
    // console.log("URL generated in getInstallURL");
    // console.log(url);    

    return { url, state, verifier };
}

/**
 * Obtains an OAuth access token and user info from Zoom
 * @param {string} code - Authorization code
 * @param {string} verifier - code_verifier for PKCE
 * @return {Promise} Resolves to { access_token, refresh_token, expires_in, user_id }
 */
export async function getToken(code, verifier) {
    if (!code || typeof code !== 'string')
        throw createError(500, 'authorization code must be a valid string');

    if (!verifier || typeof verifier !== 'string')
        throw createError(500, 'code verifier code must be a valid string');

    // 1. Get tokens
    const tokenData = await tokenRequest({
        code,
        code_verifier: verifier,
        redirect_uri: zoomApp.redirectUrl,
        grant_type: 'authorization_code',
    });

    // DEBUG
    // console.log("tokenData: ");
    // console.log(tokenData);
    
    // 2. Obtain user information
    const userInfo = await apiRequest(
        'GET',
        '/users/me',
        tokenData.access_token
    );

    return {
        ...tokenData,
        user_id: userInfo.id // Add user_id to reply
    };
}

/**
 * Obtain a new Access Token from a Zoom Refresh Token
 * @param {string} token - Refresh token to use
 * @return {Promise<void>}
 */
export async function refreshToken(token) {
    if (!token || typeof token !== 'string')
        throw createError(500, 'refresh token must be a valid string');

    return tokenRequest({
        refresh_token: token,
        grant_type: 'refresh_token',
    });
}

/**
 * Use the Zoom API to get a Zoom User
 * @param {string} uid - User ID to query on
 * @param {string} token Zoom App Access Token
 */
export function getZoomUser(uid, token) {
    return apiRequest('GET', `/users/${uid}`, token);
}

/**
 * Return the DeepLink for opening Zoom
 * @param {string} token - Zoom App Access Token
 * @return {Promise}
 */
export function getDeeplink(token) {
    return apiRequest('POST', '/zoomapp/deeplink', token, {
        action: JSON.stringify({
            url: '/',
            role_name: 'Owner',
            verified: 1,
            role_id: 0,
        }),
    }).then((data) => Promise.resolve(data.deeplink));
}

/**
 * Create a Zoom Meeting
 * @param {{
*   topic: string,
*   start_time: string,
*   duration?: number,
*   password?: string,
*   agenda?: string,
*   settings?: object
* }} options - Meeting configuration
* @param {string} token - Zoom Access Token
* @returns {Promise<object>} Zoom meeting object
*/
export async function createZoomMeeting(options, token) {
    if (!token || typeof token !== 'string') {
        throw createError(401, 'Missing or invalid Zoom access token');
    }

    // Get the user ID from Zoom
    const userInfo = await apiRequest('GET', '/users/me', token);
    const userId = userInfo.id;

    // Prepare custom headers
    const headers = {
        'Zoom-SDK-Origin': 'developer' // NEED TO TEST THIS, to see if it is posible to schedule a meeting
    };

   return apiRequest('POST', `/users/${userId}/meetings`, token, {
       type: 2, // Scheduled meeting
       topic: options.topic || 'Deposition Meeting',
       start_time: options.start_time,
       duration: options.duration || 60,
       timezone: 'UTC',
       password: options.password || '',
       agenda: options.agenda || '',
       settings: {
           host_video: true,
           participant_video: true,
           join_before_host: false,
           mute_upon_entry: false,
           waiting_room: true,
           auto_recording: 'cloud',
           alternative_hosts: '',
           ...options.settings // Allows to overwrite or add settings
       }
   },
   headers);
}

