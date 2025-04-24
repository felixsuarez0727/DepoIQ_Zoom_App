import fs from 'fs/promises';
const FILE_PATH = './access_tokens.json';

export async function loadTokens() {
  try {
    const data = await fs.readFile(FILE_PATH, 'utf-8');
    // This checks for content before parsing
    if (!data.trim()) return {};
    return JSON.parse(data);
  } catch (err) {
    // If the file does not exist, returns an empty object
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

export async function saveTokens(tokens) {
  await fs.writeFile(FILE_PATH, JSON.stringify(tokens, null, 2));
}

export async function getTokensForUser(userId) {
  const tokens = await loadTokens();
  return tokens[userId];
}

export async function saveTokensForUser(userId, tokenData) {
  const tokens = await loadTokens();
  tokens[userId] = tokenData;
  await saveTokens(tokens);
}
