// // helpers/create-depo-API.js
// import { totp } from 'otplib';
// import { createDepoAPIConfig } from '../../config.js';

// // Configura TOTP
// totp.options = { digits: 6, period: 30 };

// export async function createDeposition(caseId, userId, s3Key, deponentName, date) {
//     const token = totp.generate(createDepoAPIConfig.totpSecret);
//     console.log('🔐 Generated TOTP token:', token);

//     const transcriptFileName = s3Key.split('/').pop();

//     const payload = {
//         userId,
//         depos: [{
//             date,
//             deponentName,
//             transcriptFile: s3Key,
//             transcriptFileName,
//             videoFileNames: [],
//             videoFiles: []
//         }]
//     };

//     const url = `${createDepoAPIConfig.apiBaseURL}/cases/${caseId}/depos/bulk`;
//     console.log('📡 Calling API:', url);

//     try {
//         const response = await fetch(url, {
//             method: 'POST',
//             headers: {
//                 'x-totp-token': String(token),
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify(payload)
//         });

//         const data = await response.json();

//         if (!response.ok) {
//             console.error('❌ API Error:', JSON.stringify(data, null, 2));
//             throw new Error(data.message || 'Failed to create deposition');
//         }

//         console.log('✅ Deposition created successfully');
//         return data;
//     } catch (error) {
//         console.error('❌ Error in createDeposition:', error.message);
//         throw error;
//     }
// }

// helpers/create-depo-API.js
// helpers/create-depo-API.js
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { createDepoAPIConfig } from '../../config.js';

// Configuración de rutas
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function generatePythonTOTP() {
    try {
        const pythonScriptPath = path.join(__dirname, 'generate_totp.py');
        const command = `python "${pythonScriptPath}"`;
        const token = execSync(command).toString().trim();
        
        if (!/^\d{6}$/.test(token)) {
            throw new Error(`Formato TOTP inválido: ${token}`);
        }
        
        return token;
    } catch (error) {
        console.error('❌ Fallo al generar TOTP:', error.message);
        throw new Error('Error al generar token de autenticación');
    }
}

export async function createDeposition(caseId, userId, s3Key, deponentName, date) {
    const url = `${createDepoAPIConfig.apiBaseURL}/cases/${caseId}/depos/bulk`;
    const payload = {
        userId: String(userId),
        depos: [{
            date: date.split('T')[0],
            deponentName: String(deponentName),
            transcriptFile: String(s3Key),
            transcriptFileName: String(s3Key.split('/').pop()),
            videoFileNames: [],
            videoFiles: []
        }]
    };

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            const token = await generatePythonTOTP();
            // console.log(`🔐 Attempt ${attempts + 1}: Using TOTP`, token);
            console.log(`ℹ️ Creating deposition on the Web App`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-totp-token': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                console.log('✅ Deposition created successfully');
                return data;
            }

            console.error('❌ API Error:', {
                status: response.status,
                error: data.error
            });

            if (response.status !== 401) {
                throw new Error(data.error || 'API request failed');
            }
        } catch (error) {
            console.error(`❌ Attempt ${attempts + 1} failed:`, error.message);
            if (attempts === maxAttempts - 1) throw error;
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, 5000)); // Espera entre intentos
    }

    throw new Error('All attempts failed');
}