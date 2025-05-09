export function formatLegalTranscript(rawTranscript, linesPerPage = 25) {
  let lineNumber = 1;
  let pageNumber = 1;
  const formattedPages = [];
  let currentPage = [];
  
  // First, all utterances are processed in chronological order.
  const allUtterances = [];
  
  rawTranscript.forEach(participant => {
    participant.words.forEach(word => {
      allUtterances.push({
        speaker: participant.participant.name,
        text: word.text,
        time: formatTime(word.start_timestamp.relative),
        isHost: participant.participant.is_host
      });
    });
  });
  
  // Order by time
  allUtterances.sort((a, b) => a.time.localeCompare(b.time));
  
  // Format each line
  allUtterances.forEach(utterance => {
    const speakerPrefix = utterance.isHost ? 'Q' : 'A'; // Q for host (questions), A for others -----> CHECK THIS AGAIN LATER
    const formattedLine = `${utterance.time} ${lineNumber.toString().padStart(2, ' ')} ${speakerPrefix}:   ${utterance.text}`;
    
    currentPage.push(formattedLine);
    lineNumber++;
    
    // When a page is filled, it is added to the result
    if (currentPage.length >= linesPerPage) {
      formattedPages.push({
        page: pageNumber,
        content: [...currentPage]
      });
      currentPage = [];
      pageNumber++;
    }
  });
  
  // Add the last page if it has content
  if (currentPage.length > 0) {
    formattedPages.push({
      page: pageNumber,
      content: [...currentPage]
    });
  }
  
  return formattedPages;
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(1, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function printFormattedTranscript(formattedPages) {
  let fullTranscript = '';
  
  formattedPages.forEach(page => {
    fullTranscript += `    Page ${page.page}\n`;
    page.content.forEach(line => {
      fullTranscript += `${line}\n`;
    });
    fullTranscript += '\n';
  });
  
  return fullTranscript;
}