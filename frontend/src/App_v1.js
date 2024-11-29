import React, { useState } from 'react';
import axios from 'axios';

function AudioPlayer() {
  const [url, setUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');

  const handleDownload = async () => {
    try {
      const response = await axios.post(
        'http://localhost:5000/download-audio',
        { url: url }, // Correct body format
        { headers: { 'Content-Type': 'application/json' } } // Ensure the header is set to JSON
      );
      console.log(response.data); // Log the response to see the audio URL

      if (response.data && response.data.audioUrl) {
        setAudioUrl(response.data.audioUrl);  // Set the audioUrl state with the returned URL
      } else {
        console.error('Audio URL not found in response');
      }
      
    } catch (error) {
      console.error('Error fetching audio URL:', error);
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Enter YouTube URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button onClick={handleDownload}>Get Audio</button>
      {audioUrl && (
        <audio controls>
          <source src={audioUrl} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      )}
    </div>
  );
}

export default AudioPlayer;
