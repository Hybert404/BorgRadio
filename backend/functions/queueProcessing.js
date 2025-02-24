const { dbQueue } = require('./database.js');

// Fetch all pending items based on tags; returns an array of items
const getAllPendingItems = async (tags = []) => {
  let query = `SELECT * FROM queue WHERE status = 'pending'`;
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
  const allPendingItems = await getAllPendingItems(tags);

  if (allPendingItems.length === 0) {
    console.log('[getShuffledQueue] No pending items found for shuffle.');
    return null;
  }

  shuffledQueue = shuffleArray(allPendingItems); // Shuffle and store
  return shuffledQueue;
};

module.exports = {
  getAllPendingItems,
  getShuffledQueue,
};