// import fs from 'fs/promises';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import { recallConfig } from '../../config.js';

// const __dirname = path.dirname(fileURLToPath(import.meta.url));
// const BASE_DIR = path.join(__dirname, '../../meeting_transcripts');

// async function ensureDirectoryExists(dirPath) {
//   try {
//     await fs.access(dirPath);
//   } catch {
//     await fs.mkdir(dirPath, { recursive: true });
//   }
// }

// export async function saveTranscript(meetingId, joinAt, transcriptData) {
//   try {
//     // Formateamos la fecha para usar en el nombre del archivo
//     const dateStr = new Date(joinAt).toISOString()
//       .replace(/[:.]/g, '-')
//       .replace('T', '_');
    
//     const meetingDir = path.join(BASE_DIR, meetingId);
//     await ensureDirectoryExists(meetingDir);
    
//     const fileName = `${dateStr}.json`;
//     const filePath = path.join(meetingDir, fileName);
    
//     await fs.writeFile(filePath, JSON.stringify(transcriptData, null, 2));
    
//     return filePath;
//   } catch (error) {
//     console.error('Error saving transcript:', error);
//     throw error;
//   }
// }

// export async function downloadAndSaveTranscript(meetingId, transcriptUrl) {
//   try {
//     console.log('📥 Downloading transcript from Recall.ai...');
    
//     const response = await fetch(transcriptUrl, {
//       method: 'GET',
//       headers: {
//         'Authorization': `Token ${recallConfig.apiKey}`,
//         'Accept': 'application/json'
//       }
//     });

//     if (!response.ok) {
//       throw new Error(`Failed to download transcript: ${response.status}`);
//     }

//     const transcriptData = await response.json();
//     return transcriptData;
//   } catch (error) {
//     console.error('❌ Error downloading transcript:', error.message);
//     throw error;
//   }
// }



import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { recallConfig } from '../../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.join(__dirname, '../../meeting_transcripts');

async function ensureDirectoryExists(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

export async function saveTranscript(meetingId, joinAt, data, formatted = false) {
  try {
    const dateStr = new Date(joinAt).toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_');
    
    const meetingDir = path.join(BASE_DIR, meetingId);
    await ensureDirectoryExists(meetingDir);
    
    const fileName = formatted 
      ? `${dateStr}_formatted.txt` 
      : `${dateStr}.json`;
    
    const filePath = path.join(meetingDir, fileName);
    
    const content = formatted 
      ? data // Ya es texto formateado
      : JSON.stringify(data, null, 2); // Convertimos a JSON bonito
    
    await fs.writeFile(filePath, content);
    
    return filePath;
  } catch (error) {
    console.error('Error saving transcript:', error);
    throw error;
  }
}

export async function downloadAndSaveTranscripts(meetingId, transcriptUrl, joinAt) {
  try {
    console.log('📥 Downloading transcript from Recall.ai...');
    
    const response = await fetch(transcriptUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${recallConfig.apiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download transcript: ${response.status}`);
    }

    const transcriptData = await response.json();
    
    // Guardamos la versión original (JSON)
    const jsonPath = await saveTranscript(meetingId, joinAt, transcriptData);
    
    return {
      rawData: transcriptData,
      jsonPath
    };
  } catch (error) {
    console.error('❌ Error downloading transcript:', error.message);
    throw error;
  }
}