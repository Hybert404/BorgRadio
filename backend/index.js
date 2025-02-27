const cors          = require('cors');
const express       = require('express');
const http          = require('http');
const WebSocket     = require('ws');
const router        = express.Router();

const PORT          = process.env.PORT || 5000
const app           = express();
const server        = http.createServer(app);
const wss           = new WebSocket.Server({ noServer: true });
const bodyParser    = require('body-parser');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Load route files
app.use(require('./routes/userMgmt.js'));

// External functions

const authenticateToken = require('./middleware/authenticateToken.js'); // Middleware
const { initializeDatabase, changeStatuses, dbQueue, dbTagColors } = require('./functions/database.js');
const { processTags } = require('./functions/processTags.js');
const { serverStatuses, shiftQueue, getCurrentQueue, generateQueue, setServerStatus } = require('./functions/serverStatuses.js');
const { processSong } = require('./functions/audioProcessing.js');
const { setupWebSocket, broadcastMessage } = require('./functions/websocket.js');
const eventBus = require('./functions/eventBus');

const sendFetchNotification = () => {
  eventBus.emit('fetch');
};


// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
  });
});

setupWebSocket(wss);
initializeDatabase();

// Change all statuses to 'pending' on server start
changeStatuses('playing', 'pending');
changeStatuses('paused', 'pending');

class currentAudio {
  constructor({url, index = 0, duration = null}){
    this.url = url;
    this.index = index;
    this.duration = duration;
    this.timer = null; // To store the interval ID
  }

  startIndexIncrement() {
    if (serverStatuses.playState === "play" && !this.timer) {
      this.timer = setInterval(() => {
        this.index += 1;
        console.log(`Index incremented to: ${this.index}`);

        // If duration is set and index reaches duration, reset the timer
        if (this.duration != null && this.index >= this.duration) {
          this.resetIndexIncrement();
          next();
        }
      }, 1000);
    }
  }

  stopIndexIncrement() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("Index increment paused.");
    }
  }

  resetIndexIncrement() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.index = 0;
      console.log("Index increment stopped.");
    }
  }
}
var _currentAudio = new currentAudio({url: null})


// ---------------------------ENDPOINTS----------------------------------

// ------QUEUE-------

// Get the Current Queue
app.get('/queue', (req, res) => {
  dbQueue.all(`SELECT * FROM queue ORDER BY id`, (err, rows) => {
      if (err) {
      return res.status(500).json({ error: 'Failed to retrieve queue' });
      }

      const queue = rows.map((row) => ({
        ...row,
        tags: JSON.parse(row.tags || '[]'),
      }));

      res.json(queue);
  });
});

// Add URL to Queue and process title
app.post('/queue/add', authenticateToken, (req, res) => {
  const { url, tags } = req.body;
  if (!url || url.startsWith('https://') == false) {
    return res.status(400).json({ error: 'YouTube URL is required' });
  }

  let tagsJson = processTags(req, tags); //Add tags to db and assign random colors to them

  dbQueue.run(`INSERT INTO queue (url, status, tags) VALUES (?, 'pending', ?)`, [url, tagsJson], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to add to queue' });
    }
    sendFetchNotification();
    res.json({ message: 'URL added to queue', id: this.lastID });
    
    // Process the song (get title, duration, audio URL, etc.)
    let item = {id: this.lastID, url: url};
    processSong(item);
    generateQueue();
  });
});



// Skip endpoint
app.post('/queue/skip', async (req, res) => {
  // skipTrack(res); // Skip the current track
  //TODO
  res.status(200).send('Track skipped');
});


// Clear Queue
app.post('/queue/clear', authenticateToken, (req, res) => {
  dbQueue.run(`DELETE FROM queue`, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to clear the queue' });
    setServerStatus('playState', "pause")
    stopPlaying();
    sendFetchNotification();
    res.json({ message: 'Queue cleared' });
    generateQueue();
  });
});

// Remove track from the queue
app.post('/queue/remove', authenticateToken, (req, res) => {
  const IdToRemove = req.body.id;
  dbQueue.run(`DELETE FROM queue WHERE id=?`, [IdToRemove], (err) => {
    if (err) return res.status(500).json({ error: 'Failed to remove from the queue' });
    sendFetchNotification();
    res.json({ message: 'Track removed from the queue' });
    generateQueue();
  });
});

// Pause track
app.post('/queue/pause', async (req, res) => {
  await dbQueue.run(`UPDATE queue SET status = 'paused' WHERE status = 'playing'`, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to pause the track' });
  });

  _currentAudio.stopIndexIncrement();
  await stopPlaying();
  sendFetchNotification();
  res.json({ message: 'Track paused' });
});

// Resume track
app.post('/queue/resume', async (req, res) => {
  dbQueue.run(`UPDATE queue SET status = 'playing' WHERE status = 'paused'`, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to resume the track' });
  });

  console.log(`[resume] Resuming track`);
  await play(_currentAudio.index);
  console.log(`[resume] after Play`);
  sendFetchNotification();
  console.log(`[resume] after sendFetchNotification`);
  res.json({ message: 'Track resumed' });
});

// Get all available tags
app.get('/queue/tags', (req, res) => {
  dbTagColors.all(`SELECT tag, color FROM tagColors ORDER BY id`, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to retrieve tags' });
    }

    const tagColorMap = rows.reduce((acc, row) => {
      acc[row.tag] = row.color;
      return acc;
    }, {});

    res.json(tagColorMap); // Return the unique tags as an array
  });
});




// ------------------------------------------------------FUNCTIONS---------------------------------------------------------------


// returns object item where status = 'playing'
const currentlyPlaying = () => {
  return new Promise((resolve, reject) => {
    dbQueue.get(`SELECT * FROM queue WHERE status = 'playing' ORDER BY id LIMIT 1`, (err, item) => {
      if (err) {
        console.error('[currentlyPlaying] Error accessing queue:', err);
        reject(err); // Reject the promise with the error
        return;
      }
      // NOTHING PLAYING
      if (!item) {
        console.log('[currentlyPlaying] Nothing with status "playing".');
        
        resolve(null); // Resolve with null if nothing is playing
        return;
      }
      console.log(`[currentlyPlaying] Currently playing: ${item.title}`)
      resolve(JSON.stringify(item));
    });
  });
};

const play = async (timestamp = 0) => {
  if (serverStatuses.playState === "play"){
    let currPlaying = await currentlyPlaying();
    if (currPlaying == null){
      console.log(`[play] Nothing currently playing (${currPlaying})`);

      let currentQueue = getCurrentQueue();
      if (currentQueue.length == 0){
        console.log(`[play] Current queue is empty. Generating new queue...`);
        currentQueue = await generateQueue();
      }
      if (currentQueue.length == 0){
        console.log(`[play] Current queue is still empty.`);
        setServerStatus('playState', "pause");
        return;
      }

      console.log(`[play] Playing next song from shuffled queue.`);
      let item = shiftQueue();

      // URL validation before playing
      const isValid = await validateAudioUrl(item);
      if (!isValid) {
          console.log(`[play] Refreshing expired audio URL for item ${item.id}`);
          await processSong(item);
      }

      await dbQueue.run(`UPDATE queue SET status = 'playing' WHERE id = ?`, [item.id]);
      _currentAudio.duration = item.duration;
      _currentAudio.index = timestamp;
      broadcastMessage({ event: 'play', message: { ...item, startTime: timestamp } });
      _currentAudio.startIndexIncrement();
      
    }else{
      const playingItem = JSON.parse(currPlaying);
      _currentAudio.duration = playingItem.duration;
      _currentAudio.index = timestamp;
      broadcastMessage({ event: 'play', message: { ...playingItem, startTime: timestamp } });
      _currentAudio.startIndexIncrement();
    }
    console.log(`[play] Playing at timestamp: ${timestamp}`);
  }
}

const next = async () => {
  await stopPlaying();
  _currentAudio.resetIndexIncrement(); // Reset the timer and index
  _currentAudio.index = 0; // Explicitly set index to 0
  setServerStatus('playState', "play");
}

const stopPlaying = async () => {
  return new Promise((resolve, reject) => {
    dbQueue.all(`SELECT * FROM queue WHERE status = 'playing' ORDER BY id`, (err, items) => {
      if (err) {
        console.error('[stopPlaying] Error accessing queue:', err);
        console.log('[stopPlaying] Retrying...');
        setTimeout(stopPlaying, 5000); // Retry after delay on error
        resolve(err);
        return;
      }
      if (!items || items.length === 0) {
        console.log('[stopPlaying] Nothing currently playing.');
        resolve(null);
        return;
      }
      items.forEach((item) => {
        dbQueue.run(`UPDATE queue SET status = 'finished' WHERE id = ?`, [item.id]);
        console.log(`[stopPlaying] Finished item with id=${item.id}`);
        // broadcastMessage({ event: 'track-ended', message: 0 });
        setServerStatus('playState', "pause");
        _currentAudio.resetIndexIncrement();
        sendFetchNotification();
        resolve(true);
      });
    });
  });
}

// Audio URL validation
const validateAudioUrl = async (item) => {
  try {
    if (!item.audioUrl) {
      console.log(`[validateAudioUrl] No audioUrl for item ${item.id}, refreshing...`);
      return false;
    }

    const response = await fetch(item.audioUrl, { method: 'HEAD' });
    if (!response.ok) {
      console.log(`[validateAudioUrl] Invalid audioUrl for item ${item.id}, refreshing...`);
      return false;
    }
    return true;
  } catch (error) {
    console.log(`[validateAudioUrl] Error checking audioUrl: ${error.message}`);
    return false;
  }
};

// shorten links from error messages
function formatError(err) {
  const message = err.message || String(err);
  const urlRegex = /(https?:\/\/[^\s]+)/; // Match the URL
  const match = message.match(urlRegex);

  if (match && match[1]) {
      const fullUrl = match[1];
      const shortenedUrl = fullUrl.split('?')[0] + '(...)'; // Keep the base URL and truncate the rest
      return message.replace(fullUrl, shortenedUrl);
  }

  return message; // If no URL found, return the original message
}



server.listen(PORT, () => console.log('\x1b[2m%s\x1b[0m', `Running server on port ${PORT}`))
module.exports = app;