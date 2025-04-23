import express from 'express';
import axios from 'axios';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import debug from 'debug';
import helmet from 'helmet';
import logger from 'morgan';
import { dirname } from 'path';
import { fileURLToPath, URL } from 'url';

import { start } from './server/server.js';
import indexRoutes from './server/routes/index.js';
import authRoutes from './server/routes/auth.js';
import recallRouter from './server/routes/recall.js';

import { appName, port, redirectUri } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* App Config */
const app = express();
const dbg = debug(`${appName}:app`);

const redirectHost = new URL(redirectUri).host;

// views and assets
const staticDir = `${__dirname}/dist`;
const viewDir = `${__dirname}/server/views`;

app.set('view engine', 'pug');
app.set('views', viewDir);
app.locals.basedir = staticDir;

// HTTP
app.set('port', port);
app.set('trust proxy', true);
// log Axios requests and responses
const logFunc = (r) => {
    if (process.env.NODE_ENV !== 'production') {
        let { method, status, url, baseURL, config } = r;

        const endp = url || config?.url;
        const base = baseURL || config?.baseURL;
        let str = new URL(endp, base).href;

        if (method) str = `${method.toUpperCase()} ${str}`;
        if (status) str = `${status} ${str}`;

        debug(`${appName}:axios`)(str);
    }

    return r;
};

axios.interceptors.request.use(logFunc);
axios.interceptors.response.use(logFunc);

/*  Middleware */
const headers = {
    strictTransportSecurity: {
        maxAge: 63072000, // 2 years in seconds
        includeSubDomains: true,
        preload: true
    },
    contentSecurityPolicy: {
        directives: {
            'default-src': ["'self'"],
            'script-src': [
                "'self'", 
                "'unsafe-inline'", // Required for some Zoom cases
                'https://appssdk.zoom.us', 
                'https://*.zoom.us'
            ],
            'style-src': [
                "'self'", 
                "'unsafe-inline'", // Required for inline styles
                'https://*.zoom.us'
            ],
            'img-src': [
                "'self'", 
                'data:', // For base64 images
                `https://${redirectHost}`,
                'https://*.zoom.us',
                'https://*.zoomgov.com'
            ],
            'connect-src': [
                "'self'", 
                `https://${redirectHost}`,
                'https://api.zoom.us',
                'https://zoom.us',
                'wss://*.zoom.us'
            ],
            'frame-src': [
                "'self'", 
                'https://*.zoom.us'
            ],
            'font-src': ["'self'", 'data:'],
            'media-src': ["'self'", 'https://*.zoom.us'],
            'object-src': ["'none'"],
            'base-uri': "'self'",
            'form-action': "'self'",
            'frame-ancestors': ["'self'", 'https://*.zoom.us']
        }
    },
    referrerPolicy: { policy: 'same-origin' },
    xContentTypeOptions: true,
    xFrameOptions: { action: 'sameorigin' },
    xXssProtection: true,
    crossOriginEmbedderPolicy: false, // Important for Zoom SDK compatibility
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' }
};

app.use(helmet(headers));

app.use(express.json());
app.use(compression());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(logger('dev', { stream: { write: (msg) => dbg(msg) } }));

// serve our app folder
app.use(express.static(staticDir));

/* Routing */
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/api/recall', recallRouter); // Recall.ai access_token_callback_url

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    const status = err.status || 500;
    const title = `Error ${err.status}`;

    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    if (res.locals.error) dbg(`${title} %s`, err.stack);

    // render the error page
    res.status(status);
    res.render('error');
});

// redirect users to the home page if they get a 404 route
app.get('*', (req, res) => res.redirect('/'));

// start serving
start(app, port).catch(async (e) => {
    console.error(e);
    process.exit(1);
});

export default app;
