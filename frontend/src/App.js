import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { Box, Button, TextField, LinearProgress, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import InsertLinkIcon from '@mui/icons-material/InsertLink';
import CheckIcon from '@mui/icons-material/Check';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CircularProgress from '@mui/material/CircularProgress';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import QueueIcon from '@mui/icons-material/Queue';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import Fab from '@mui/material/Fab';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import '@fontsource/roboto';
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap"
/>

const LinearProgressWithLabel = ({ currentTime, duration }) => {
  // Format time (seconds) into mm:ss
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const value = (currentTime / duration) * 100;

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


const App = () => {
  const [url, setUrl] = useState('');
  const [queue, setQueue] = useState([]);
  const [audioSrc, setAudioSrc] = useState(''); // State to manage the audio source
  const audioRef = useRef(null); // Reference to the audio player
  const [statuses, setStatuses] = useState({});  // All statuses in one object
  const [currentSong, setCurrentSong] = useState({
    id: null,
    url: null,
    title: 'Nothing',
    audioUrl: null,
    duration: 0,  // in seconds
    currentTime: 0,
  });
  const ws = useRef(null);

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
      console.error('Error fetching queue:', error.response?.data || error.message);
    }
  };

  // Add URL to the queue
  const addToQueue = async () => {
    try {
      await axios.post('http://localhost:5000/queue/add', { url });
      setUrl('');
      fetchQueue();  // Refresh queue after adding
    } catch (error) {
      console.error('Error adding to queue:', error.response?.data || error.message);
    }
  };

  // Clear the entire queue
  const clearQueue = async () => {
    try {
      await axios.post('http://localhost:5000/queue/clear');
      fetchQueue();  // Refresh queue after clearing
    } catch (error) {
      console.error('Error clearing queue:', error.response?.data || error.message);
    }
  };

  // Skip
  const skipQueue = async () => {
    try {
      await axios.post('http://localhost:5000/queue/skip');
      fetchQueue();  // Refresh queue after skipping
    } catch (error) {
      console.error('Error skipping queue:', error.response?.data || error.message);
    }
  };

  useEffect(() => {
    fetchQueue();  // Fetch queue when the component loads
  
    // WebSocket setup
    ws.current = new WebSocket('ws://localhost:5000');
  
    ws.current.onopen = () => {
      console.log('Connected to server');
    };
  
    ws.current.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);  // Parse incoming message
        console.log(`[WS] Event: ${data.event}, Message: ${data.message}`);
      } catch (e) {
        console.error('Failed to parse event data:', event.data);
        return;  // Exit if data is invalid
      }
  
      let msg;
      try {
        msg = typeof data.message === 'string' ? JSON.parse(data.message) : data.message;
      } catch (e) {
        console.error('Invalid JSON in message:', data.message);
        msg = null;
      }
  
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
          if (audioRef.current) {
            audioRef.current.pause();
            if (audioRef.current.intervalId) {
              clearInterval(audioRef.current.intervalId);
            }
  
            setAudioSrc(msg.audioUrl);
            setCurrentSong({
              id: msg.id,
              url: msg.url,
              title: msg.title,
              audiourl: msg.audioUrl,
              duration: msg.duration,
              currentTime: 0,
            });
  
            const handleLoadedData = () => {
              audioRef.current.play().catch((err) => {
                console.error("Error playing audio:", err);
              });
            };
  
            audioRef.current.addEventListener('loadeddata', handleLoadedData);
  
            audioRef.current.onended = () => {
              clearInterval(audioRef.current.intervalId);
              audioRef.current.removeEventListener('loadeddata', handleLoadedData);
            };
  
            audioRef.current.load();
          }
          break;

          case 'statusUpdate':
            setStatuses(data.message); // Update all statuses
            break;
        // case 'params':
        //   setLoopQueue(msg.loopQueue);
        //   setRandomizeQueue(msg.randomizeQueue)
        //   setIsPlaying(msg.status)
        //   setInitialStatusReceived(true);
        //   break;
  
        default:
          console.log('Unhandled event type:', data.event);
          break;
      }
    };
  
    // Cleanup
    return () => {
      if (ws.current) {
        ws.current.close();
        console.log('Disconnected from server');
      }
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
    const maxLength = 55;
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

  const progress = currentSong.duration > 0 
  ? (currentSong.currentTime / currentSong.duration) * 100 
  : 100;

  // const handleTogglePlayPause = async () => {
  //   setIsPlaying(!isPlaying);
  // };

  useEffect(() => {

    if(statuses.playState === 'play'){
      try {
        async function resume(){
          await axios.post('http://localhost:5000/queue/resume');
        }
        resume(); //obejście problemu asynca
        
        fetchQueue();  // Refresh queue after clearing
      } catch (error) {
        console.error('Error resuming track:', error);
      }
    }else if (statuses.playState === 'pause'){
      try {
        async function pause(){
          await axios.post('http://localhost:5000/queue/pause');
        }
        pause(); //obejście problemu asynca

        fetchQueue();  // Refresh queue after clearing
      } catch (error) {
        console.error('Error pausing track:', error);
      }
    }

  }, [statuses]);

  const handleDelete = async (id) => {
    setQueue((prevQueue) => prevQueue.filter(item => item.id !== id));
    try {
      await axios.post('http://localhost:5000/queue/remove', {id});
      fetchQueue();  // Refresh queue after clearing
    } catch (error) {
      console.error('Error clearing queue:', error);
    }
  };
  
  const handlePlay = (id) => {
    const songToPlay = queue.find(item => item.id === id);
    if (songToPlay) {
      // TODO
    }
  };

  const handleCheckboxChange = (event) => {
    const { name, checked } = event.target;
    const updatedStatus = { [name]: checked };
    setStatuses((prev) => ({ ...prev, ...updatedStatus })); // Update local state
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'statusUpdate', status: updatedStatus }));
    }
  };

  const togglePlayPause = () => {
    const newPlayState = statuses.playState === 'play' ? 'pause' : 'play';
    const updatedStatus = { playState: newPlayState };
    setStatuses((prev) => ({ ...prev, ...updatedStatus })); // Update locally
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'statusUpdate', status: updatedStatus }));
    }
  };

  const statusKeys = Object.keys(statuses).filter((key) => key !== 'playState'); // Exclude button from checkbox loop

  // const loopQueueChange = (event) => {
  //   if (initialStatusReceived) {
  //     const checked = event.target.checked;
  //     setLoopQueue(checked);  // Update state optimistically
  //   }
  // };

  // const randomizeQueueChange = (event) => {
  //   if (initialStatusReceived) {
  //     const checked = event.target.checked;
  //     setRandomizeQueue(checked);  // Update state optimistically
  //   }
  // };

  // useEffect(() => {
  //   if (initialStatusReceived && ws.current && ws.current.readyState === WebSocket.OPEN) {
  //     ws.current.send(JSON.stringify({
  //       type: 'params',
  //       message: {
  //         'loopQueue': loopQueue,
  //         'randomizeQueue': randomizeQueue
  //       }
  //     }));
  //   }
  // }, [loopQueue, randomizeQueue]);
  

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'left' }}>
      <Box sx={{ id: 'left-panel', display: 'inline', width: '30%', marginTop: '20px', p:4}}>
        <Box sx={{id: 'control-buttons',  gap: 1, marginTop: 2, marginBottom: 2}}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              variant='outlined'
              size='small'
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter YouTube URL"
              sx={{ flex: 1 }}
            />
            <Button key='add_to_queue' variant='contained' color='primary' onClick={addToQueue} startIcon={<QueueIcon />}>Add to Queue</Button>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', marginTop: 2}}>
            <Button variant='contained' color='error' onClick={clearQueue} startIcon={<DeleteIcon />}>Clear Queue</Button>
            <Button variant='contained' color='primary' onClick={pasteTest} startIcon={<InsertLinkIcon />}>Paste test link</Button>
            {statusKeys.map((key) => (
              <FormControlLabel control={<Checkbox checked={statuses[key]} onChange={handleCheckboxChange} name={key} />} label={key} />
            ))}
          </Box>
          {/* <Button variant='contained' color='primary' onClick={skipQueue} startIcon={<SkipNextIcon />}>Skip</Button> */}
          
        </Box>

        <Box component={Paper} sx={{ backgroundColor: '#F7F7F7', padding: 2, textAlign: 'center', borderRadius: 5}}>
          <Typography variant="h6" sx={{ marginBottom: 1 }}>
            Currently Playing
          </Typography>
          <Typography variant="body1" sx={{ marginBottom: 1 }}>
            {currentSong.title}
          </Typography>

          <Box>
            <Fab 
              aria-label="previous" 
              onClick={null}
              size="small"
            >
              <SkipPreviousIcon fontSize="small" />
            </Fab>
            <Fab 
              color="primary" 
              aria-label={statuses.playState === 'play' ? 'pause' : 'play'} 
              onClick={togglePlayPause}
              sx={{ margin: 1 }}
              size="big"
            >
              {statuses.playState === 'play' ? <PauseIcon /> : <PlayArrowIcon />}
            </Fab>
            <Fab 
              aria-label="skip" 
              onClick={skipQueue}
              size="small"
            >
              <SkipNextIcon fontSize="small" />
            </Fab>
          </Box>

          <LinearProgressWithLabel 
            value={progress} 
            currentTime={currentSong.currentTime} 
            duration={currentSong.duration} 
          />
        </Box>
      </Box>
      
      <TableContainer component={Paper} sx={{id: 'right-panel',  width: '70%', margin: 'auto', marginTop: '20px', borderRadius: 5, p:3, fontFamily: 'Roboto', height: '85vh', overflowY: 'scroll'}}>
      <h2>Queue</h2>
      <Table sx={{ minWidth: 650, width: '100%' }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>URL</TableCell>
            <TableCell>AudioURL</TableCell>
            <TableCell>Duration</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Control</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {queue.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.id}</TableCell>
              <TableCell>{item.title}</TableCell>
              <TableCell>{item.url}</TableCell>
              <TableCell>
                {typeof item.audioUrl === 'string' && item.audioUrl.startsWith('https:') ? (
                  <CheckIcon color="success" />
                ) : item.audioUrl ? (
                  item.audioUrl
                ) : isNaN ? (
                  <CloseIcon color="warning"></CloseIcon>
                ): (
                  <Typography color="error">Error</Typography>
                )}
              </TableCell>
              <TableCell>{formatDuration(item.duration)}</TableCell>
              <TableCell>
                {item.status === 'processing' ? (
                  <CircularProgress size={24} />
                ) : item.status === 'processed' ? (
                  <CheckIcon color="success" />
                ) : item.status === 'finished' ? (
                  <DoneAllIcon color="success" />
                ) : item.status === 'paused' ? (
                  <PauseIcon color="primary" />
                ) : item.status === 'playing' ? (
                  <PlayCircleIcon color="primary" />
                ) : (
                  item.status
                )}
              </TableCell>
              <TableCell>
              <IconButton aria-label="delete" size="small" onClick={() => handleDelete(item.id)}>
                <DeleteIcon />
              </IconButton>
              <IconButton color="success" size="small" onClick={() => handlePlay(item.id)}>
                <PlayArrowIcon />
              </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      

      <audio controls ref={audioRef}>
         <source src={audioSrc} type="audio/mpeg"/>
          Your browser does not support the audio element.
       </audio>
      </TableContainer>
    </Box>
    
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

export default App;
