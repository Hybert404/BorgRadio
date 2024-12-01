import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const MusicPlayer = () => {
  const [url, setUrl] = useState('');
  const [queue, setQueue] = useState([]);
  const [response, setResponse] = useState('');
  const [message, setMessage] = useState('');
  const [audioSrc, setAudioSrc] = useState("http://localhost:5000/stream"); // State to manage the audio source
  const audioRef = useRef(null); // Reference to the audio player
  const [isUserInteracted, setIsUserInteracted] = useState(false); // Track user interaction

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

  const pasteCount = () => {
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

  // Skip the current item
  const skipItem = async () => {
    try {
      await axios.post('http://localhost:5000/queue/skip');
      fetchQueue();  // Refresh queue after skipping
    } catch (error) {
      console.error('Error skipping item:', error);
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
      console.log(`${time} [WebSocket] Event: ${data.event}, Message: ${data.message}`);

      if (data.event === 'track-ended') {
        console.log('The track has ended. Ready for the next track.');
      } else if (data.event === 'track-skipped') {
        console.log('The track was skipped.');
        if (audioRef.current) {
          audioRef.current.pause();
        }
      } else if (data.event === 'refresh') {
        fetchQueue();
      } else if (data.event === 'playing') {
        console.log('Refreshing audio source and playing.');
        // setAudioSrc(data.message); // Update the source if required
        if (audioRef.current) {
          audioRef.current.load(); // Reload the audio element
          audioRef.current.play().catch((err) => {
            console.error('Autoplay failed:', err);
          }); // Start playing
        }
      };
      setResponse(event.data);
    };

    // Cleanup on component unmount
    return () => {
      ws.close();
      console.log('Disconnected from server');
    };
  }, []);
  //websocket
  // const sendMessage = () => {
  //   const ws = new WebSocket('ws://localhost:5000');
  //   ws.onopen = () => {
  //     ws.send(message);
  //   };
  // };
  

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

  return (
    <div style={{width: 1000, margin: "0 auto"}}>
      <h2>Queue Manager</h2>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter YouTube URL"
      />
      <button onClick={addToQueue}>Add to Queue</button>
      <button onClick={clearQueue}>Clear Queue</button>
      <button onClick={skipQueue}>Skip</button>
      <br></br>
      <button onClick={pastelink}>Paste test link</button>
      <button onClick={pasteCount}>1 2 3</button>
      <button onClick={processUrl}>Process</button>

      <h3>Current Queue</h3>
      <ul>
        {queue.map((item) => (
          <li key={item.id}>
            {item.title ? `${item.title} - `:''} {item.url} - {item.status} {item.audioUrl ? <a href={item.audioUrl} target="_blank"><button>Open audio url</button></a> : ''}
          </li> 
        ))}
      </ul>

      <h3>Now Playing</h3>
      {!isUserInteracted && (
        <button onClick={handleUserInteraction}>Start Audio</button>
      )}
      <button onClick={reloadMusic}>Reload Audio</button>
      <audio controls ref={audioRef}>
        <source src={audioSrc} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
      
    </div>
  );
};

export default MusicPlayer;
