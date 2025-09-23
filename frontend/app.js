import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';

function App() {
  const [emotion, setEmotion] = useState('');
  const [playlist, setPlaylist] = useState([]);
  const webcamRef = useRef(null);

  const capture = async () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        const blob = await (await fetch(imageSrc)).blob();
        const formData = new FormData();
        formData.append('image', blob, 'webcam.jpg');

        try {
          const response = await axios.post('http://127.0.0.1:8001/api/predict-emotion/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          setEmotion(response.data.emotion);
          setPlaylist(response.data.playlist);
        } catch (error) {
          console.error('Error capturing or predicting:', error);
        }
      } else {
        console.error('Failed to capture image from webcam');
      }
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Feelusic</h1>
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        className="mt-2 border-2 border-gray-300"
        width={640}
        height={480}
      />
      <button
        onClick={capture}
        className="mt-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Capture and Predict
      </button>
      {emotion && <p className="mt-2">Emotion: {emotion}</p>}
      {playlist.length > 0 ? (
        <div className="mt-2">
          <h2 className="text-xl">Playlist:</h2>
          <ul className="list-disc pl-5">
            {playlist.map((song, index) => (
              <li key={index} className="mt-1">
                {song.title} - {song.artist}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2">No songs available.</p>
      )}
    </div>
  );
}

export default App;