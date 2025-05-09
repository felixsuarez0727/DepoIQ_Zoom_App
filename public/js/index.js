// import zoomSdk from '@zoom/appssdk';

// (async () => {
//     try {
//         const configResponse = await zoomSdk.config({
//             capabilities: ['startRTMS', 'stopRTMS'],
//         });

//         console.debug('Zoom JS SDK Configuration', configResponse);

//         const { runningContext } = configResponse;
//         if (runningContext === 'inMeeting') {
//             await zoomSdk.callZoomApi('startRTMS');
//         }
//     } catch (e) {
//         console.error(e);
//     }
// })();



import zoomSdk from '@zoom/appssdk';

// Application status
let appState = {
    depositionScheduled: false,
    depositionInProgress: false,
    meetingId: null,
    participantId: null
  };
  
  // Main initialization function
  (async () => {
    try {
      // 1. First configure the SDK
      const configResponse = await zoomSdk.config({
        capabilities: [
          'onMeeting',
          'getMeetingContext',
          'authorize',
          'promptAuthorize',
          'startRTMS',
          'stopRTMS'
        ],
        version: '1.0.0', // Latest version
        debug: true,
        development: true
      });
  
      console.debug('Zoom JS SDK Configuration', configResponse);
  
      // 2. Configure UI listeners
      setupUIListeners();
  
      // 3. Check current context
      const { runningContext } = configResponse;
      if (runningContext === 'inMeeting') {
        await startMeetingFlow();
      }
  
    } catch (e) {
      console.error('Error initializing DepoIQ:', e);
      displayMessage('Error initializing application', true);
    }
  })();


// Function to configure interface listeners
function setupUIListeners() {
  const scheduleForm = document.getElementById('scheduleForm');
  if (scheduleForm) {
    scheduleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await scheduleDeposition();
    });
  }

  document.getElementById('highlightBtn')?.addEventListener('click', markImportantMoment);
  document.getElementById('noteBtn')?.addEventListener('click', addNote);
}

// Function that represents the flow when we are in a meeting
async function startMeetingFlow() {
  try {
    appState.depositionInProgress = true;
    updateUIForMeeting();
    
    // Start RTMS (Real-Time Meeting Service)
    await zoomSdk.callZoomApi('startRTMS');

    // Get meeting context
    const meetingContext = await zoomSdk.getMeetingContext();
    appState.meetingId = meetingContext.meetingId;
    appState.participantId = meetingContext.participantId;

    // Initialize transcription services
    initializeTranscriptionService();

    // Show welcome message
    displayInsight('Deposition analysis has started. Key insights will appear here.');

  } catch (error) {
    console.error('Error starting meeting flow:', error);
    displayMessage('Failed to connect to deposition meeting', true);
  }
}

// Function to Update the UI when the meeting starts
function updateUIForMeeting() {
  document.getElementById('depoStatus').textContent = 'Deposition in Progress';
  document.getElementById('scheduleSection').classList.add('hidden');
  document.getElementById('liveSection').classList.remove('hidden');

  const pageTitle = document.querySelector('h1');
  if (pageTitle) pageTitle.textContent = 'DepoIQ - Active Meeting';
}

// Function to verify authentication
async function checkAuth() {
    try {
        // First check if we are in the Zoom client
        const context = await zoomSdk.getRunningContext();
        if (context === 'inClient') {
            return true; // Asume autenticado en cliente Zoom
        }

        const response = await fetch('/auth/status', {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!response.ok) throw new Error('Auth check failed');
        
        const data = await response.json();
        return data.isAuthenticated;
    } catch (error) {
        console.warn('Auth check warning:', error);
        return false;
    }
}

// Function to schedule a deposition
async function scheduleDeposition() {
    const dateTime = document.getElementById('depoDateTime').value;
    const caseNumber = document.getElementById('caseNumber').value;

    // Verify authentication first
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        displayMessage('Please install and authorize the app first', true);
        window.location.href = '/install'; // Redirect to app installation
        return;
    }

    try {
        // Show charging status
        document.getElementById('scheduleBtn').disabled = true;
        document.getElementById('scheduleBtn').textContent = 'Scheduling...';

        const response = await fetch('/api/scheduleDeposition', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                dateTime,
                caseNumber,
                duration: 120 // minutes
            }),
            credentials: 'include' // To send session cookies
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Failed to schedule');

        // Update UI successfully
        appState.depositionScheduled = true;
        appState.meetingId = data.meetingId;
        
        document.getElementById('scheduleSection').classList.add('hidden');
        document.getElementById('depoStatus').textContent = `Scheduled: ${new Date(data.scheduledTime).toLocaleString()}`;
        
        // Show meeting details
        displayInsight(`Successfully scheduled deposition. Meeting ID: ${data.meetingId}`);
        displayInsight(`Join URL: ${data.joinUrl}`);

    } catch (error) {
        console.error('Scheduling error:', error);
        displayInsight(`Error: ${error.message}`, true);
    } finally {
        document.getElementById('scheduleBtn').disabled = false;
        document.getElementById('scheduleBtn').textContent = 'Schedule';
    }
}

// Auxiliary functions for transcription

function initializeTranscriptionService() {
  // Simulation - must connect to Recall.ai here
  console.log('Initializing transcription service...');
  
  // Simulate receiving transcription in real time
  simulateRealTimeTranscript();
}

function simulateRealTimeTranscript() {
  // Simulation example
  const sampleTranscripts = [
    "The witness is being sworn in.",
    "Question: Could you state your full name for the record?",
    "Answer: My name is John Michael Doe.",
    "Question: What is your current occupation?",
    "Answer: I work as a financial analyst at Smith & Co."
  ];

  let index = 0;
  const interval = setInterval(() => {
    if (index < sampleTranscripts.length) {
      updateTranscript(sampleTranscripts[index]);
      index++;
    } else {
      clearInterval(interval);
    }
  }, 3000);
}

function updateTranscript(text) {
  const transcriptDiv = document.getElementById('liveTranscript');
  if (transcriptDiv) {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    transcriptDiv.appendChild(paragraph);
    transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
  }
}

// Functions for user interaction. Optional functions, just thinking on some improvements or new functionalities

function markImportantMoment() {
  const timestamp = new Date().toLocaleTimeString();
  displayInsight(`Important moment marked at ${timestamp}`);
  
  // In production, this moment would be recorded in the backend
  console.log(`Important moment marked at ${timestamp}`);
}

function addNote() {
  const note = prompt('Enter your note:');
  if (note) {
    displayInsight(`Note: ${note}`);
    // In production, the note would be sent to the backend
    console.log(`Note added: ${note}`);
  }
}

// Display functions
function displayInsight(message, isError = false) {
  const insightsDiv = document.getElementById('liveInsights');
  if (insightsDiv) {
    const insightElement = document.createElement('div');
    insightElement.className = `insight-item ${isError ? 'error' : ''}`;
    insightElement.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    insightsDiv.appendChild(insightElement);
    insightsDiv.scrollTop = insightsDiv.scrollHeight;
  }
}

function displayMessage(message, isError = false) {
  alert(`${isError ? 'Error' : 'Message'}: ${message}`);
}