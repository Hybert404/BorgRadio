const EventEmitter = require('events')
const schedule     = require('node-schedule')
const express      = require('express')
const http         = require("http")
const https        = require("https");
const fs           = require('fs')
const ytDlp        = require('yt-dlp-wrap')
const cors         = require('cors');
const { spawn }    = require('child_process');
const ffmpeg       = require('fluent-ffmpeg');
const WebSocket    = require('ws');
const { get }      = require('https');
const { Readable } = require('stream');
const got          = require('got');

const sqlite3      = require('sqlite3').verbose();
const app          = express()
const server       = http.createServer(app);
const wss          = new WebSocket.Server({ server });

// var audioStreamUrl       = "";
const db           = new sqlite3.Database('./queue.db');

app.use(cors());
app.use(express.json());


const SAMPLE_SIZE = 32000                         // samples/sec
const PACKET_SIZE = SAMPLE_SIZE                   // 1 second worth of data
const UPDATE_TIME = '* * * * * *'                 // every second
let   PACKET_NUM  = 0
const PORT        = process.env.PORT || 5000
const eventEmitter= new EventEmitter ()
const AUDIO_PATH = `https://rr5---sn-u2oxu-f5fer.googlevideo.com/videoplayback?expire=1731862270&ei=nso5Z4KvGYPHi9oPw6PqoQI&ip=46.45.68.184&id=o-ACzjf1mJz9wjS1vLN4ItlpMGQz7fIXnAYw3QCKEAVbSI&itag=251&source=youtube&requiressl=yes&xpc=EgVo2aDSNQ%3D%3D&met=1731840670%2C&mh=9H&mm=31%2C26&mn=sn-u2oxu-f5fer%2Csn-4g5lznl6&ms=au%2Conr&mv=m&mvi=5&pl=22&rms=au%2Cau&initcwndbps=1956250&spc=qtApAV5yN7s3uo3NI5YbNfpP1zucU5GAbrBRgaLzft5Rwjo&vprv=1&svpuc=1&mime=audio%2Fwebm&rqh=1&gir=yes&clen=1740251&dur=121.181&lmt=1727539297339101&mt=1731840308&fvip=4&keepalive=yes&fexp=51299154%2C51312688%2C51326932&c=IOS&txp=5532434&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cxpc%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Crqh%2Cgir%2Cclen%2Cdur%2Clmt&sig=AJfQdSswRAIgdf67D8gXWoYMAIa_WawgQb7qUrejMmWQH3KPi3GUb_wCIGnUIp-Y-QyDDN3a3n-_YBzTeWeo6k6AQLfonuGFzEo4&lsparams=met%2Cmh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Crms%2Cinitcwndbps&lsig=AGluJ3MwRQIhAJKdak-uHZrenoFFPGDA7P1ItOn0V3FAdbF7hdRamx8xAiAdVsVL1cySzpIkg2jWhVBZ9gLpYxN28XOZfSRNwzy80w%3D%3D`

// Function to start the FFmpeg process for a given song URL or path
// const startFFmpeg = (songPath) => {
//   const ffmpeg = spawn('ffmpeg', [
//     '-i', songPath,  // The source URL or file path for the current song
//     '-f', 'mp3',
//     '-vn',  // No video
//     '-ar', '44100', // Audio sample rate
//     '-ac', '2', // Stereo audio
//     '-b:a', '192k', // Audio bitrate
//     AUDIO_PATH // Output path where FFmpeg writes the audio
//   ]);

//   ffmpeg.stdout.on('data', (data) => {
//     console.log('FFmpeg stdout:', data.toString());
//   });

//   ffmpeg.stderr.on('data', (data) => {
//     console.error('FFmpeg stderr:', data.toString());
//   });

//   ffmpeg.on('exit', (code) => {
//     if (code !== 0) {
//       console.error(`FFmpeg process exited with code ${code}`);
//     }
//     // Once a song finishes, start playing the next song in the queue
//     playNextSong();
//   });

//   return ffmpeg;
// };

// Function to load and play the next song in the queue
// const playNextSong = () => {
//   if (audioQueue.length === 0) {
//     console.log('Queue is empty');
//     return;
//   }

//   // Get the next song from the queue
//   const nextSong = audioQueue[currentSongIndex];
//   currentSongIndex = (currentSongIndex + 1) % audioQueue.length; // Loop back to the first song if end of queue

//   console.log(`Playing next song: ${nextSong}`);
  
//   // Start FFmpeg process for the next song in the queue
//   startFFmpeg(nextSong);
// };







// ---------------TEST---dziala, streamuje, brak mozliwosci skipowania, po odswiezeniu od nowa leci-------------------


// app.get('/stream', (req, res) => {
//   // Set Content-Type for audio
//   res.setHeader('Content-Type', 'audio/mpeg');

//   got.stream(AUDIO_PATH).pipe(res);
  

// });

// ------------DZIALAAAAAAAAAA---------------------------------------------------------------------


// List of audio URLs to stream
const audioUrls = [
  `https://rr1---sn-4g5e6nss.googlevideo.com/videoplayback?expire=1731866883&ei=o9w5Z_6EEsGI6dsPpLCxqQQ&ip=46.45.68.184&id=o-AG8IV8J100HWDZPvi4scnrWCNeSvbc_rmYEYHy5VH_iP&itag=251&source=youtube&requiressl=yes&xpc=EgVo2aDSNQ%3D%3D&spc=qtApAdmwOEcrj-3QzWlEz2ggwAH00WojoafLuTmuE-qpzUo&vprv=1&svpuc=1&mime=audio%2Fwebm&rqh=1&gir=yes&clen=85205&dur=7.201&lmt=1724833840146629&keepalive=yes&fexp=24350590,24350675,24350705,24350737,51299154,51312688,51326932,51347747&c=IOS&txp=5432434&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cxpc%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Crqh%2Cgir%2Cclen%2Cdur%2Clmt&sig=AJfQdSswRgIhANP_laLEMlkRuwTBTrIIJgXyx0H-fKNpv0nDJG-3PMneAiEAjLTUkDz8WaMAczKTtHKaN2jEuB2L4cspIaB4x8_ptk0%3D&cm2rm=sn-u2oxu-f5fe67z,sn-f5fe67l&rrc=80,80&req_id=27477c83ce6ca3ee&redirect_counter=2&cms_redirect=yes&cmsv=e&met=1731845300,&mh=XY&mm=34&mn=sn-4g5e6nss&ms=ltu&mt=1731845080&mv=m&mvi=1&pl=22&rms=ltu,au&lsparams=met,mh,mm,mn,ms,mv,mvi,pl,rms&lsig=AGluJ3MwRAIgUemeFyD4YDPH58mBoz8VeAjYHMjroGq-4rPKtl2589cCIAuNvBONnNDCRpiy2DAVDGmW89hs4bJIdTRHr632Dmgc`,
  `https://rr3---sn-u2oxu-f5fey.googlevideo.com/videoplayback?expire=1731866656&ei=wNs5Z5KAJJq16dsPyJSygQU&ip=46.45.68.184&id=o-ADBm5wrpHMVY5QzkAPg4fFlEdMFDsQwR_pzKoYoezPEr&itag=251&source=youtube&requiressl=yes&xpc=EgVo2aDSNQ%3D%3D&met=1731845056%2C&mh=Mh&mm=31%2C26&mn=sn-u2oxu-f5fey%2Csn-4g5e6ns6&ms=au%2Conr&mv=m&mvi=3&pl=22&rms=au%2Cau&gcr=pl&initcwndbps=2378750&spc=qtApAf3GG8_6dO3tf_nnPiObU6PVkWn_-0teMh0yzvVH26Q&vprv=1&svpuc=1&mime=audio%2Fwebm&rqh=1&gir=yes&clen=1757865&dur=82.581&lmt=1714618968065513&mt=1731844622&fvip=3&keepalive=yes&fexp=51299154%2C51312688%2C51326932&c=IOS&txp=1318224&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cxpc%2Cgcr%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Crqh%2Cgir%2Cclen%2Cdur%2Clmt&sig=AJfQdSswRQIgMltaLNEb8nXomnclZc4txgjq5xSH0_v2aCbx7awr1nQCIQCoAX57lWoJqF7kv7o2_7SFkk5-hngimO5hidoHF_wWYQ%3D%3D&lsparams=met%2Cmh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Crms%2Cinitcwndbps&lsig=AGluJ3MwRQIgIV5PfAn2aEhy1SiSgw6dicPNzJZ3WK1MA8MUd3HnTN8CIQDE429rL4LfP99WSABEZ6gSvH5R4d10sf-4cRQip1J2pg%3D%3D`,
  `https://rr5---sn-u2oxu-f5fer.googlevideo.com/videoplayback?expire=1731862270&ei=nso5Z4KvGYPHi9oPw6PqoQI&ip=46.45.68.184&id=o-ACzjf1mJz9wjS1vLN4ItlpMGQz7fIXnAYw3QCKEAVbSI&itag=251&source=youtube&requiressl=yes&xpc=EgVo2aDSNQ%3D%3D&met=1731840670%2C&mh=9H&mm=31%2C26&mn=sn-u2oxu-f5fer%2Csn-4g5lznl6&ms=au%2Conr&mv=m&mvi=5&pl=22&rms=au%2Cau&initcwndbps=1956250&spc=qtApAV5yN7s3uo3NI5YbNfpP1zucU5GAbrBRgaLzft5Rwjo&vprv=1&svpuc=1&mime=audio%2Fwebm&rqh=1&gir=yes&clen=1740251&dur=121.181&lmt=1727539297339101&mt=1731840308&fvip=4&keepalive=yes&fexp=51299154%2C51312688%2C51326932&c=IOS&txp=5532434&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cxpc%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Crqh%2Cgir%2Cclen%2Cdur%2Clmt&sig=AJfQdSswRAIgdf67D8gXWoYMAIa_WawgQb7qUrejMmWQH3KPi3GUb_wCIGnUIp-Y-QyDDN3a3n-_YBzTeWeo6k6AQLfonuGFzEo4&lsparams=met%2Cmh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Crms%2Cinitcwndbps&lsig=AGluJ3MwRQIhAJKdak-uHZrenoFFPGDA7P1ItOn0V3FAdbF7hdRamx8xAiAdVsVL1cySzpIkg2jWhVBZ9gLpYxN28XOZfSRNwzy80w%3D%3D`
];
let currentIndex = 0;

// Function to stream audio to the client
const streamAudio = (res) => {
  const audioUrl = audioUrls[currentIndex];

  // Create an FFmpeg command to handle audio streaming
  const audioStream = ffmpeg(audioUrl)
    .audioCodec('libmp3lame')
    .format('mp3')
    .on('end', () => {
      // Move to the next track after the current one finishes
      currentIndex = (currentIndex + 1) % audioUrls.length;
      streamAudio(res); // Recursively stream the next track
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err);
      res.end(); // End the response on error
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
};

app.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'audio/mpeg');
  streamAudio(res);
});

//----------------------------------------------------------------------------------------


// ----WEBSOCKET----
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
// ----------------

app.get("/", (req,res)=>{
  res.sendFile("index.html",{root: '.'})
})

// app.get("/src.mp3", async (req,res)=>{
//   getAudioStreamURL('https://youtu.be/SFMEy7t53cU?si=_VJWRvfuSQK1fsSY')
//   res.writeHead(200,"OK",{"Content-Type":"audio/mpeg"})

//   const updateHandler = () =>{ getpacket(req,res) }
//   eventEmitter.on("update", updateHandler) // On update event, send another packet

//   req.socket.on("close",()=>{
//     eventEmitter.removeListener("update",updateHandler)
//     console.log("Client ${req.socket.remoteAddress} disconected from server")
//   })
// })

// app.get("/broadcast", (req, res) => {
//   // Fetch the current "playing" URL from the queue
//   db.get(`SELECT * FROM queue WHERE status = 'playing' ORDER BY id LIMIT 1`, (err, item) => {
//     if (err || !item) {
//       console.error('Error fetching current playing item:', err || 'No item found');
//       res.writeHead(404);
//       res.end('No audio currently playing');
//       return;
//     }

//     res.writeHead(200, "OK", { "Content-Type": "audio/mpeg" });

//     const updateHandler = () => { getpacket(AUDIO_PATH, req, res); };
//     eventEmitter.on("update", updateHandler);

//     req.socket.on("close", () => {
//       eventEmitter.removeListener("update", updateHandler);
//       console.log(`Client ${req.socket.remoteAddress} disconnected from server`);
//     });
//   });
// });



// Route to get audio stream URL from YouTube
app.post('/download-audio', async (req, res) => {
    console.log('body:', req.body)
    const { url } = req.body;
    getAudioStreamURL(url).then(({ title, audioUrl }) =>{
      res.json({ title: title, url: audioUrl })
    });
});


// Function to get the best audio stream URL using yt-dlp
const getAudioStreamURL = (url) => {
  return new Promise((resolve, reject) => {
    const ytDlpProcess = spawn('yt-dlp', [
      url, 
      '-f', 'bestaudio',   // Get the best audio format
      '-g',                // Get the direct audio URL
      '--print', 'title'   // Print the video title
    ]);

    let audioUrl = '';
    let videoTitle = '';


    ytDlpProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      // console.log(`output: ${output} END.`);
      videoTitle = output.split('\n')[0];
      audioUrl = output.split('\n')[1];
      // console.log(`0: ${videoTitle}`)
      // console.log(`1: ${audioUrl}`)
    });

    ytDlpProcess.stderr.on('data', (data) => {
      console.error(`yt-dlp error: ${data}`);
    });

    ytDlpProcess.on('close', (code) => {
      if (code === 0) {
        resolve({title: videoTitle, audioUrl: audioUrl}); // Resolve with the URL
      } else {
        reject(new Error(`yt-dlp process exited with code ${code}`));
      }
    });
  });
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

    processTitle(this.lastID); // process title for the new db entry
    processQueue(); // trigger queue processing
  });
});

// Skip the Current Song
app.post('/queue/skip', (req, res) => {
  if (clients.length > 0) {
    clients.forEach((client) => client.end()); // End the current broadcast for all clients
  }
  res.json({ message: 'Song skipped' });
});

// Clear Queue
app.post('/queue/clear', (req, res) => {
  db.run(`DELETE FROM queue`, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to clear the queue' });
    res.json({ message: 'Queue cleared' });
  });
});

const processQueue = () => {
  db.get(`SELECT * FROM queue WHERE status = 'playing' ORDER BY id LIMIT 1`, (err, item) => {
    if (err) {
      console.error('Error accessing queue:', err);
      console.log('Retrying...');
      setTimeout(processQueue, 5000); // Retry after delay on error
      return;
    }
    if (!item) {
      processNextFromQueue();
    }
  });
}

const processNextFromQueue = () => {
  // Find the first pending item in the queue
  db.get(`SELECT * FROM queue WHERE status = 'pending' ORDER BY id LIMIT 1`, (err, item) => {
    if (err) {
      console.error('Error accessing queue:', err);
      console.log('Retrying...');
      setTimeout(processQueue, 5000); // Retry after delay on error
      return;
    }
    if (!item) {
      console.log('Queue is empty. Waiting for new songs...');
      // setTimeout(processQueue, 5000); // Check again after 5 seconds
      return;
    }

    // Mark it as processing
    db.run(`UPDATE queue SET status = 'processing' WHERE id = ?`, [item.id]);

    // Run yt-dlp to get the audio URL
    getAudioStreamURL(item.url).then(({ title, audioUrl })=> {
      // if (error) {
      //   console.error(`Error processing ${title}, ${item.url}:`, error);
      //   db.run(`UPDATE queue SET status = 'error', audioUrl = NULL WHERE id = ?`, [item.id]);
      // } else {
        db.run(`UPDATE queue SET status = 'playing', audioUrl = ? WHERE id = ?`, [audioUrl, item.id]);
        
      // }
    });
  });
};

// --------------------------------


const processTitle = (id, ws) =>{
  db.get(`SELECT * FROM queue WHERE id = ? ORDER BY id LIMIT 1`, [id], (err, item) => {
    if (err) {
      console.error(`DB error trying to find row with ID=${id}`, err);
      return;
    }
    if (!item) {
      console.error(`No item found with ID=${id}`);
      return;
    }

    getAudioStreamURL(item.url).then(({ title, audioUrl }) =>{
      if(title != '' && title != null){
          if(title.startsWith('https://')){
            processTitle(id, ws);
            return;
          }
          db.run(`UPDATE queue SET title = ? WHERE id = ?`, [title, id]);
          console.log(`Title for id ${item.id} set.`);

          // Notify all active WebSocket clients
          activeConnections.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send('fetchQueue');
            }
          });

      }
    });
  });
}



server.listen(PORT, () => console.log(`Running server on port ${PORT}`))