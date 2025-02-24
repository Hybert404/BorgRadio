const { getAllPendingItems, getShuffledQueue } = require('./queueProcessing.js');

let serverStatuses = {
    loopQueue: true,
    randomizeQueue: false,
    playState: false,
    filters: [],
  };

let currentQueue = [];

// Proxy to watch serverStatuses
const statusesProxy = new Proxy(serverStatuses, {
  set: function(target, property, value) {
      // Watch for randomizeQueue changes
      if (property === 'randomizeQueue') {
          console.log(`RandomizeQueue changed to: ${value}`);
          // Add your custom logic here when randomizeQueue changes
          if (value === true) {
              // Shuffle the queue
              currentQueue = getShuffledQueue(); //TODO TAGS as parameter
          }
      }
      
      target[property] = value;
      return true;
  }
});


module.exports = serverStatuses;