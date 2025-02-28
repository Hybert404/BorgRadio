const { getShuffledQueue, getAllPendingItems } = require('./queueProcessing.js');
const eventBus = require('./eventBus');

let serverStatuses = {
    // loopQueue: true,
    randomizeQueue: false,
    playState: false,
    filters: [],
};

let currentQueue = [];

const getServerStatuses = () => ({...serverStatuses});

const setServerStatus = async (property, value) => {
    if (property in serverStatuses) {
        serverStatuses[property] = value;
        eventBus.emit('statusUpdate', serverStatuses);
        switch (property) {
            case 'randomizeQueue':
                console.log(`[statusesProxy] RandomizeQueue changed to: ${value}`);
                await generateQueue();
                break;
            case 'filters':
                console.log(`[statusesProxy] Filters changed to: ${value}`);
                await generateQueue();
                break;
            default:
                console.log(`[statusesProxy] ${property} changed to: ${value}`);
                break;
        }
        return true;
    }
    console.error(`[setServerStatus] Invalid property: ${property}`);
    return false;
};

// Add these getter/setter methods
const getCurrentQueue = () => currentQueue;
const shiftQueue = () => {
    if (currentQueue.length === 0) {
        console.log('[/serverStatuses.js/shiftQueue] Queue is empty');
        return null;
    }
    const item = currentQueue.shift();
    console.log(`Shifted item: ${item.id}`);
    return item;
};
const setCurrentQueue = (newQueue) => {
    currentQueue = newQueue;
};

// Proxy to watch serverStatuses
const statusesProxy = new Proxy(serverStatuses, {
    set: async function(target, property, value) {
        // Watch for randomizeQueue changes
        switch (property) {
            case 'randomizeQueue':
                console.log(`[statusesProxy] RandomizeQueue changed to: ${value}`);
                await generateQueue();
                break;
            case 'filters':
                console.log(`[statusesProxy] Filters changed to: ${value}`);
                await generateQueue();
                break;
            default:
                console.log(`[statusesProxy] ${property} changed to: ${value}`);
                break;
        }
        target[property] = value;
        return true;
    }
});

const generateQueue = async () => {
    if (serverStatuses.randomizeQueue === true) {
        // Filter and shuffle the queue
        console.log('[generateQueue] Shuffling queue...');
        currentQueue = await getShuffledQueue(serverStatuses.filters);
        console.log('Queue ready! Lenght:', currentQueue.length);
    }
    else if (serverStatuses.randomizeQueue === false) {
        // Filter the queue
        console.log('[generateQueue] Filtering queue...');
        currentQueue = await getAllPendingItems(serverStatuses.filters);
        console.log('Queue ready! Lenght:', currentQueue.length);
    }
    return (currentQueue || []);
}

module.exports = {
    serverStatuses: statusesProxy,
    getServerStatuses,
    setServerStatus,
    getCurrentQueue,
    shiftQueue,
    setCurrentQueue,
    generateQueue
};