import express from 'express';
// import fetch from 'node-fetch';
import { recallConfig } from '../../config.js';
import { saveBotForMeeting, getLatestBotForMeeting } from '../helpers/botId-store.js';
import { saveTranscript, downloadAndSaveTranscripts } from '../helpers/transcript-store.js';
import { formatLegalTranscript, printFormattedTranscript } from '../helpers/transcript-formatter.js';
import { uploadTranscriptViaPresignedUrl } from '../helpers/upload-transcript.js';
import { createDeposition } from '../helpers/create-depo-API.js';

const router = express.Router();

// Configuration debug
console.log("Recall Configuration in Webhook:");
console.log("API Key (first 5 chars):", recallConfig.apiKey?.substring(0, 5) + '...');

// This route will receive Zoom notifications
router.post('/', express.json(), async (req, res) => {
    try {
      const event = req.body.event;
      const payload = req.body.payload;
      // console.log('📦 Full webhook payload:', JSON.stringify(req.body, null, 2));

      console.log('🔔 Zoom Webhook Event Received:');
      console.log('Event Type:', event);

      // Zoom expects a quick 200 OK response
      res.status(200).send('Received');

      // Process the event after responding to Zoom
      if (event === 'meeting.created') {
          const meeting = payload.object;            
          console.log('📅 New meeting created:');
          console.log('ID:', meeting.id);
          console.log('Topic:', meeting.topic);
          // console.log('Start Time:', meeting.start_time);
          // console.log('Host Email:', meeting.host_email);

          // Create bot in Recall.ai and store the bot ID
          const botData = await handleMeetingCreated(payload.object);
          await saveBotForMeeting(meeting.id, botData.id);
          console.log('🔑 Bot ID stored for meeting:', meeting.id, '->', botData.id);
      }

      if (event === 'meeting.started') {
          const meeting = payload.object;
          console.log('🚀 Meeting started:');
          console.log('ID:', meeting.id);
          console.log('Topic:', meeting.topic);
          console.log('Start Time:', meeting.start_time);
          // console.log('Host Email:', meeting.host_email);
      }

      if (event === 'meeting.ended') {
        const meeting = payload.object;
        console.log('🛑 Meeting ended:');
        console.log('ID:', meeting.id);
        
        const botId = await getLatestBotForMeeting(meeting.id);
        
        if (botId) {
            console.log('🔍 Retrieving bot data for bot ID:', botId);
            const botData = await retrieveBot(botId);
            // console.log('📊 Final bot data:', JSON.stringify(botData, null, 2));
            
            // Process the transcript if available
            if (botData.recordings?.length > 0 && 
              botData.recordings[0].media_shortcuts?.transcript?.data?.download_url) {
              
              const transcriptUrl = botData.recordings[0].media_shortcuts.transcript.data.download_url;
              
              try {
                  // Download and save the original transcript
                  const { rawData, jsonPath } = await downloadAndSaveTranscripts(
                      meeting.id,
                      transcriptUrl,
                      botData.join_at
                  );
                  // console.log('✅ Raw transcript saved to:', jsonPath);
                  
                  // Format to legal transcript
                  const formattedPages = formatLegalTranscript(rawData);
                  const legalTranscript = printFormattedTranscript(formattedPages);
                  
                  // Save the formatted version
                  const formattedPath = await saveTranscript(
                      meeting.id,
                      botData.join_at,
                      legalTranscript,
                      true // We indicate that it is the formatted version
                  );
                  
                  console.log('✅ Formatted transcript saved to:', formattedPath);

                  // Optional: Show a preview
                  // console.log('📄 Transcript preview (first 5 lines):');
                  // if (formattedPages.length > 0) {
                  //     formattedPages[0].content.slice(0, 5).forEach(line => {
                  //         console.log(line);
                  //     });
                  //     console.log('...');
                  // }

                  // Upload the formatted transcript to S3 Bucket
                  try {
                    const s3Key = await uploadTranscriptViaPresignedUrl(formattedPath);
                    // console.log('📤 Formatted transcript uploaded to S3 with key:', s3Key);

                    // Extrae y formatea la fecha del meeting (ej: convierte "2025-05-08T13:30:40Z" → "2025-05-08")
                    const meetingDate = meeting.start_time.split('T')[0];

                    // Llama a la API para crear la deposición
                    await createDeposition(
                      '681a0f8465d5555471f188ea', // caseId (deberías ponerlo en config.js)
                      '6705634fd35c2de6bb3d47c7', // userId (deberías ponerlo en config.js)
                      s3Key,
                      `Deposition from meeting ${meeting.id}`, // deponentName
                      meetingDate  // fecha actual en YYYY-MM-DD
                    );
                  } catch (err) {
                    console.error('❌ Failed to create deposition:', err.message);
                  }                
                    
                  
                  
              } catch (error) {
                  console.error('⚠️ Failed to process transcript:', error.message);
              }
          } else {
              console.log('ℹ️ No transcript available for this meeting');
          }


        } else {
            console.log('⚠️ No bot found for this meeting');
        }
      }

    } catch (error) {
        console.error('Error in webhook:', error);
    }
});

async function handleMeetingCreated(meeting) {
  console.log('📅 New meeting created:', JSON.stringify(meeting, null, 2));
  
  if (!meeting?.join_url) {
      throw new Error('Meeting does not have join_url');
  }

  const botData = await createRecallBot({
    meetingUrl: meeting.join_url,
    botName: `${meeting.topic || 'Zoom Meeting'} bot`.substring(0, 100)
  });

  return botData;
}

async function createRecallBot({ meetingUrl, botName }) {
  try {
      console.log('🤖 Trying to create bot in Recall.ai...');
      // console.log('Recall configuration:', {
      //   apiKey: recallConfig.apiKey?.substring(0, 5) + '...',
      //   meetingUrl,
      //   botName
      // });

      const response = await fetch('https://us-east-1.recall.ai/api/v1/bot/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${recallConfig.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          meeting_url: meetingUrl,
          bot_name: botName,
          // transcription_options: {provider: 'meeting_captions'}
          recording_config: {transcript: {provider: {meeting_captions: {}}}}
        })
      });

      const data = await response.json();

      if (!response.ok) {
          console.error('❌ Recall.ai response:', JSON.stringify(data, null, 2));
          throw new Error(`Error creating bot: ${data.detail || data.message}`);
      }

      console.log('✅ Bot created successfully');
      // console.log('✅ Bot created successfully:', JSON.stringify(data, null, 2));
      return data;

  } catch (error) {
      console.error('❌ Error in createRecallBot:', error.message);
      throw error;
  }
}

// Function to retrieve data from the bot
async function retrieveBot(botId) {
  try {
      console.log('🔍 Retrieving bot data for bot ID:', botId);
      
      const response = await fetch(`https://us-east-1.recall.ai/api/v1/bot/${botId}/`, {
          method: 'GET',
          headers: {
              'Authorization': `Token ${recallConfig.apiKey}`,
              'Accept': 'application/json'
          }
      });

      const data = await response.json();

      if (!response.ok) {
          console.error('❌ Error retrieving bot:', JSON.stringify(data, null, 2));
          throw new Error(`Error retrieving bot: ${data.detail || data.message}`);
      }

      return data;
  } catch (error) {
      console.error('❌ Error in retrieveBot:', error.message);
      throw error;
  }
}

export default router;