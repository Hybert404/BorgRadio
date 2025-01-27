const express      = require('express')
const http         = require("http")
const ytdlp        = require('yt-dlp-exec');
const cors         = require('cors');
const ffmpeg       = require('fluent-ffmpeg');
const ffmpegPath   = require('@ffmpeg-installer/ffmpeg').path;
const WebSocket    = require('ws');
const bcrypt       = require('bcrypt');
const bodyParser   = require('body-parser');
const jwt          = require('jsonwebtoken'); // Optional

let serverStatuses = {
  loopQueue: true,
  randomizeQueue: false,
  playState: false
};

let shuffledQueue = [];

const sqlite3      = require('sqlite3').verbose();
const app          = express()
const server       = http.createServer(app);
const wss          = new WebSocket.Server({ server });

const db           = new sqlite3.Database('./queue.db');
const dbUsers      = new sqlite3.Database('./users.db');
const PORT         = process.env.PORT || 5000
const SECRET_KEY   = 'very-secure-secret-key-1234';

ffmpeg.setFfmpegPath(ffmpegPath);
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Create queue table if it doesn't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    title TEXT,
    status TEXT DEFAULT 'pending',
    audioUrl TEXT,
    duration INTEGER
  )`);
});

dbUsers.serialize(() => {
  dbUsers.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    pwdHash TEXT NOT NULL
  )`, (err) => {
    if (err) {
        console.error('Error creating table:', err.message);
    };
  });
});

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

// ------------------------------------------------------WEBSOCKET---------------------------------------------------------------
const activeConnections = new Set();

wss.on('connection', (ws) => {
  console.log('\x1b[32m%s\x1b[0m', 'Client connected');
  activeConnections.add(ws);

  wss.emit('statusUpdate', serverStatuses); // Send all statuses to the client

  wss.on('statusUpdate', (updates) => {
    Object.assign(serverStatuses, updates);  // Merge updates into server state
    broadcastMessage({ event: 'statusUpdate', message: serverStatuses });
  });

  if (activeConnections.size > 0){
    play();
  }

  ws.on('message', (message) => {
    // ws.send({message});
    const messageString = Buffer.from(message).toString();  // Decode buffer to string
    console.log('Received:', {message, messageString});    
    const data = JSON.parse(messageString);  // Parse the JSON message
    switch(data.type){

      case 'params':
        loopQueue = data.message.loopQueue;
        randomizeQueue = data.message.randomizeQueue;
        console.log(data.message.status);
        console.log(data);
        break;

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

// Function to send a message to all WebSocket clients
const broadcastMessage = (message) => {
  activeConnections.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
          console.log('\x1b[34m%s\x1b[0m', `Sent msg: ${JSON.stringify(message).slice(0,1500)}`);
      }
  });
};

// Notify all active WebSocket clients to fetch queue
const sendFetchNotification = () =>{
  broadcastMessage({ event: 'refresh', message: JSON.stringify('Refreshing...') });
}
// ------------------------------------------------------------------------------------------------------------




// ---------------------------ENDPOINTS----------------------------------
// ------USERS-------

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
  }

  // Query the database for the user
  const sql = `SELECT * FROM users WHERE username = ?`;
  dbUsers.get(sql, [username], async (err, row) => {
      if (err) {
          console.error('Database error:', err.message);
          return res.status(500).json({ error: 'Internal server error' });
      }

      if (!row) {
          return res.status(404).json({ error: 'User not found' });
      }

      // Compare the provided password with the stored hash
      const passwordMatch = await bcrypt.compare(password, row.pwdHash);
      if (!passwordMatch) {
          return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate a JWT token (optional)
      const token = jwt.sign({ id: row.id, username: row.username }, SECRET_KEY, { expiresIn: '1h' });

      return res.json({ message: 'Login successful', token });
  });
});

// Register endpoint
app.post('/api/register', async (req, res) => {
  const { username, password, secret } = req.body;
  console.log(req.body);

  if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
  }
  if (!secret || secret !== '1111') { //completly secure way of authorizing administrator
    return res.status(400).json({ error: 'You are not authorized to add users.' });
  }

  try {
      // Hash the password
      const saltRounds = 10;
      const pwdHash = await bcrypt.hash(password, saltRounds);

      // Insert the user into the database
      const sql = `INSERT INTO users (username, pwdHash) VALUES (?, ?)`;
      dbUsers.run(sql, [username, pwdHash], function (err) {
          if (err) {
              console.error('Error inserting user:', err.message);
              return res.status(500).json({ error: 'Internal server error' });
          }

          res.json({ message: 'User registered successfully', userId: this.lastID });
      });
  } catch (error) {
      console.error('Error hashing password:', error.message);
      res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/userinfo', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
      const decoded = jwt.verify(token, SECRET_KEY);
      res.json({ id: decoded.id, username: decoded.username });
  } catch (err) {
      res.status(403).json({ error: 'Invalid token' });
  }
});



// ------QUEUE-------

// Get audio stream URL
app.post('/process', async (req, res) => {
  console.log('body:', req.body)
  const { url } = req.body;
  getAudioUrlAndTitle(url).then(({ title, audioUrl }) =>{
    res.json({ title: title, url: audioUrl })
  });
});

// Get the Current Queue
app.get('/queue', (req, res) => {
  db.all(`SELECT * FROM queue ORDER BY id`, (err, rows) => {
      if (err) {
      return res.status(500).json({ error: 'Failed to retrieve queue' });
      }
      res.json(rows);
  });
});

// Add URL to Queue and process title
app.post('/queue/add', (req, res) => {
  const { url } = req.body;
  if (!url || url.startsWith('https://') == false) {
    return res.status(400).json({ error: 'YouTube URL is required' });
  }

  db.run(`INSERT INTO queue (url, status) VALUES (?, 'pending')`, [url], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to add to queue' });
    }
    res.json({ message: 'URL added to queue', id: this.lastID });

    // processTitle(this.lastID); // process title for the new db entry
    processNextFromQueue(); // trigger queue processing
  });
});

// Skip endpoint
app.post('/queue/skip', async (req, res) => {
  skipTrack(res); // Skip the current track
  res.status(200).send('Track skipped');
});


// Clear Queue
app.post('/queue/clear', (req, res) => {
  db.run(`DELETE FROM queue`, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to clear the queue' });
    serverStatuses.playState = "pause";
    stopPlaying();
    sendFetchNotification();
    res.json({ message: 'Queue cleared' });
  });
});

// Remove track from the queue
app.post('/queue/remove', (req, res) => {
  const IdToRemove = req.body.id;
  db.run(`DELETE FROM queue WHERE id=?`, [IdToRemove], (err) => {
    if (err) return res.status(500).json({ error: 'Failed to remove from the queue' });
    sendFetchNotification();
    res.json({ message: 'Track removed from the queue' });
  });
});

// Pause track
app.post('/queue/pause', (req, res) => {
  db.run(`UPDATE queue SET status = 'paused' WHERE status = 'playing'`, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to pause the track' });
    _currentAudio.stopIndexIncrement();
    stopPlaying();
    sendFetchNotification();
    res.json({ message: 'Track paused' });
  });
});

// Resume track
app.post('/queue/resume', (req, res) => {
  db.run(`UPDATE queue SET status = 'playing' WHERE status = 'paused'`, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to resume the track' });
    play();
    sendFetchNotification();
    res.json({ message: 'Track resumed' });
  });
});



// ------------------------------------------------------FUNCTIONS---------------------------------------------------------------

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



// Helper function to fetch all pending items based on tags
const getAllPendingItems = async (tags = []) => {
  let query = `SELECT * FROM queue WHERE status = 'pending'`;
  const params = [];

  // Add tag filtering if tags are provided
  if (tags.length > 0) {
    const tagConditions = tags.map(() => `tags LIKE ?`).join(' AND ');
    query += ` AND (${tagConditions})`;
    params.push(...tags.map(tag => `%${tag}%`)); // Use LIKE for partial match
  }

  return new Promise((resolve, reject) => {
    db.all(query, params, (err, items) => {
      if (err) {
        console.error('[getAllPendingItems] Error fetching items:', err);
        reject(err);
      } else {
        resolve(items || []);
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
    const tagConditions = tags.map(() => `tags LIKE ?`).join(' AND ');
    query += ` AND (${tagConditions})`;
    params.push(...tags.map(tag => `%${tag}%`)); // Use LIKE for partial match
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

// Helper function to process and play a song
const playSong = async (item) => {
  try {
    // Mark the item as processing
    await updateItemStatus(item.id, 'processing');
    sendFetchNotification();

    // Fetch and process the audio URL and title
    const { title, audioUrl } = await getAudioUrlAndTitle(item.url);
    const duration = await getDuration(audioUrl);

    // Update the database with the processed item
    db.run(
      `UPDATE queue SET status = 'processed', audioUrl = ?, title = ?, duration = ? WHERE id = ?`,
      [audioUrl, title, duration, item.id],
      (err) => {
        if (err) {
          console.error('[playSong] Error updating processed item:', err);
        } else {
          console.log(`[playSong] Successfully processed item: ${title}`);
          sendFetchNotification();
          play();
        }
      }
    );
  } catch (error) {
    console.error('[playSong] Error:', error.message);
  }
};

// Helper function to update item status
const updateItemStatus = async (id, status) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE queue SET status = ? WHERE id = ?`, [status, id], (err) => {
      if (err) {
        console.error(`[updateItemStatus] Error updating status to ${status}:`, err);
        reject(err);
      } else {
        resolve();
      }
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
    db.run(`UPDATE queue SET status = 'processed', audioUrl = ?, title = ?  WHERE id = ?`, [audioUrl, title, id]);
    sendFetchNotification();

    return true; // Resolves with true
  } catch (error) {
    console.error('Error processing row:', error);
    throw error; // Propagates the error
  }
};


// returns object item where status = 'playing'
const currentlyPlaying = () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM queue WHERE status = 'playing' ORDER BY id LIMIT 1`, (err, item) => {
      if (err) {
        console.error('[currentlyPlaying] Error accessing queue:', err);
        reject(err); // Reject the promise with the error
        return;
      }
      // NOTHING PLAYING = FETCHING NEXT PROCESSED
      if (!item) {
        console.log('[currentlyPlaying] Fetching next processed track.');
        // Fetching next processed entry and marking it as playing
        db.get(`SELECT * FROM queue WHERE status = 'processed' ORDER BY id LIMIT 1`, (err, item) => {
          if (err) {
            console.error('[currentlyPlaying] Error accessing queue:', err);
            reject(err); // Reject the promise with the error
            return;
          }
          // NOTHING PROCESSED = RETURN NULL
          if (!item) {
            console.log('[currentlyPlaying] No processed songs.');
            resolve(null);
            return;
          }
          db.run(`UPDATE queue SET status = 'playing' WHERE id = ?`, [item.id]);
          play();
          sendFetchNotification();
          resolve(JSON.stringify(item));
        });
        resolve(null); // Resolve with null if no playing or processed songs
        return;
      }
      console.log(`[currentlyPlaying] Currently playing: ${item.title}`)
      resolve(JSON.stringify(item));
    });
  });
};

const play = async () => {
  // console.log(`[play] playState: ${serverStatuses.playState}`);
  if (serverStatuses.playState == "play"){
    let currPlaying = await currentlyPlaying();
    if (currPlaying == null){
      console.log(`[play] currently playing (null): ${currPlaying}`);
      await processNextFromQueue();
    }else{
      serverStatuses.playState = "play";
      _currentAudio.duration = JSON.parse(currPlaying).duration;
      broadcastMessage({ event: 'play', message: currPlaying });
      _currentAudio.startIndexIncrement();
    }
  }
}

const next = async () => {
  await stopPlaying();
  serverStatuses.playState = "play";
  play();
}

const stopPlaying = async () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM queue WHERE status = 'playing' ORDER BY id`, (err, items) => {
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
        db.run(`UPDATE queue SET status = 'finished' WHERE id = ?`, [item.id]);
        console.log(`[stopPlaying] Finished item with id=${item.id}`);
        // broadcastMessage({ event: 'track-ended', message: 0 });
        serverStatuses.playState = "pause";
        _currentAudio.stopIndexIncrement();
        sendFetchNotification();
        resolve(true);
      });
    });
  });
}

// Find url with given id of the row
const getById = (id) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM queue WHERE id = ? ORDER BY id LIMIT 1`, [id], (err, item) => {
      if (err) {
        console.error('[getUrlById] Error accessing db: ', err);
        reject(err); // Reject the promise with the error
        return;
      }
      if (!item) {
        console.error(`[getUrlById] No data with id =${id}: `, err);
        reject(null); // Resolve with null
        return;
      }
      console.log(`[getUrlById] Found row with id=${id}`)
      resolve(item); // Resolve with URL
    });
  });
};

const isQueueEmpty = () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM queue WHERE NOT status = 'finished' ORDER BY id LIMIT 1`, (err, item) => {
      if (err) {
        console.error('[isQueueEmpty] Error accessing queue:', err);
        resolve(null);
        return;
      }
      if (!item) {
        console.log('[isQueueEmpty] No processed songs.');
        resolve(true);
        return;
      }
      resolve(false);
      return;
    });
  });
}

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