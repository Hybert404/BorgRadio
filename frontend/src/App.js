import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

// Custom functions
import useSnackbar from './additional functions/snackbar';

// Material-UI Components
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Button,
  TextField,
  LinearProgress,
  Typography,
  Chip,
  Autocomplete,
  FormControlLabel,
  Checkbox,
  Stack,
  Slider,
  IconButton,
  Fab,
  CircularProgress,
  Snackbar,
  Alert,
  Tooltip,
} from '@mui/material';

// Material-UI Icons
import DeleteIcon from '@mui/icons-material/Delete';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import InsertLinkIcon from '@mui/icons-material/InsertLink';
import CheckIcon from '@mui/icons-material/Check';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import QueueIcon from '@mui/icons-material/Queue';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import CloseIcon from '@mui/icons-material/Close';
import UpdateIcon from '@mui/icons-material/Update';
import VolumeDown from '@mui/icons-material/VolumeDown';
import VolumeUp from '@mui/icons-material/VolumeUp';

import { MuiColorInput } from 'mui-color-input';

// Fonts
import '@fontsource/roboto';

// External CSS or Links
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

const LoginPopup = ({ onClose, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
      try {
          const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/login`, { username, password });
          localStorage.setItem('token', response.data.token); // Save the token in localStorage
          onLogin({ username }); // Pass the logged-in user's data to the parent component
      } catch (err) {
          setError(err.response?.data?.error || 'Something went wrong');
      }
  };

  return (
      <Box className="popup">
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', marginTop: 2}}>
              <TextField
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
              />
              <TextField
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
              />
              <Button variant='contained' onClick={handleLogin}>Login</Button>
              {error && <p style={{ color: 'red' }}>{error}</p>}
          </Box>
      </Box>
  );
};

const TagColorChanger = ({ tagColors, onColorChange }) => {
  const [selectedTag, setSelectedTag] = useState(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [newTagName, setNewTagName] = useState('');

  const handleTagSelect = (tag) => {
    setSelectedTag(tag);
    setSelectedColor(tagColors[tag]);
  };

  const handleColorChange = (color) => {
    setSelectedColor(color);
  };

  const handleSave = async () => {
    if (selectedTag && selectedColor) {
      try {
        const token = localStorage.getItem('token');
        await axios.post(`${process.env.REACT_APP_API_URL}/queue/tags/color`, 
          { 
            tag: selectedTag, 
            color: selectedColor 
          },
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        onColorChange();
      } catch (error) {
        console.error('Error updating tag color:', error);
      }
    }
  };

  const handleAddTag = async () => {
    if (newTagName.trim()) {
      try {
        const token = localStorage.getItem('token');
        await axios.post(`${process.env.REACT_APP_API_URL}/queue/tags/add`,
          {
            tag: newTagName.trim().toLowerCase(),
            color: '#CCCCCC' // Default color
          },
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        setNewTagName('');
        onColorChange();
      } catch (error) {
        console.error('Error adding tag:', error);
      }
    }
  };

  const handleRemoveTag = async (tagToRemove) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${process.env.REACT_APP_API_URL}/queue/tags/remove`,
        {
          tag: tagToRemove
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      if (selectedTag === tagToRemove) {
        setSelectedTag(null);
        setSelectedColor('');
      }
      onColorChange();
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Tag Color Manager</Typography>
      
      {/* Add new tag section */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
        <TextField
          size="small"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="New tag name"
        />
        <Button 
          variant="contained" 
          onClick={handleAddTag}
          disabled={!newTagName.trim()}
        >
          Add Tag
        </Button>
      </Box>

      {/* Tag list */}
      <Box className="tagList" sx={{ mb: 2 }}>
        {Object.keys(tagColors).map((tag, index) => (
          <Chip
            key={index}
            label={tag}
            size="small"
            onDelete={() => handleRemoveTag(tag)}
            sx={{
              backgroundColor: tag === selectedTag ? 'white' : tagColors[tag],
              border: tag === selectedTag ? `4px solid ${tagColors[tag]}` : 'none',
              boxShadow: tag === selectedTag ? 3 : 0,
              transform: tag === selectedTag ? 'scale(1.2)' : 'scale(1)',
              transition: 'all 0.2s ease-in-out',
              margin: '4px'
            }}
            onClick={() => handleTagSelect(tag)}
          />
        ))}
      </Box>

      {/* Color picker */}
      {selectedTag && (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <MuiColorInput
            value={selectedColor}
            onChange={handleColorChange}
            format="hex"
          />
          <Button 
            variant="contained" 
            onClick={handleSave}
            disabled={!selectedColor}
          >
            Save Color
          </Button>
        </Box>
      )}
    </Box>
  );
};


const App = () => {
  const { state, showSnackbar, handleClose } = useSnackbar();
  const [url, setUrl] = useState('');
  const [queue, setQueue] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagColors, setTagColors] = useState({});
  const [audioSrc, setAudioSrc] = useState(''); // State to manage the audio source
  const audioRef = useRef(null); // Reference to the audio player
  const [statuses, setStatuses] = useState({
    // loopQueue: false,
    randomizeQueue: false,
    playState: 'pause',
    filters: []  // Initialize empty Set
  });
  const [currentSong, setCurrentSong] = useState({
    id: null,
    url: null,
    title: 'Nothing',
    audioUrl: null,
    duration: 0,  // in seconds
    currentTime: 0,
  });
  const ws = useRef(null);
  const intervalRef = useRef(null);  // Use ref to store the interval ID
  const [volume, setVolume] = useState(70); // volume slider
  const [showPopup, setShowPopup] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null); // Tracks logged-in user info
  const [urlHelperText, setUrlHelperText] = useState(''); // Helper text for the URL input

  useEffect(() => {
    // Check if token exists in localStorage
    const token = localStorage.getItem('token');
    if (token) {
        // Fetch user info from the backend
        axios
            .get(`${process.env.REACT_APP_API_URL}/api/userinfo`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            .then((response) => {
                setLoggedInUser(response.data); // Update the user info
            })
            .catch(() => {
                localStorage.removeItem('token'); // Remove invalid token
            });
    }
  }, []);

  const handleLogout = () => {
    setLoggedInUser(null); // Clear the user info on logout
    localStorage.removeItem('token'); // Optionally clear token
  };

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
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/queue`);

      // Ensure queue is an array
      const queueData = Array.isArray(response.data) ? response.data : [];

      setQueue(queueData);
    } catch (error) {
      setQueue([]); // Set empty array on error
      showSnackbar('Error connecting to server', 5000);
      console.error('Error fetching queue:', error.response?.data || error.message);
    }
  };

  // Fetch all tags
  const fetchTags = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/queue/tags`);

      setTagColors(response.data);  // Set the tag colors

      // Convert the { tag: color } object into an array of tags
      const tagsArray = Object.keys(response.data);

      setAvailableTags(tagsArray);
    } catch (error) {
      console.error('Error fetching tags:', error.response?.data || error.message);
    }
  };

  // Add URL to the queue
  const addToQueue = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_API_URL}/queue/add`,
        { url, tags: selectedTags }, // Request body
        {
            headers: {
                Authorization: `Bearer ${token}`, // Add token to the Authorization header
            },
        }
      );
      setUrl('');
      setSelectedTags([]);
      fetchQueue();  // Refresh queue after adding
    } catch (error) {
      // console.error('Error adding to queue:', error.response?.data || error.message);
      setUrlHelperText('Invalid URL');
    }
  };

  // Clear the entire queue
  const clearQueue = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_API_URL}/queue/clear`,
        {}, // Empty object as body
        {
          headers: {
            Authorization: `Bearer ${token}` // Headers go in the config object
          }
        }
      );
      fetchQueue();  // Refresh queue after clearing
    } catch (error) {
      console.error('Error clearing queue:', error.response?.data || error.message);
    }
  };

  // Skip
  const skipQueue = async () => {
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/queue/skip`);
      fetchQueue();  // Refresh queue after skipping
    } catch (error) {
      console.error('Error skipping queue:', error.response?.data || error.message);
    }
  };

  useEffect(() => {
    fetchQueue();  // Fetch queue when the component loads
    fetchTags();  // Fetch tags when the component loads
  
    // WebSocket setup
    ws.current = new WebSocket(process.env.REACT_APP_WS_URL);
  
    ws.current.onopen = () => {
      console.log('Connected to server');
    };
  
    ws.current.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
        let logMessage = `[WS] Event: ${data.event}`;
        
        // Handle object messages
        if (typeof data.message === 'object' && data.message !== null) {
          logMessage += '\nMessage:';
          Object.entries(data.message).forEach(([key, value]) => {
            logMessage += `\n  ${key}: ${JSON.stringify(value)}`;
          });
        } else {
          logMessage += `, Message: ${data.message}`;
        }
        
        console.log(logMessage);
      } catch (e) {
        console.error('Failed to parse event data:', event.data);
        return;
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
  
        case 'fetch':
          fetchQueue();
          fetchTags();
          break;
  
        case 'play':
          if (audioRef.current) {
            // First pause current playback
            audioRef.current.pause();
            if (audioRef.current.intervalId) {
              clearInterval(audioRef.current.intervalId);
            }
        
            // Create the loadeddata handler
            const handleLoadedData = () => {
              if (msg.startTime) {
                audioRef.current.currentTime = msg.startTime;
              }
              audioRef.current.play().catch((err) => {
                console.error("Error playing audio:", err);
              });
            };
        
            // Add event listener before changing source
            audioRef.current.addEventListener('loadeddata', handleLoadedData, { once: true });
        
            // Update states after setting up listener
            setAudioSrc(msg.audioUrl);
            setCurrentSong({
              id: msg.id,
              url: msg.url,
              title: msg.title,
              audiourl: msg.audioUrl,
              duration: msg.duration,
              currentTime: msg.startTime || 0,
            });
        
            // Load the new audio
            audioRef.current.load();
        
            // Cleanup on track end
            audioRef.current.onended = () => {
              if (audioRef.current.intervalId) {
                clearInterval(audioRef.current.intervalId);
              }
            };
          }
          break;
  
          case 'statusUpdate':
            setStatuses(data.message); // Update all statuses
            break;
  
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

  const formatDuration = (durationInSeconds) => {
    if (!durationInSeconds) return '00:00';
    
    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);
    const seconds = Math.floor(durationInSeconds % 60);
    
    if (hours > 0) {
      return `${hours.toString().padStart(1, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const shortenUrl = (url) => {
    const maxLength = 55;
    if (!url) return '';  // Return an empty string if url is null or undefined
    return url.length > maxLength ? `${url.substring(0, maxLength)}...` : url;
  };

  const progress = currentSong.duration > 0 
  ? (currentSong.currentTime / currentSong.duration) * 100 
  : 100;

  useEffect(() => {

    if(statuses.playState === 'play'){
      try {
        async function resume(){
          await axios.post(`${process.env.REACT_APP_API_URL}/queue/resume`);
        }
        resume(); //obejście problemu asynca
        
        fetchQueue();  // Refresh queue after clearing

        if (!intervalRef.current) {
          intervalRef.current = setInterval(() => {
            setCurrentSong((prev) => {
              if (prev.currentTime < prev.duration) {
                return { ...prev, currentTime: prev.currentTime + 1 };
              } else {
                clearInterval(intervalRef.current);
                intervalRef.current = null;  // Reset ref when finished
                return prev;
              }
            });
          }, 1000);
        }
      } catch (error) {
        console.error('Error resuming track:', error);
      }
    }else if (statuses.playState === 'pause'){
      try {
        // Pause the HTML audio player
        if (audioRef.current) {
          audioRef.current.pause();
        }

        async function pause(){
          try{
            await axios.post(`${process.env.REACT_APP_API_URL}/queue/pause`);
          }catch (error) {
            console.error('Error pausing track:', error);
          }
          
        }
        pause(); //obejście problemu asynca

        fetchQueue();  // Refresh queue after clearing

        if (intervalRef.current) {
          clearInterval(intervalRef.current);  // Clear the interval on pause
          intervalRef.current = null;
        }

      } catch (error) {
        console.error('Error pausing track:', error);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;  // Cleanup on component unmount
      }
    };

  }, [statuses.playState]);

  const handleDelete = async (id) => {
    setQueue((prevQueue) => prevQueue.filter(item => item.id !== id));
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_API_URL}/queue/remove`,
        { id }, // Request body
        {
            headers: {
                Authorization: `Bearer ${token}`, // Add token to the Authorization header
            },
        }
      );
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

  const handleChange = (event, newValue) => {
    setVolume(newValue)
    //TODO
  };

  const handleTagsChange = (event, value) => {
    // Trim whitespace from each tag and convert to lowercase for comparison
    const trimmedTags = value.map((tag) => tag.trim().toLowerCase());
  
    // Remove duplicate tags
    const uniqueTags = [...new Set(trimmedTags)];
  
    // Update the state with the cleaned and deduplicated tags
    setSelectedTags(uniqueTags);
  };

  const tagColorFind = (tag) => {
    return tagColors[tag] || "#CCCCCC"; // Default to light gray if the tag is not found
  };

  const handleTagFilter = (tag) => {
    const currentFilters = Array.isArray(statuses.filters) ? statuses.filters : [];
    const newFilters = currentFilters.includes(tag)
      ? currentFilters.filter(t => t !== tag)
      : [...currentFilters, tag];
  
    // Update state with new filters
    setStatuses(prev => ({
      ...prev,
      filters: newFilters
    }));
  
    // Send update via WebSocket if connected
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ 
        type: 'statusUpdate', 
        status: {"filters": newFilters} 
      }));
    }
  };

  const filteredQueue = queue.filter(item => {
    // If no filters are set, show all items
    if (!Array.isArray(statuses.filters) || statuses.filters.length === 0) {
      return true;
    }
    // Show items that have at least one matching tag
    return item.tags.some(tag => statuses.filters.includes(tag));
  });

  const statusKeys = Object.keys(statuses).filter((key) => key !== 'playState' && key !== 'filters'); // Exclude button from checkbox loop

  const statusDisplayNames = {
    randomizeQueue: 'Randomize',
    loopQueue: 'Loop',
  };

  return (
    <Box sx={{ display: 'flex', gap: 4, alignItems: 'top', p:4 }}>
      <Snackbar
        anchorOrigin={{ vertical: state.vertical, horizontal: state.horizontal }}
        open={state.open}
        onClose={handleClose}
        message={state.message}
        key={state.vertical + state.horizontal}
      />
      <Box sx={{ id: 'left-panel', display: 'inline', width: '30%', marginTop: '20px'}}>
        <Box>
          {loggedInUser ? (
              <Box>
                  <span>Welcome, {loggedInUser.username}</span>
                  <Button onClick={handleLogout} style={{ marginLeft: '10px' }}>
                      Logout
                  </Button>
              </Box>
          ) : (
            <Button onClick={() => setShowPopup(!showPopup)}>Sign In</Button>
          )}
          
          {showPopup && (
            <LoginPopup
                onClose={() => setShowPopup(false)}
                onLogin={(userInfo) => {
                    setLoggedInUser(userInfo); // Update the logged-in user info
                    setShowPopup(false);
                }}
            />
          )}
        </Box>
        {loggedInUser ? (
        <Box sx={{id: 'control-buttons',  gap: 1, marginTop: 2, marginBottom: 2}}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', minHeight: '80px' }}>
            <TextField
              variant='outlined'
              size='small'
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setUrlHelperText('') // Clear the error message
                }}
              placeholder="Enter YouTube URL"
              helperText={urlHelperText}
              error={Boolean(urlHelperText)} // Turns red if error exists
              sx={{ flex: 1 }}
            />
            <Button variant='contained' color='primary' onClick={addToQueue} startIcon={<QueueIcon />}>Add to Queue</Button>
          </Box>

          {/* Tags */}
          <Box sx={{ marginTop: 2 }}>
            <Autocomplete
              multiple
              id="tags-filled"
              options={availableTags}
              value={selectedTags}
              freeSolo
              onChange={handleTagsChange}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index });
                  return (
                    <Chip variant="outlined" label={option} key={key} {...tagProps} />
                  );
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="filled"
                  label="Tags"
                  placeholder="Press <enter> to add tags"
                />
              )}
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', marginTop: 2}}>
          {loggedInUser && loggedInUser.username === 'admin' && (
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center'}}>
              <Button variant='contained' color='error' onClick={clearQueue} startIcon={<DeleteIcon />}>Clear Queue</Button>
              <Button variant='contained' color='primary' onClick={pasteTest} startIcon={<InsertLinkIcon />}>Paste test link</Button>
            </Box>
          )}
            {statusKeys.map((key) => (
              <FormControlLabel 
                key={key} 
                control={
                  <Checkbox 
                    checked={statuses[key]} 
                    onChange={handleCheckboxChange} 
                    name={key} 
                  />
                } 
                label={statusDisplayNames[key] || key}
              />
            ))}
          </Box>
          {/* <Button variant='contained' color='primary' onClick={skipQueue} startIcon={<SkipNextIcon />}>Skip</Button> */}
          
        </Box>
        ):( <Box></Box>)}

        <Box component={Paper} sx={{ backgroundColor: '#F7F7F7', padding: 2, textAlign: 'center', borderRadius: 5}}>
          <Typography variant="h6" sx={{ marginBottom: 1 }}>
            Currently Playing
          </Typography>
          <Typography variant="body1" sx={{ marginBottom: 1 }}>
            {currentSong.title}
          </Typography>

          {loggedInUser ? (
          <Stack 
            spacing={2} 
            direction="row" 
            sx={{ 
              alignItems: 'center', 
              mb: 1, 
              width: '100%',
            }}
          >
            {/* Left section - Volume */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center',
              flex: '1 1 33%'
            }}>
              <VolumeDown />
              <Slider aria-label="Volume" value={volume} onChange={handleChange} sx={{width: '100px'}}/>
              <VolumeUp />
            </Box>

            {/* Center section - Playback controls */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              flex: '1 1 33%'
            }}>
              <Fab aria-label="previous" onClick={null} size="small">
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
              <Fab aria-label="skip" onClick={skipQueue} size="small">
                <SkipNextIcon fontSize="small" />
              </Fab>
            </Box>

            {/* Right section - Empty space */}
            <Box sx={{ flex: '1 1 33%' }} />
          </Stack>
          ):( <Box></Box>)}
          

          <LinearProgressWithLabel 
            value={progress} 
            currentTime={currentSong.currentTime} 
            duration={currentSong.duration} 
          />
        </Box>

        {loggedInUser && loggedInUser.username === 'admin' && (
          <Box sx={{ marginTop: 2, borderRadius: 5, backgroundColor: '#F7F7F7' }} component={Paper}>
            <TagColorChanger 
              tagColors={tagColors} 
              onColorChange={() => fetchTags()} 
            />
          </Box>
        )}
      </Box>

      <Box sx={{id: 'right-panel', display: 'inline', width: '70%', margin: 'auto'}}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center', marginTop: '20px'}}>
          {Object.keys(tagColors).map((key, item) => (
            <Chip
              key={item} 
              label={key} 
              size="small"
              sx={{
                backgroundColor: Array.isArray(statuses.filters) && statuses.filters.includes(key) ? 'white' : tagColors[key],
                border: Array.isArray(statuses.filters) && statuses.filters.includes(key) ? `4px solid ${tagColors[key]}` : 'none',
                boxShadow: Array.isArray(statuses.filters) && statuses.filters.includes(key) ? 3 : 0,
                transform: Array.isArray(statuses.filters) && statuses.filters.includes(key) ? 'scale(1.2)' : 'scale(1)',
                transition: 'all 0.2s ease-in-out'
              }}
              onClick={() => handleTagFilter(key)}
            />
          ))}
        </Box>
        <TableContainer component={Paper} sx={{p:2, marginTop: '20px', marginRight:'20px', borderRadius: 5, fontFamily: 'Roboto', height: '80vh', overflowY: 'auto', paddingRight: '8px'}}>
        <h2>Queue</h2>
        <Table sx={{ minWidth: 650, width: '100%' }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>URL</TableCell>
              <TableCell>AudioURL</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Tags</TableCell>
              <TableCell>Status</TableCell>
              {loggedInUser ? (
              <TableCell>Controls</TableCell>
              ):( null )}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredQueue
              .map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.title}</TableCell>
                  <TableCell width="10%">{item.url}</TableCell>
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
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {item.tags.map((tag, index) => (
                        <Chip key={index} label={tag} size="small" style={{backgroundColor: tagColorFind(tag) }}/>
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={item.status}>
                      {item.status === 'processing' ? (
                        <CircularProgress size={24} />
                      ) : item.status === 'processed' ? (
                        <CheckIcon color="success" />
                      ) : item.status === 'finished' ? (
                        <DoneAllIcon color="success" />
                      ) : item.status === 'paused' ? (
                        <PauseIcon color="primary" />
                      ) : item.status === 'pending' ? (
                        <UpdateIcon color="success" />
                      ) : item.status === 'playing' ? (
                        <PlayCircleIcon color="primary" />
                      ) : (
                        item.status
                      )}
                    </Tooltip>
                  </TableCell>
                  {loggedInUser ? (
                  <TableCell>
                    <IconButton aria-label="delete" size="small" onClick={() => handleDelete(item.id)}>
                      <DeleteIcon />
                    </IconButton>
                    <IconButton color="success" size="small" onClick={() => handlePlay(item.id)}>
                      <PlayArrowIcon />
                    </IconButton>
                  </TableCell>
                  ):( null )}
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
        
        

        <audio controls ref={audioRef}>
          <source src={audioSrc} type="audio/mpeg"/>
            Your browser does not support the audio element.
        </audio>
        </TableContainer>
      </Box>
    </Box>
    
  );
};

export default App;
