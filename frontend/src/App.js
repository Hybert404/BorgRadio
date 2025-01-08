import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { Box, Button, TextField, LinearProgress, Divider, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import InsertLinkIcon from '@mui/icons-material/InsertLink';

const LinearProgressWithLabel = ({ value, currentTime, duration }) => {
  // Format time (seconds) into mm:ss
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box sx={{ width: '100%', mr: 1 }}>
        <LinearProgress variant="determinate" value={value} />
      </Box>
      <Typography variant="body2" color="textSecondary" sx={{ whiteSpace: 'nowrap' }}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </Typography>
    </Box>
  );
};

const MusicPlayer = () => {
  const [url, setUrl] = useState('');
  const [queue, setQueue] = useState([]);
  const [response, setResponse] = useState('');
  const [message, setMessage] = useState('');
  const [audioSrc, setAudioSrc] = useState(''); // State to manage the audio source
  const audioRef = useRef(null); // Reference to the audio player
  const [isUserInteracted, setIsUserInteracted] = useState(false); // Track user interaction
  const [currentSong, setCurrentSong] = useState({
    id: null,
    url: null,
    title: 'Nothing',
    audioUrl: null,
    duration: 0,  // in seconds
    currentTime: 0,
  });

  const pastelink = () => {
    const links = [
      'https://youtu.be/UHAZIuSNdzo?si=iY8KiG6ttnfiNCP2', // Bad Boombox - Borat's Disko
      'https://youtu.be/PHGbHcLtm70?si=yos9IZ3WGXenABXR',
      'https://youtu.be/2Px6mCMpKDM?si=4VCiFolpdP6WBdL9',
      'https://youtu.be/lnu_u1JpQ40?si=kgYC6v8IBHqXcOkP',
      'https://youtu.be/_wpoDkPYxcc?si=FHwVw5Xw91TqJsED',
      'https://youtu.be/IYasp3yh-A0?si=rEbmZaV5xsnQuJkU',
      'https://youtu.be/AgVu0Qx-b6w?si=Jq3P2XyL7Pm6RrBd'
    ];
  
    const randomIndex = Math.floor(Math.random() * links.length);
    setUrl(links[randomIndex]);
  };

  const pasteTest = () => {
    const links = [
      'https://www.youtube.com/watch?v=hROnEjPjukQ', // one
      'https://www.youtube.com/watch?v=8RkcPG_y5X8', // two
      'https://www.youtube.com/watch?v=PA130OATwtc' // three
    ];

    const randomIndex = Math.floor(Math.random() * links.length);
    setUrl(links[randomIndex]);
  };


  // Fetch the current queue from the server
  const fetchQueue = async () => {
    try {
      const response = await axios.get('http://localhost:5000/queue');
      setQueue(response.data);
    } catch (error) {
      console.error('Error fetching queue:', error);
    }
  };

  // Add URL to the queue
  const addToQueue = async () => {
    try {
      await axios.post('http://localhost:5000/queue/add', { url });
      setUrl('');
      fetchQueue();  // Refresh queue after adding
    } catch (error) {
      console.error('Error adding to queue:', error);
    }
  };

  // Clear the entire queue
  const clearQueue = async () => {
    try {
      await axios.post('http://localhost:5000/queue/clear');
      fetchQueue();  // Refresh queue after clearing
    } catch (error) {
      console.error('Error clearing queue:', error);
    }
  };

  // Skip
  const skipQueue = async () => {
    try {
      await axios.post('http://localhost:5000/queue/skip');
      fetchQueue();  // Refresh queue after skipping
    } catch (error) {
      console.error('Error skipping queue:', error);
    }
  };

  const handleUserInteraction = () => {
    setIsUserInteracted(true);
    if (audioRef.current) {
      audioRef.current.play();
    }
  };

  const reloadMusic = () => {
    if (audioRef.current) {
      audioRef.current.load();
      audioRef.current.play()
    }
  };

  useEffect(() => {
    fetchQueue();  // Fetch queue when the component loads

    //websocket
    const ws = new WebSocket('ws://localhost:5000');

    ws.onopen = () => {
      console.log('Connected to server');
      // ws.send('Hello from client');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const now = new Date();
      const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}.${now.getMilliseconds()}`;
      console.log(`[WS] Event: ${data.event}, Message: ${data.message}`);

      switch (data.event) {
        case 'track-ended':
          console.log('The track has ended. Ready for the next track.');
          break;
        
        case 'track-skipped':
          console.log('The track was skipped.');
          if (audioRef.current) {
            audioRef.current.pause();
          }
          break;
        
        case 'refresh':
          fetchQueue();
          break;
        
          case 'play':
            setAudioSrc(data.message); // Update the source (e.g., new song URL or data)
            
            // Assuming `data.message` includes the new song details like title, duration, etc.
            setCurrentSong({
              id: data.message.id,
              url: data.message.url,
              title: data.message.title,
              audiourl: data.message.audioUrl,
              duration: data.message.duration, // Ensure you have the correct fields
              currentTime: 0,  // Starting at the beginning of the new track
            });
      
            if (audioRef.current) {
              audioRef.current.load(); // Reload the audio element to play the new song
            }
      
            // Start updating currentTime with interval
            const intervalId = setInterval(() => {
              setCurrentSong((prevSong) => {
                if (prevSong.currentTime < prevSong.duration) {
                  return { ...prevSong, currentTime: prevSong.currentTime + 1 };
                } else {
                  clearInterval(intervalId); // Clear interval when track ends
                  return prevSong;
                }
              });
            }, 1000);
      
            // Store the interval ID in a ref so we can clear it later if necessary
            audioRef.current.intervalId = intervalId;
            break;      
        
        default:
          console.log('Unhandled event type:', data.event);
          break;
      }
      setResponse(event.data);
    };

    // Cleanup on component unmount
    return () => {
      ws.close();
      console.log('Disconnected from server');
    };
  }, []);

  useEffect(() => {
    audioRef.current.load();
  }, [audioSrc]);
  

  const processUrl = async () => {
    try {
      const response = await axios.post(
        'http://localhost:5000/process',
        { url: url },
        { headers: { 'Content-Type': 'application/json' } } // Ensure the header is set to JSON
      );
      console.log(response.data); // Log the response to see the audio URL
    } catch (error) {
      console.error('Error fetching audio URL:', error);
    }
  };

  const formatDuration = (durationInSeconds) => {
    if (!durationInSeconds) return '00:00';
    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = Math.floor(durationInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const shortenUrl = (url) => {
    const maxLength = 30;
    if (!url) return '';  // Return an empty string if url is null or undefined
    return url.length > maxLength ? `${url.substring(0, maxLength)}...` : url;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSong((prev) => {
        if (prev.currentTime < prev.duration) {
          return { ...prev, currentTime: prev.currentTime + 1 };
        } else {
          clearInterval(interval);
          return prev;
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSong.duration]);

  const progress = (currentSong.currentTime / currentSong.duration) * 100;

  return (
    <TableContainer component={Paper} sx={{ width: '90%', margin: 'auto' }}>
      <h2>Queue Manager</h2>
      
      <Box sx={{ width: '50%', padding: 2, textAlign: 'center', margin: 'auto' }}>
        <Typography variant="h6" sx={{ marginBottom: 1 }}>
          Currently Playing
        </Typography>
        <Typography variant="body1" sx={{ marginBottom: 1 }}>
          {currentSong.title}
        </Typography>

        <LinearProgressWithLabel 
          value={progress} 
          currentTime={currentSong.currentTime} 
          duration={currentSong.duration} 
        />
      </Box>

      <Table sx={{ minWidth: 650, width: '100%' }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>URL</TableCell>
            <TableCell>AudioURL</TableCell>
            <TableCell>Duration</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {queue.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.id}</TableCell>
              <TableCell>{item.title}</TableCell>
              <TableCell>{item.url}</TableCell>
              <TableCell>{shortenUrl(item.audioUrl)}</TableCell>
              <TableCell>{formatDuration(item.duration)}</TableCell>
              <TableCell>{item.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Box sx={{ display: 'flex', gap: 1, marginTop: 2, marginBottom: 2}}>
        <TextField
          variant='outlined'
          size='small'
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter YouTube URL"
        />
        <Button variant='contained' color='primary' onClick={addToQueue} startIcon={<SendIcon />}>Add to Queue</Button>
        <Button variant='contained' color='primary' onClick={skipQueue} startIcon={<SkipNextIcon />}>Skip</Button>
        <Button variant='contained' color='primary' onClick={clearQueue} startIcon={<DeleteIcon />}>Clear Queue</Button>
        <Button variant='contained' color='primary' onClick={pasteTest} startIcon={<InsertLinkIcon />}>Paste test link</Button>
      </Box>
      

      <audio controls ref={audioRef}>
         <source src={audioSrc} type="audio/mpeg"/>
          Your browser does not support the audio element.
       </audio>
    </TableContainer>
    // <div style={{width: 1000, margin: "0 auto"}}>
    //   <h2>Queue Manager</h2>
    //   <input
    //     type="text"
    //     value={url}
    //     onChange={(e) => setUrl(e.target.value)}
    //     placeholder="Enter YouTube URL"
    //   />
    //   <button onClick={addToQueue}>Add to Queue</button>
    //   <button onClick={clearQueue}>Clear Queue</button>
    //   <button onClick={skipQueue}>Skip</button>
    //   <br></br>
    //   <button onClick={pastelink}>Paste test link</button>
    //   <button onClick={pasteCount}>1 2 3</button>
    //   <button onClick={processUrl}>Process</button>
    //   <br></br>
    //   <button onClick={testAP}>Test audio player source</button>

    //   <h3>Current Queue</h3>
    //   <ul>
    //     {queue.map((item) => (
    //       <li key={item.id}>
    //         {item.id} {item.title ? `${item.title} - `:''} 
    //         {item.url} - {formatDuration(item.duration)} - {item.status} {item.audioUrl ? <a href={item.audioUrl} target="_blank"><button>Open audio url</button></a> : ''}
    //       </li> 
    //     ))}
    //   </ul>

    //   <h3>Now Playing</h3>
    //   {!isUserInteracted && (
    //     <button onClick={handleUserInteraction}>Start Audio</button>
    //   )}
    //   <button onClick={reloadMusic}>Reload Audio</button>
    //   <audio controls ref={audioRef}>
    //     <source src={audioSrc} type="audio/mpeg"/>
    //     Your browser does not support the audio element.
    //   </audio>
      
    // </div>

    
  );
};

export default MusicPlayer;
