const express      = require('express')
const http         = require("http")
const ytdlp        = require('yt-dlp-exec');
const cors         = require('cors');
const ffmpeg       = require('fluent-ffmpeg');
const ffmpegPath   = require('@ffmpeg-installer/ffmpeg').path;
const WebSocket    = require('ws');

class currentAudio {
  constructor({url, state = "pause", index = 0, duration = null}){
    this.url = url;
    this.state = state;
    this.index = index;
    this.duration = duration;
    this.timer = null; // To store the interval ID
  }

  startIndexIncrement() {
    if (this.state === "play" && !this.timer) {
      this.timer = setInterval(() => {
        this.index += 1;

        // If duration is set and index reaches duration, stop the timer
        if (this.duration !== null && this.index >= this.duration) {
          this.stopIndexIncrement();
          next();
        }

        console.log(`Index incremented to: ${this.index}`);
      }, 1000);
    }
  }

  stopIndexIncrement() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("Index increment stopped.");
    }
  }
}
var _currentAudio = new currentAudio({url: null})

const sqlite3      = require('sqlite3').verbose();
const app          = express()
const server       = http.createServer(app);
const wss          = new WebSocket.Server({ server });

const db           = new sqlite3.Database('./queue.db');

ffmpeg.setFfmpegPath(ffmpegPath);
app.use(cors());
app.use(express.json());

const PORT        = process.env.PORT || 5000



// ---------WEBSOCKET---------
const activeConnections = new Set();

wss.on('connection', (ws) => {
  console.log('Client connected');
  activeConnections.add(ws);
  let iqe = isQueueEmpty();
  if (activeConnections.size > 0 && _currentAudio.state == "pause" && iqe == false){
    play();
  }

  ws.on('message', (message) => {
    console.log('Received:', message);
    ws.send(`Echo: ${message}`);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    activeConnections.delete(ws);
  });
});

// Function to send a message to all WebSocket clients
const broadcastMessage = (message) => {
  activeConnections.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
          console.log(`Sent msg:\t${JSON.stringify(message)}`)
      }
  });
};

// Notify all active WebSocket clients to fetch queue
const sendFetchNotification = () =>{
  broadcastMessage({ event: 'refresh', message: 'Refreshing queue.' });
}
// --------------------------

const play = async () => {
  if(_currentAudio.state == "pause"){
    _currentAudio.state = "play";
    let currPlaying = await currentlyPlaying();   //[id, audioUrl, title, duration]
    console.log(currPlaying);
    broadcastMessage({ event: 'play', message: currPlaying[1] });
    _currentAudio.startIndexIncrement();
  }
}

const next = async () => {
  _currentAudio.state = "pause";
  stopPlaying();
  let currPlaying = await currentlyPlaying();   //[id, audioUrl, title, duration]
  if(currPlaying != null){
    _currentAudio.state = "play";
    broadcastMessage({ event: 'play', message: currPlaying[1] });
    _currentAudio.startIndexIncrement();
  }else{
    broadcastMessage({ event: 'queue-end', message: "Queue has ended." });
  };
}

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

// ------------STREAM / BROADCAST----------------------------------

// Function to stream audio to the client
const streamAudio = async (res) => {
  try {
      let currPlaying = await currentlyPlaying();
      if (currPlaying == null) {
          console.log('[streamAudio] No audio currently playing.');
          broadcastMessage({ event: 'no-audio', message: 'No audio currently playing.' });
          return;
      }

      let audioUrl = currPlaying[1];
      processNextFromQueue(); // Cache next URL

      // Terminate any existing FFmpeg instance
      if (audioStream) {
          console.log('[streamAudio] Terminating previous FFmpeg instance.');
          audioStream.kill('SIGTERM');
          audioStream = null;
      }

      // Create a new FFmpeg instance for streaming
      audioStream = ffmpeg(audioUrl)
          .audioCodec('libmp3lame')
          .format('mp3')
          .on('end', () => {
              console.log('[streamAudio] Track ended.');
              broadcastMessage({ event: 'track-ended', message: 'Track has ended.' });
              stopPlaying();
              streamAudio(res); // Start the next track
          })
          .on('error', async (err) => {
              console.error('[streamAudio] FFmpeg error:', err.message);

              if (err.message.includes('403 Forbidden')) {
                  console.log('[streamAudio] Reprocessing audio URL...');
                  let currPlaying = await currentlyPlaying();
                  let idToReprocess = currPlaying[0];
                  await reprocessRowById(idToReprocess);
                  console.log('[streamAudio] Reprocessing finished.');
                  streamAudio(res);
              } else {
                  broadcastMessage({ event: 'error', message: 'Error during streaming.' });
              }
          });

      console.log('[streamAudio] Streaming audio to client.');
      audioStream.pipe(res);
      broadcastMessage({ event: 'playing', message: `Streaming started: ${currPlaying[2]}` });
  } catch (error) {
      console.error('[streamAudio] Error:', error);
      broadcastMessage({ event: 'error', message: 'Unable to stream audio.' });
  }
};



// Stream endpoint
app.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'audio/mpeg');
  // (async () => {
  //   try {
  //     const audioUrl = await currentlyPlaying()[1];
  //     if (audioUrl) {
  //       console.log(`[/stream] Currently playing URL: ${audioUrl.slice(0,100)}...`);
  //     } else {
  //       console.log('[/stream] No audio currently playing.');
  //       await processNextFromQueue();
  //     }
  //   } catch (error) {
  //     console.error('[/stream] Error retrieving currently playing audio:', error);
  //   }
  // })();
  streamAudio(res);
});
//---------------------------------------------------------------




// Get audio stream URL
app.post('/process', async (req, res) => {
    console.log('body:', req.body)
    const { url } = req.body;
    getAudioUrlAndTitle(url).then(({ title, audioUrl }) =>{
      res.json({ title: title, url: audioUrl })
    });
});


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


// -----------QUEUE----------------

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
  if (!url) {
    return res.status(400).json({ error: 'YouTube URL is required' });
  }

  db.run(`INSERT INTO queue (url, status) VALUES (?, 'pending')`, [url], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to add to queue' });
    }
    res.json({ message: 'URL added to queue', id: this.lastID });

    // processTitle(this.lastID); // process title for the new db entry
    processQueue(); // trigger queue processing
  });
});

// Skip the Current Song
// app.post('/queue/skip', (req, res) => {
//   stopPlaying();
//   (async () => {
//     try {
//       const audioUrl = await currentlyPlaying()[1];
//       if (audioUrl) {
//         // console.log('[/queue/skip] Currently playing URL:', audioUrl);
//       } else {
//         console.log('[/queue/skip] No audio currently playing.');
//         return;
//       }
//     } catch (error) {
//       console.error('[/queue/skip] Error retrieving currently playing audio:', error);
//     }
//   })();
//   res.json({ message: 'Song skipped' });
// });

// Skip function to transition to the next track
// const skipTrack = async (res) => {
//   console.log('[skipTrack] Skipping current track...');
//   if (audioStream) {
//     audioStream.kill('SIGTERM'); // Stop the current track
//     stopPlaying();
//   }
//   streamAudio(res); // Start the next track
// };

// Function to skip the current track
const skipTrack = async (res) => {
    console.log('[skipTrack] Skipping current track.');
    // if (audioStream) {
    //     console.log('[skipTrack] Terminating FFmpeg instance.');
    //     audioStream.kill('SIGTERM');
    //     audioStream = null;
    // }
    broadcastMessage({ event: 'track-skipped', message: 'Track skipped.' });
    next();
    // streamAudio(res); // Start the next track
};

// Skip endpoint
app.post('/queue/skip', async (req, res) => {
  skipTrack(res); // Skip the current track
  res.status(200).send('Track skipped');
});


// Clear Queue
app.post('/queue/clear', (req, res) => {
  db.run(`DELETE FROM queue`, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to clear the queue' });
    res.json({ message: 'Queue cleared' });
  });
});


//
const processQueue = () => {
  db.get(`SELECT * FROM queue WHERE status = 'playing' ORDER BY id LIMIT 1`, (err, item) => {
    if (err) {
      console.error('[processQueue] Error accessing queue:', err);
      console.log('[processQueue] Retrying...');
      setTimeout(processQueue, 5000); // Retry after delay on error
      return;
    }
    if (!item) {
      processNextFromQueue();
    }
  });
}

// Get next song from the queue, process streaming url and save it to db
const processNextFromQueue = async () => {
  // Find the first pending item in the queue
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM queue WHERE status = 'pending' ORDER BY id LIMIT 1`, (err, item) => {
      if (err) {
        console.error('[processNextFromQueue] Error accessing queue:', err);
        console.log('[processNextFromQueue] Retrying...');
        reject(err); // Reject the promise with the error
        return;
      }
      if (!item) {
        console.log('[processNextFromQueue] No more links to process.');
        // setTimeout(processQueue, 5000); // Check again after 5 seconds
        resolve(null);
        return;
      }

      // Mark it as processing
      db.run(`UPDATE queue SET status = 'processing' WHERE id = ?`, [item.id]);
      sendFetchNotification();

      // Run yt-dlp to get the audio URL
      // getAudioStreamURL(item.url).then(({ title, audioUrl })=> {
      //   db.run(`UPDATE queue SET status = 'processed', audioUrl = ? WHERE id = ?`, [audioUrl, item.id]);
      //   sendFetchNotification();
      // });
      (async () => {
        try {
          const { title, audioUrl } = await getAudioUrlAndTitle(item.url);
          let duration = 100;
          console.log(duration);
          duration = await getDuration(audioUrl);
          console.log(title);
          console.log(duration);
          db.run(`UPDATE queue SET status = 'processed', audioUrl = ?, title = ?, duration = ? WHERE id = ?`, [audioUrl, title, duration, item.id,]);
          sendFetchNotification();
          await currentlyPlaying();
        } catch (error) {
          console.error(`[processNextFromQueue] Error: `, error.message);
        }
      })();

      resolve(true); // Resolve with stream url
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


// returns [id, audioUrl, title, duration] where status = 'playing'
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
          sendFetchNotification();
          resolve([item.id, item.audioUrl, item.title, item.duration]);
        });
        resolve(null); // Resolve with null if no playing or processed songs
        return;
      }
      console.log(`[currentlyPlaying] Currently playing: ${item.title}`)
      resolve([item.id, item.audioUrl, item.title, item.duration]);
    });
  });
};

const stopPlaying = () => {
  db.all(`SELECT * FROM queue WHERE status = 'playing' ORDER BY id`, (err, items) => {
    if (err) {
      console.error('[stopPlaying] Error accessing queue:', err);
      console.log('[stopPlaying] Retrying...');
      setTimeout(processQueue, 5000); // Retry after delay on error
      return;
    }
    if (!items || items.length === 0) {
      console.log('[stopPlaying] Nothing currently playing.');
      return;
    }
    items.forEach((item) => {
      db.run(`UPDATE queue SET status = 'finished' WHERE id = ?`, [item.id]);
      console.log(`[stopPlaying] Skipped item with id=${item.id}`);
      // audioStream.kill('SIGTERM');
      sendFetchNotification();
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
// --------------------------------

//po co ta funkcja debilu
// const processTitle = (id, ws) =>{
//   db.get(`SELECT * FROM queue WHERE id = ? ORDER BY id LIMIT 1`, [id], (err, item) => {
//     if (err) {
//       console.error(`DB error trying to find row with ID=${id}`, err);
//       return;
//     }
//     if (!item) {
//       console.error(`No item found with ID=${id}`);
//       return;
//     }

//     getAudioStreamURL(item.url).then(({ title, audioUrl }) =>{
//       if(title != '' && title != null){
//         if(title.startsWith('https://')){ // temp bug fix
//           processTitle(id, ws);
//           return;
//         }
//         db.run(`UPDATE queue SET title = ? WHERE id = ?`, [title, id]);
//         console.log(`Title for id ${item.id} set.`);

//         sendFetchNotification();
//       }
//     });
//   });
// }



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



server.listen(PORT, () => console.log(`Running server on port ${PORT}`))