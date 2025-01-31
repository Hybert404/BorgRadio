const WebSocket = require('ws');

const activeConnections = new Set();
const serverStatuses = require('./serverStatuses.js');

module.exports = (wss) => {
    wss.on('connection', (ws) => {
        console.log('\x1b[32m%s\x1b[0m', 'Client connected');
        activeConnections.add(ws);
    
        ws.send(JSON.stringify({ event: 'statusUpdate', message: serverStatuses })); // Send all statuses
    
        ws.on('message', (message) => {
            const messageString = Buffer.from(message).toString();  // Decode buffer to string
            console.log("\x1b[32m%s\x1b[0m", 'Received:', messageString);
            const data = JSON.parse(messageString);
    
            switch (data.type) {
                case 'statusUpdate':
                    Object.assign(serverStatuses, data.status); // Update statuses
                    broadcastMessage({ event: 'statusUpdate', message: serverStatuses });
                    break;
    
                default:
                    console.log('Unhandled data type:', data.type);
                    break;
            }
        });
    
        ws.on('close', () => {
            console.log('\x1b[35m%s\x1b[0m', 'Client disconnected');
            activeConnections.delete(ws);
        });
    });

    // Send a message to all WebSocket clients
    const broadcastMessage = (message) => {
        activeConnections.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
                console.log('\x1b[34m%s\x1b[0m', `Sent msg: ${JSON.stringify(message).slice(0,120)}...`);
            }
        });
    };

    // Notify all active WebSocket clients to fetch queue
    const sendFetchNotification = () => {
        broadcastMessage({ event: 'refresh', message: JSON.stringify('Refreshing...') });
    };

    // Export WebSocket functions
    return { broadcastMessage, sendFetchNotification };
};
