import React, { useState, useEffect } from 'react';
import axios from 'axios';

const QueueManager = () => {
  const [queue, setQueue] = useState([]);
  const [url, setUrl] = useState('');

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

  useEffect(() => {
    fetchQueue();  // Fetch queue when the component loads
  }, []);

  return (
    <div>
      <h2>Queue Manager</h2>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter YouTube URL"
      />
      <button onClick={addToQueue}>Add to Queue</button>
      <button onClick={clearQueue}>Clear Queue</button>

      <h3>Current Queue</h3>
      <ul>
        {queue.map((item) => (
          <li key={item.id}>
            {item.url} - {item.status}
          </li>
        ))}
      </ul>

      <h3>Now Playing</h3>
      <audio controls autoPlay>
        <source src="http://localhost:5000/broadcast" type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    </div>
    
  );
};

export default QueueManager;
