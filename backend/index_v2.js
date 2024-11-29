const EventEmitter = require('events')
const schedule     = require('node-schedule')
const express      = require('express')
const http         = require("http")
const https        = require("https");
const fs           = require('fs')
const ytDlp_        = require('yt-dlp-wrap')
const ytdlp        = require('yt-dlp-exec');
const cors         = require('cors');
const { spawn }    = require('child_process');
const ffmpeg       = require('fluent-ffmpeg');
const ffmpegPath   = require('@ffmpeg-installer/ffmpeg').path;
const WebSocket    = require('ws');
const { get }      = require('https');
const { Readable } = require('stream');
const got          = require('got');
let audioStream    = null; // Store reference to the current FFmpeg command

const sqlite3      = require('sqlite3').verbose();
const app          = express()
const server       = http.createServer(app);
const wss          = new WebSocket.Server({ server });

const db           = new sqlite3.Database('./queue.db');

ffmpeg.setFfmpegPath(ffmpegPath);
app.use(cors());
app.use(express.json());


const SAMPLE_SIZE = 32000                         // samples/sec
const PACKET_SIZE = SAMPLE_SIZE                   // 1 second worth of data
const UPDATE_TIME = '* * * * * *'                 // every second
let   PACKET_NUM  = 0
const PORT        = process.env.PORT || 5000
const eventEmitter= new EventEmitter ()

let currentlyPlayingUrl = ``;
// const AUDIO_PATH = `https://rr5---sn-u2oxu-f5fer.googlevideo.com/videoplayback?expire=1731862270&ei=nso5Z4KvGYPHi9oPw6PqoQI&ip=46.45.68.184&id=o-ACzjf1mJz9wjS1vLN4ItlpMGQz7fIXnAYw3QCKEAVbSI&itag=251&source=youtube&requiressl=yes&xpc=EgVo2aDSNQ%3D%3D&met=1731840670%2C&mh=9H&mm=31%2C26&mn=sn-u2oxu-f5fer%2Csn-4g5lznl6&ms=au%2Conr&mv=m&mvi=5&pl=22&rms=au%2Cau&initcwndbps=1956250&spc=qtApAV5yN7s3uo3NI5YbNfpP1zucU5GAbrBRgaLzft5Rwjo&vprv=1&svpuc=1&mime=audio%2Fwebm&rqh=1&gir=yes&clen=1740251&dur=121.181&lmt=1727539297339101&mt=1731840308&fvip=4&keepalive=yes&fexp=51299154%2C51312688%2C51326932&c=IOS&txp=5532434&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cxpc%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Crqh%2Cgir%2Cclen%2Cdur%2Clmt&sig=AJfQdSswRAIgdf67D8gXWoYMAIa_WawgQb7qUrejMmWQH3KPi3GUb_wCIGnUIp-Y-QyDDN3a3n-_YBzTeWeo6k6AQLfonuGFzEo4&lsparams=met%2Cmh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Crms%2Cinitcwndbps&lsig=AGluJ3MwRQIhAJKdak-uHZrenoFFPGDA7P1ItOn0V3FAdbF7hdRamx8xAiAdVsVL1cySzpIkg2jWhVBZ9gLpYxN28XOZfSRNwzy80w%3D%3D`


// ------------STREAM / BROADCAST----------------------------------

// Function to stream audio to the client
const streamAudio = async (res) => {
    try {
      let currPlaying = await currentlyPlaying();
      if (currPlaying == null){
        console.log('[streamAudio] No audio currently playing.');
        return;
      }
      let audioUrl = currPlaying[1];
      processNextFromQueue(); // cache next url
    
  
      // Create an FFmpeg command to handle audio streaming
      audioStream = ffmpeg(audioUrl)
        .audioCodec('libmp3lame')
        .format('mp3')
        .on('end', () => {
          stopPlaying();
          streamAudio(res); // Recursively stream the next track
        })
        .on('error', async (err) => {
          console.error('[streamAudio] FFmpeg error:', formatError(err));
          //reprocess expired urls
          if (err.message.includes('403 Forbidden')) {
            console.log('[streamAudio] Reprocessing audio url...');
            let currPlaying = await currentlyPlaying();
            let idToReprocess = currPlaying[0];
            console.log(idToReprocess);
            await reprocessRowById(idToReprocess);
            console.log('[streamAudio] Reprocessing finished.');
            streamAudio(res);

          };
          // res.end(); // End the response on error
        });

      // Generate a silent stream if needed and mix it
      ffmpeg()
        .input('anullsrc=r=44100:cl=stereo') // Silence input
        .audioCodec('libmp3lame')
        .format('mp3')
        .on('error', (err) => {
          console.error('FFmpeg error (silence):', err);
          res.end();
        })
        .output(res, { end: false }); // Pipe silence to the response without ending the stream
      audioStream.pipe(res, { end: false }); // Start streaming the actual audio to the client
    
    } catch (error) {
      console.error('Error retrieving currently playing audio:', error);
    }
};

// Stream endpoint
app.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'audio/mpeg');
  (async () => {
    try {
      const audioUrl = await currentlyPlaying()[1];
      if (audioUrl) {
        console.log(`[/stream] Currently playing URL: ${audioUrl.slice(0,100)}...`);
      } else {
        console.log('[/stream] No audio currently playing.');
        await processNextFromQueue();
      }
    } catch (error) {
      console.error('[/stream] Error retrieving currently playing audio:', error);
    }
  })();
  streamAudio(res);
});
//---------------------------------------------------------------

// ---------WEBSOCKET---------
const activeConnections = new Set();

wss.on('connection', (ws) => {
  console.log('Client connected');
  activeConnections.add(ws);

  ws.on('message', (message) => {
    console.log('Received:', message);
    ws.send(`Echo: ${message}`);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    activeConnections.delete(ws);
  });
});
// --------------------------


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
    audioUrl TEXT
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
const skipTrack = async (res) => {
  console.log('[skipTrack] Skipping current track...');
  if (audioStream) {
    audioStream.kill('SIGTERM'); // Stop the current track
    stopPlaying();
  }
  streamAudio(res); // Start the next track
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
const processNextFromQueue = () => {
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
          db.run(`UPDATE queue SET status = 'processed', audioUrl = ?, title = ? WHERE id = ?`, [audioUrl, title, item.id]);
          sendFetchNotification();
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
    const test = db.run(`UPDATE queue SET status = 'processing' WHERE id = ?`, [id]);
    console.log(`Db: ${test}`);
    sendFetchNotification();

    // Get the URL to reprocess
    const itemToReprocess = await getById(id);
    const urlToReprocess = itemToReprocess.url;
    console.log(urlToReprocess);

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


// returns [id, audioUrl] where status = 'playing'
const currentlyPlaying = () => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM queue WHERE status = 'playing' ORDER BY id LIMIT 1`, (err, item) => {
      if (err) {
        console.error('[currentlyPlaying] Error accessing queue:', err);
        reject(err); // Reject the promise with the error
        return;
      }
      if (!item) {
        console.log('[currentlyPlaying] Nothing currently playing. Looking for next track.');
        // Fetching next processed entry and marking it as playing
        db.get(`SELECT * FROM queue WHERE status = 'processed' ORDER BY id LIMIT 1`, (err, item) => {
          if (err) {
            console.error('[currentlyPlaying] Error accessing queue:', err);
            reject(err); // Reject the promise with the error
            return;
          }
          if (!item) {
            console.log('[currentlyPlaying] No processed songs.');
            resolve(null);
            return;
          }
          db.run(`UPDATE queue SET status = 'playing' WHERE id = ?`, [item.id]);
          sendFetchNotification();
          resolve(item.audioUrl); // Resolve with the audio URL
        });
        resolve(null); // Resolve with null if no playing or processed songs
        return;
      }
      console.log(`[currentlyPlaying] Currently playing: ${item.title}`)
      resolve([item.id, item.audioUrl]); // Resolve with the audio URL
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

// Notify all active WebSocket clients to fetch queue
const sendFetchNotification = () =>{
  activeConnections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('fetchQueue');
    }
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



server.listen(PORT, () => console.log(`Running server on port ${PORT}`))