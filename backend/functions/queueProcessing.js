const { dbQueue } = require('./database.js');
const eventBus = require('./eventBus');
const EVENTS = require('../constants/events.js');

let serverStatuses = {
  loopQueue: true  // Default value
};

// Listen for status updates
eventBus.on(EVENTS.STATUS_UPDATE, (statuses) => {
  serverStatuses = statuses;
});

const fetchQueueItems = async (query, params) => {
  return new Promise((resolve, reject) => {
    dbQueue.all(query, params, (err, items) => {
      if (err) {
        console.error('[fetchQueueItems] Error fetching items:', err);
        reject(err);
      } else {
        resolve(items || []);
      }
    });
  });
};

const getAllPendingItems = async (tags = []) => {
  let query = `SELECT * FROM queue WHERE status IN ('processed', 'pending')`;
  const params = [];

  // Add tag filtering if tags are provided
  if (tags.length > 0) {
    const tagConditions = tags.map(() => `tags LIKE ?`).join(' OR ');
    query += ` AND (${tagConditions})`;
    params.push(...tags.map(tag => `%${tag}%`));
  }

  let items = await fetchQueueItems(query, params);
  
  // If no items found and loopQueue is enabled, reset finished items and try again
  if (items.length === 0 && serverStatuses.loopQueue) {
    console.log('[getAllPendingItems] No pending items found. Resetting finished items...');
    await resetFinishedToPending();
    items = await fetchQueueItems(query, params);
  }

  return items;
};

// Fetch and shuffle all pending items based on tags; returns an array of items
const getShuffledQueue = async (tags = []) => {
  const allPendingItems = await getAllPendingItems(tags);
  
  if (allPendingItems.length === 0) {
    console.log('[getShuffledQueue] No pending items available for queue.');
    return [];
  }

  console.log('[getShuffledQueue] Found', allPendingItems.length, 'pending items. Shuffling...');
  return shuffleArray(allPendingItems);
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
        eventBus.emit(EVENTS.FETCH);
        resolve();
      }
    });
  });
};



module.exports = {
  getAllPendingItems,
  getShuffledQueue
};