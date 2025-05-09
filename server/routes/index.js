import express from 'express';
import { handleError, sanitize } from '../helpers/routing.js';
import { contextHeader, getAppContext } from '../helpers/cipher.js';
import { getInstallURL, createZoomMeeting } from '../helpers/zoom-api.js';
import session from '../session.js';

const router = express.Router();

/*
 * Home Page - Zoom App Launch handler
 * this route is used when a user navigates to the deep link
 */
function isContextExpired(context) {
    const currentTime = Date.now();
    return context.exp && context.exp < currentTime;
}

router.get('/', async (req, res, next) => {
    try {
        sanitize(req);

        const header = req.header(contextHeader);
        const context = header && getAppContext(header);

        if (!context) {
            return res.render('index', {
                isZoom: false,
                title: 'DepoIQ - Legal Deposition Analysis',
            });
        }

        // Check if the context is valid and not expired
        if (isContextExpired(context)) {
            return res.status(401).json({ error: 'Invalid or expired context' });
        }

        return res.render('index', {
            isZoom: true,
            title: 'DepoIQ - Schedule a Deposition',
        });
    } catch (e) {
        next(handleError(e));
    }
});

/*
 * Install Route - Install the Zoom App from the Zoom Marketplace
 * this route is used when a user installs the app from the Zoom Client
 */
router.get('/install', session, (req, res) => {
    const { url, state, verifier } = getInstallURL();
    req.session.state = state;
    req.session.verifier = verifier;

    // DEBUG
    // console.log('New session generated:', { state, verifier });

    res.redirect(url.href);
});

/*
 * Route to schedule depositions
 */
router.post('/api/scheduleDeposition', session, async (req, res, next) => {
    try {
        const { dateTime, caseNumber, duration = 60 } = req.body;
        
        // Basic validation
        if (!dateTime || !caseNumber) {
            return res.status(400).json({ error: 'Date/time and case number are required' });
        }

        // Verify authentication
        if (!req.session.accessToken) {
            return res.status(401).json({ error: 'Not authenticated with Zoom' });
        }

        // Create the meeting in Zoom
        const meeting = await createZoomMeeting({
            topic: `Deposition - Case ${caseNumber}`,
            start_time: new Date(dateTime).toISOString(),
            duration: parseInt(duration),
            settings: {
                waiting_room: true,
                auto_recording: 'cloud'
            }
        }, req.session.accessToken);

        // Here you should save the meeting to your database
        // Example: await saveDepositionToDatabase(meeting, req.user.id);

        res.json({
            success: true,
            meetingId: meeting.id,
            joinUrl: meeting.join_url,
            startUrl: meeting.start_url,
            scheduledTime: meeting.start_time,
            password: meeting.password // Optional: To display the password
        });

    } catch (error) {
        console.error('Deposition scheduling error:', error);
        next(handleError(error));
    }
});

/*
 * Route to verify authentication status (it uses the browser session because Oauth was completed from there)
 */
router.get('/auth/status', session, (req, res) => {
    const zoomTokens = req.session.zoomTokens;

    const isAuthenticated = !!zoomTokens?.accessToken && Date.now() < zoomTokens.expiresAt;

    res.json({
        isAuthenticated,
        userId: zoomTokens?.userId || null,
        expiresIn: zoomTokens?.expiresAt
            ? Math.max(0, (zoomTokens.expiresAt - Date.now()) / 1000)
            : 0
    });
});

export default router;
