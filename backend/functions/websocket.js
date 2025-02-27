const WebSocket = require('ws');
const eventBus = require('./eventBus');
const EVENTS = require('../constants/events');

const activeConnections = new Set();

// Send a message to all WebSocket clients
const broadcastMessage = (message) => {
    activeConnections.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
            console.log('\x1b[34m%s\x1b[0m', `Sent msg: ${JSON.stringify(message).slice(0,120)}...`);
        }
    });
};

// WebSocket setup function
const setupWebSocket = (wss) => {
    // Listen for status updates
    eventBus.on(EVENTS.STATUS_UPDATE, (statuses) => {
        broadcastMessage({ event: EVENTS.STATUS_UPDATE, message: statuses });
    });

    wss.on('connection', (ws) => {
        console.log('\x1b[32m%s\x1b[0m', 'Client connected');
        activeConnections.add(ws);
        
        // Get initial status through a require here to avoid circular dependency
        const { getServerStatuses } = require('./serverStatuses');
        ws.send(JSON.stringify({
            event: EVENTS.STATUS_UPDATE,
            message: getServerStatuses()
        }));
    
        ws.on('message', (message) => {
            const messageString = Buffer.from(message).toString();
            console.log("\x1b[32m%s\x1b[0m", 'Received:', messageString);
            const data = JSON.parse(messageString);
    
            if (data.type === EVENTS.STATUS_UPDATE) {
                const { setServerStatus } = require('./serverStatuses');
                Object.entries(data.status).forEach(([property, value]) => {
                    setServerStatus(property, value);
                });
            }
        });

        ws.on('close', () => {
            console.log('\x1b[35m%s\x1b[0m', 'Client disconnected');
            activeConnections.delete(ws);
        });
    });
};


module.exports = {
    setupWebSocket,
    broadcastMessage
};
