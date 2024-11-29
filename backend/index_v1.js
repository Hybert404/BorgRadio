const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const { exec } = require('child_process'); // Import exec
const ffmpeg = require('fluent-ffmpeg');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = process.env.PORT || 5000;

const ytDlpPath = 'D:\\Hubert\\yt-dlp-POBRANE\\yt-dlp.exe';
const db = new sqlite3.Database('./queue.db');

app.use(cors());  // Ensure CORS is set up
app.use(express.json());

const clients = [];

// Create queue table if it doesn't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    audioUrl TEXT
  )`);
});

// Add URL to Queue and trigger processing if not currently playing
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
    
    // Trigger queue processing
    processQueue();
  });
});



// Broadcast
const startBroadcast = () => {
  const ffmpegStream = ffmpeg()
    .input('anullsrc=r=44100:cl=stereo') // Generate silent audio with specific parameters
    .inputOptions(['-f', 'lavfi', '-re']) // Separate `-f` and `lavfi`
    .audioCodec('libmp3lame')
    .format('mp3')
    .on('error', (err) => console.error('FFmpeg error:', err))
    .on('end', () => console.log('FFmpeg stream ended'));

  // Process queue as before
  const playNextSong = () => {
    db.get(`SELECT * FROM queue WHERE status = 'pending' ORDER BY id LIMIT 1`, (err, song) => {
      if (err || !song) {
        console.log('Queue is empty or an error occurred');
        setTimeout(playNextSong, 5000); // Retry after 5 seconds if queue is empty
        return;
      }

      db.run(`UPDATE queue SET status = 'processing' WHERE id = ?`, [song.id]);

      exec(`"${ytDlpPath}" -f bestaudio -g "${song.url}"`, (error, stdout) => {
        if (error) {
          console.error(`Error processing ${song.url}:`, error);
          db.run(`UPDATE queue SET status = 'error' WHERE id = ?`, [song.id]);
          playNextSong();
          return;
        }

        const audioUrl = stdout.trim();
        db.run(`UPDATE queue SET status = 'processed', audioUrl = ? WHERE id = ?`, [audioUrl, song.id]);

        ffmpegStream.input(audioUrl); // Add the audio URL to FFmpeg for playback

        // Remove the played song from the queue
        db.run(`DELETE FROM queue WHERE id = ?`, [song.id], (err) => {
          if (err) console.error('Failed to delete song:', err);
          playNextSong(); // Play the next song after this one ends
        });
      });
    });
  };

  playNextSong();

  return ffmpegStream;
};

// Initialize the broadcast stream
const ffmpegStream = startBroadcast();




// Broadcast Endpoint
const connections = [];

// Endpoint for clients to connect to the broadcast stream
app.get('/broadcast', (req, res) => {
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Connection', 'keep-alive');

  connections.push(res);

  // Remove client on disconnect
  req.on('close', () => {
    const index = connections.indexOf(res);
    if (index !== -1) connections.splice(index, 1);
  });
});


// Continuously pipe the ffmpegStream to all connected clients
ffmpegStream.pipe({
  write(chunk) {
    clients.forEach((res) => res.write(chunk));
  },
  end() {
    clients.forEach((res) => res.end());
  },
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


const processQueue = () => {
  // Find the first pending item in the queue
  db.get(`SELECT * FROM queue WHERE status = 'pending' ORDER BY id LIMIT 1`, (err, item) => {
    if (err) {
      console.error('Error accessing queue:', err);
      setTimeout(processQueue, 5000); // Retry after delay on error
      return;
    }

    if (!item) {
      console.log('Queue is empty. Waiting for new songs...');
      setTimeout(processQueue, 5000); // Check again after 5 seconds
      return;
    }

    // Mark it as processing
    db.run(`UPDATE queue SET status = 'processing' WHERE id = ?`, [item.id]);

    // Run yt-dlp to get the audio URL
    exec(`"${ytDlpPath}" -f bestaudio -g "${item.url}"`, (error, stdout) => {
      if (error) {
        console.error(`Error processing ${item.url}:`, error);
        db.run(`UPDATE queue SET status = 'error', audioUrl = NULL WHERE id = ?`, [item.id]);
      } else {
        const audioUrl = stdout.trim();
        db.run(`UPDATE queue SET status = 'processed', audioUrl = ? WHERE id = ?`, [audioUrl, item.id]);
        
        // Play the audio file in the broadcast
        playAudio(audioUrl);
      }
      
      // Process the next item in the queue after the current song finishes
      setTimeout(processQueue, 5000); // Adjust delay as needed
    });
  });
};

const playAudio = (audioUrl) => {
  const ffmpegProcess = ffmpeg(audioUrl)
    .inputOptions(
      '-f', 'mp3',
      '-reconnect', '1',                 // Enable reconnection
      '-reconnect_streamed', '1',         // Reconnect for HTTP/HTTPS
      '-reconnect_delay_max', '2'         // Delay before reconnection
    )
    .audioCodec('libmp3lame')             // Set audio codec
    .audioBitrate('192k')                 // Set bitrate
    .audioChannels(2)                     // Stereo output
    .audioFrequency(44100)                // Sample rate
    .format('mp3')                        // Output format as MP3

    .on('start', () => {
      console.log('FFmpeg process started');
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err);
    })
    .on('end', () => {
      console.log('FFmpeg process ended');
    });

  ffmpegProcess.pipe()
    .on('data', (chunk) => {
      connections.forEach((client) => client.write(chunk));  // Broadcast to clients
    })
    .on('error', (err) => {
      console.error('Streaming error:', err);
    });

  ffmpegProcess.run();
};






  
// Endpoint to manually trigger queue processing
app.post('/queue/process', (req, res) => {
    processQueue();
    res.json({ message: 'Queue processing started' });
});

// Skip a Link
// app.post('/queue/skip', (req, res) => {
//     // Find the first 'pending' or 'processing' item and mark it as skipped
//     db.get(`SELECT * FROM queue WHERE status IN ('pending', 'processing') ORDER BY id LIMIT 1`, (err, item) => {
//       if (err || !item) {
//         return res.status(404).json({ message: 'No item to skip' });
//       }
  
//       db.run(`UPDATE queue SET status = 'skipped' WHERE id = ?`, [item.id], (updateErr) => {
//         if (updateErr) {
//           return res.status(500).json({ error: 'Failed to skip item' });
//         }
  
//         // Immediately start processing the next item
//         processQueue();
//         res.json({ message: 'Item skipped', id: item.id });
//       });
//     });
// });

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


// let currentlyPlayingAudioUrl = null;  // Store the audio URL of the current item being played
// Serve the currently playing audio
// app.get('/play-audio', (req, res) => {
//   if (!currentlyPlayingAudioUrl) {
//       return res.status(404).json({ error: 'No audio currently playing' });
//   }

//   // Stream audio from the audio URL
//   res.redirect(currentlyPlayingAudioUrl);
// });

  
  
  

// // Route to get audio stream URL from YouTube
// app.post('/download-audio', (req, res) => {
//     console.log('body:', req.body)
//     const { url } = req.body;

//     if (!url) {
//         return res.status(400).json({ error: 'YouTube URL is required' });
//     }

//     // Spawn a yt-dlp process to extract audio
//     const ytDlp = spawn(ytDlpPath, ['-f', 'bestaudio', '-g', url]);

//     ytDlp.stdout.on('data', (data) => {
//         const audioUrl = data.toString().trim();
//         res.json({ audioUrl });
//     });

//     ytDlp.stderr.on('data', (data) => {
//         console.error(`yt-dlp error: ${data}`);
//         res.status(500).json({ error: 'Failed to fetch audio URL' });
//     });
// });

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startBroadcast(); 
});
