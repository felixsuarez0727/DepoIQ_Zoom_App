// import cookieSession from 'cookie-session';
// import { zoomApp } from '../config.js';

// export default cookieSession({
//     name: 'session',
//     httpOnly: true,
//     keys: [zoomApp.sessionSecret],
//     maxAge: 24 * 60 * 60 * 1000,
//     secure: process.env.NODE_ENV === 'production',
// });

import cookieSession from 'cookie-session';
import { zoomApp } from '../config.js';

export default cookieSession({
    name: 'zoomapp.session',
    keys: [zoomApp.sessionSecret],
    secret: zoomApp.sessionSecret,
    httpOnly: true,
    secure: true, // Required with Ngrok HTTPS 
    sameSite: 'none', // Essential for Zoom redirects 
    maxAge: 15 * 60 * 1000, // 15 minutes 
    overwrite: false, // Prevents overwriting 
    signed: true,
    // domain: '.ngrok-free.app'
});