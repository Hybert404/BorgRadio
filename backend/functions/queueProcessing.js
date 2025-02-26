const { dbQueue } = require('./database.js');
const { sendFetchNotification } = require('./websocket.js');

// Fetch all pending items based on tags; returns an array of items
const getAllPendingItems = async (tags = []) => {
  let query = `SELECT * FROM queue WHERE IN ('processed', 'pending')`;
  const params = [];

  // Add tag filtering if tags are provided
  if (tags.length > 0) {
    const tagConditions = tags.map(() => `tags LIKE ?`).join(' OR ');
    query += ` AND (${tagConditions})`;
    params.push(...tags.map(tag => `%${tag}%`)); // Use LIKE for partial match
  }

  return new Promise((resolve, reject) => {
    dbQueue.all(query, params, (err, items) => {
      if (err) {
        console.error('[getAllPendingItems] Error fetching items:', err);
        reject(err);
      } else {
        resolve(items || []);
      }
    });
  });
};

// Fetch and shuffle all pending items based on tags; returns an array of items
const getShuffledQueue = async (tags = []) => {
  let allPendingItems = await getAllPendingItems(tags);

  if (allPendingItems.length === 0) {
    console.log('[getShuffledQueue] No pending items found for shuffle. Trying to reset finished items...');
    await resetFinishedToPending();
    allPendingItems = await getAllPendingItems(tags);
    if (allPendingItems.length === 0) {
      console.log('[getShuffledQueue] Still no pending items. Cant generate queue.');
    }
    return [];
  }

  let shuffledQueue = shuffleArray(allPendingItems); // Shuffle and store
  return (shuffledQueue || []);
};

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// Set finished items to pending
const resetFinishedToPending = async () => {
  return new Promise((resolve, reject) => {
    dbQueue.run(`UPDATE queue SET status = 'pending' WHERE status = 'finished'`, (err) => {
      if (err) {
        console.error('[resetFinishedToPending] Error updating status:', err);
        reject(err);
      } else {
        console.log('[resetFinishedToPending] Status updated to pending for all finished songs.');
        sendFetchNotification();
        resolve();
      }
    });
  });
};



module.exports = {
  getAllPendingItems,
  getShuffledQueue
};