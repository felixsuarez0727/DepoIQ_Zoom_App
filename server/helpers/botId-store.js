import fs from 'fs/promises';

const FILE_PATH = './meeting_bots.json';

export async function loadBots() {
  try {
    const data = await fs.readFile(FILE_PATH, 'utf-8');
    if (!data.trim()) return {};
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

export async function saveBots(bots) {
  await fs.writeFile(FILE_PATH, JSON.stringify(bots, null, 2));
}

export async function getBotsForMeeting(meetingId) {
  const bots = await loadBots();
  return bots[meetingId] || {};
}

export async function saveBotForMeeting(meetingId, botId) {
  const bots = await loadBots();
  
  if (!bots[meetingId]) {
    bots[meetingId] = {};
  }
  
  // Generate a unique key for each bot (botId_1, botId_2, etc.)
  const botCount = Object.keys(bots[meetingId]).length + 1;
  const botKey = `botId_${botCount}`;
  
  bots[meetingId][botKey] = botId;
  await saveBots(bots);
  
  return botId;
}

export async function getLatestBotForMeeting(meetingId) {
  const bots = await getBotsForMeeting(meetingId);
  const botKeys = Object.keys(bots);
  
  if (botKeys.length === 0) return null;
  
  // Sort keys to get the latest bot
  const sortedKeys = botKeys.sort((a, b) => {
    const numA = parseInt(a.split('_')[1]);
    const numB = parseInt(b.split('_')[1]);
    return numB - numA;
  });
  
  return bots[sortedKeys[0]];
}