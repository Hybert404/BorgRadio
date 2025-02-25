const ytdlp        = require('yt-dlp-exec');
const { dbQueue } = require('./database.js');
const { sendFetchNotification } = require('./websocket.js');

const getDuration = async (url) => {
  try {
    // Use yt-dlp to get the duration
    const result = await ytdlp(url, {
        dumpSingleJson: true, // Outputs metadata in JSON format
    });
    // Check if the URL has a "dur" parameter
    const urlObj = new URL(result.url || ''); // Ensure result.url is valid
    const durationParam = urlObj.searchParams.get('dur'); // Get "dur" from the URL

    if (!durationParam) {
      throw new Error('Duration parameter not found in the URL');
    }

    const durationInSeconds = parseInt(durationParam); // Convert to seconds

    // Respond with the duration
    //(new Date(durationInSeconds * 1000).toISOString().substring(11, 8)) // Format to hh:mm:ss
    return(durationInSeconds);
  } catch (error) {
      console.error('Error fetching audio length:', error);
      return(null);
  }
}


// Function to get the best audio stream URL using yt-dlp
const getAudioUrlAndTitle = async (url) => {
  try {
    // Execute yt-dlp and fetch the required outputs
    const output = await ytdlp(url, {
      f: 'bestaudio', // Fetch the best audio format
      g: true,        // Get the direct audio URL
      print: 'title'  // Print the video title
    });

    // Parse the output
    const lines = output.split('\n').filter(line => line.trim() !== '');
    const videoTitle = lines[0]; // First line is the title
    const audioUrl = lines[1];   // Second line is the audio URL

    return { title: videoTitle, audioUrl: audioUrl };
  } catch (error) {
    console.error(`yt-dlp error: ${error}`);
    throw new Error('Failed to fetch audio stream URL');
  }
};

// Update the status of an item in the queue
const updateItemStatus = async (id, status) => {
  return new Promise((resolve, reject) => {
    dbQueue.run(`UPDATE queue SET status = ? WHERE id = ?`, [status, id], (err) => {
      if (err) {
        console.error(`[updateItemStatus] Error updating status to ${status}:`, err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Process a song (title, duration, audio URL) and update the database
const processSong = async (item) => {
  try {
    // Mark the item as processing
    await updateItemStatus(item.id, 'processing');
    sendFetchNotification();

    // Fetch and process the audio URL and title
    const { title, audioUrl } = await getAudioUrlAndTitle(item.url);
    const duration = await getDuration(audioUrl);

    // Update the database with the processed item
    dbQueue.run(
      `UPDATE queue SET status = 'processed', audioUrl = ?, title = ?, duration = ? WHERE id = ?`,
      [audioUrl, title, duration, item.id],
      (err) => {
        if (err) {
          console.error('[processSong] Error updating processed item:', err);
        } else {
          // console.log(`[processSong] Successfully processed item: ${title}`);
          sendFetchNotification();
        }
      }
    );
  } catch (error) {
    console.error('[processSong] Error:', error.message);
  }
};

module.exports = {processSong};

//-----------------------------------------------------------------------------------




// Get new audioUrl for row with certain id
const reprocessRowById = async (id) => {
  try {
    // Mark it as processing
    db.run(`UPDATE queue SET status = 'processing' WHERE id = ?`, [id]);
    sendFetchNotification();

    // Get the URL to reprocess
    const itemToReprocess = await getById(id);
    const urlToReprocess = itemToReprocess.url;
    console.log(`[reprocessRowById] Reprocessing url: ${urlToReprocess}`);

    // Run yt-dlp to get the audio URL
    const { title, audioUrl } = await getAudioUrlAndTitle(urlToReprocess);

    // Update the database with the processed status and audio URL
    dbQueue.run(`UPDATE queue SET status = 'processed', audioUrl = ?, title = ?  WHERE id = ?`, [audioUrl, title, id]);
    sendFetchNotification();

    return true; // Resolves with true
  } catch (error) {
    console.error('Error processing row:', error);
    throw error; // Propagates the error
  }
};

// Get the row by id
const getById = (id) => {
  return new Promise((resolve, reject) => {
    dbQueue.get(`SELECT * FROM queue WHERE id = ? ORDER BY id LIMIT 1`, [id], (err, item) => {
      if (err) {
        console.error('[getById] Error accessing db: ', err);
        reject(err); // Reject the promise with the error
        return;
      }
      if (!item) {
        console.error(`[getById] No data with id =${id}: `, err);
        reject(null); // Resolve with null
        return;
      }
      console.log(`[getById] Found row with id=${id}`)
      resolve(item); // Resolve with item
    });
  });
};





  // Main processing function
const processNextFromQueue = async (tags = []) => {
  try {
    const randomizeQueue = serverStatuses.randomizeQueue;

    // Shuffle mode logic
    if (randomizeQueue) {
      // Initialize or reset the shuffled queue if it's empty
      if (!shuffledQueue || shuffledQueue.length === 0) {
        console.log('[processNextFromQueue] Shuffling the queue...');
        await resetFinishedToPending(); // Reset all finished items to pending
        const allPendingItems = await getAllPendingItems(tags);

        if (allPendingItems.length === 0) {
          console.log('[processNextFromQueue] No pending items found for shuffle.');
          return null;
        }

        shuffledQueue = shuffleArray(allPendingItems); // Shuffle and store
      }

      // Get the next song from the shuffled queue
      const item = shuffledQueue.shift(); // Remove and get the first song
      await playSong(item); // Process the song
      return true;
    }

    // Normal queue logic (no randomization)
    let item = await getNextItem(tags);

    if (!item) {
      console.log('[processNextFromQueue] No pending items found.');

      // Check if the queue has finished items and loop if necessary
      const lastQueueStatus = await getLastQueueStatus();
      if (lastQueueStatus && lastQueueStatus.status === 'finished' && serverStatuses.loopQueue) {
        console.log('[processNextFromQueue] Looping the queue.');
        await resetFinishedToPending();
        item = await getNextItem(tags); // Try fetching again after reset
        if (!item) {
          console.log('[processNextFromQueue] No items to process after loop reset.');
          return null;
        }
      } else {
        console.log('[processNextFromQueue] Queue is not finished or looping is disabled.');
        return null;
      }
    }

    // Process the item normally
    await playSong(item);
    return true;
  } catch (error) {
    console.error('[processNextFromQueue] Error:', error.message);
    return null;
  }
};

// Helper function to fetch the last queue status
const getLastQueueStatus = async () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT status FROM queue ORDER BY id DESC LIMIT 1`, [], (err, row) => {
      if (err) {
        console.error('[getLastQueueStatus] Error accessing queue:', err);
        reject(err);
      } else {
        resolve(row || null);
      }
    });
  });
};

// Helper function to reset finished items to pending
const resetFinishedToPending = async () => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE queue SET status = 'pending' WHERE status = 'finished'`, (err) => {
      if (err) {
        console.error('[resetFinishedToPending] Error updating status:', err);
        reject(err);
      } else {
        console.log('[resetFinishedToPending] Status updated to pending for all finished songs.');
        resolve();
      }
    });
  });
};

// Helper function to shuffle an array
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// Helper function to fetch the next item (non-shuffle mode)
const getNextItem = async (tags = []) => {
  let query = `SELECT * FROM queue WHERE status = 'pending'`;
  const params = [];
  // Add tag filtering if tags are provided
  if (tags.length > 0) {
    let tagsCondition = "AND (";
    tags.forEach(function(item, index) {
      tagsCondition += `tags LIKE '%${item}%'`;
      if (index != tags.length - 1){
        tagsCondition += " OR ";
      }
    });
    tagsCondition += ")";
    query += ` ${tagsCondition}`;
  }
  

  // Default ordering
  query += ` ORDER BY id LIMIT 1`;

  return new Promise((resolve, reject) => {
    db.get(query, params, (err, item) => {
      if (err) {
        console.error('[getNextItem] Error fetching item:', err);
        reject(err);
      } else {
        resolve(item || null);
      }
    });
  });
};









// ?????
// Fetching next processed entry and marking it as playing
// db.get(`SELECT * FROM queue WHERE status = 'processed' ORDER BY id LIMIT 1`, (err, item) => {
//   if (err) {
//     console.error('[currentlyPlaying] Error accessing queue:', err);
//     reject(err); // Reject the promise with the error
//     return;
//   }
//   // NOTHING PROCESSED = RETURN NULL
//   if (!item) {
//     console.log('[currentlyPlaying] No processed songs.');
//     resolve(null);
//     return;
//   }
//   db.run(`UPDATE queue SET status = 'playing' WHERE id = ?`, [item.id]);
//   play();
//   sendFetchNotification();
//   resolve(JSON.stringify(item));
// });