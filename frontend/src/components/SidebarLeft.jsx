import React, { useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { translations, currentLanguage } from '../translations';

const SidebarLeft = ({
  webcamRef,
  isWebcamEnabled,
  toggleWebcam,
  capture,
  result,
  checkLogin = () => true,
  setPlaylist,
  setCurrentSongIndex,
  setCurrentSong,
  addSongToHistory,
}) => {
  const [myPlaylists, setMyPlaylists] = useState([]);
  const [showPlaylistManager, setShowPlaylistManager] = useState(false);
  const [error, setError] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState(currentLanguage);

  useEffect(() => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && translations[savedLanguage]) {
      setLanguage(savedLanguage);
    }
  }, []);

  const fetchPlaylists = useCallback(async () => {
    if (isFetching) return;
    setIsFetching(true);
    setIsLoading(true);
    const userId = localStorage.getItem('userId');
    if (!userId || userId === 'null' || userId === 'undefined') {
      console.warn('SidebarLeft: Invalid userId');
      setMyPlaylists([]);
      setError(translations[language].please_login);
      setIsFetching(false);
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.get(`http://127.0.0.1:8001/api/myplaylist/${userId}`);
      const playlists = response.data.data?.playlists || [];
      if (!Array.isArray(playlists)) {
        setError(translations[language].invalid_playlist_data);
        setMyPlaylists([]);
      } else {
        setMyPlaylists(playlists.slice(0, 4));
        setError(null);
      }
    } catch (error) {
      setError(error.response?.data?.error || translations[language].fetch_playlist_error);
      setMyPlaylists([]);
    } finally {
      setIsFetching(false);
      setIsLoading(false);
    }
  }, [language]);

  useEffect(() => {
    if (checkLogin()) fetchPlaylists();
  }, [fetchPlaylists, checkLogin]);

  const playSong = (song) => {
    if (!song.file_path) {
      alert(translations[language].no_audio_path);
      return;
    }
    setPlaylist([song]);
    setCurrentSongIndex(0);
    setCurrentSong(song);
    addSongToHistory(song);

    const audioPlayer = document.getElementById('audio-player');
    if (audioPlayer) {
      audioPlayer.src = song.file_path;
      audioPlayer.play();
      document.getElementById('song-name').textContent = song.title;
      document.getElementById('artist-name').textContent = song.artist;
      document.getElementById('album-cover').src = song.cover || '/public/default_cover.png';
    } else {
      console.error('SidebarLeft: Audio player not found');
      alert(translations[language].audio_player_not_found);
    }
  };

  const playPlaylist = (songs) => {
    if (!songs || songs.length === 0) {
      alert(translations[language].empty_playlist_alert);
      return;
    }
    setPlaylist(songs);
    setCurrentSongIndex(0);
    setCurrentSong(songs[0]);
    addSongToHistory(songs[0]);

    const audioPlayer = document.getElementById('audio-player');
    if (!audioPlayer) {
      console.error('SidebarLeft: Audio player not found');
      alert(translations[language].audio_player_not_found);
      return;
    }
    const firstSong = songs[0];
    if (firstSong.file_path) {
      audioPlayer.src = firstSong.file_path;
      audioPlayer.play();
      document.getElementById('song-name').textContent = firstSong.title;
      document.getElementById('artist-name').textContent = firstSong.artist;
      document.getElementById('album-cover').src = firstSong.cover || '/public/default_cover.png';
    }
    audioPlayer.onended = () => {
      const currentIndex = songs.findIndex((s) => s.file_path === audioPlayer.src);
      const nextIndex = currentIndex + 1 < songs.length ? currentIndex + 1 : 0;
      if (songs[nextIndex].file_path) {
        audioPlayer.src = songs[nextIndex].file_path;
        audioPlayer.play();
        document.getElementById('song-name').textContent = songs[nextIndex].title;
        document.getElementById('artist-name').textContent = songs[nextIndex].artist;
        document.getElementById('album-cover').src = songs[nextIndex].cover || '/public/default_cover.png';
        addSongToHistory(songs[nextIndex]);
      }
    };
  };

  const renamePlaylist = async (index, newTitle) => {
    if (!newTitle.trim()) {
      alert(translations[language].rename_playlist_error);
      return;
    }
    setIsLoading(true);
    const userId = localStorage.getItem('userId');
    try {
      const response = await axios.put(`http://127.0.0.1:8001/api/edit-playlist/${userId}`, {
        playlistIndex: index,
        newTitle,
      });
      if (response.status === 200) {
        setMyPlaylists((prev) =>
          prev.map((pl, i) => (i === index ? { ...pl, title: newTitle } : pl))
        );
        alert(translations[language].playlist_renamed);
        await fetchPlaylists();
      }
    } catch (error) {
      const errorMsg =
        error.response?.status === 404
          ? translations[language].server_config_error
          : error.response?.data?.error || translations[language].delete_playlist_error;
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const deletePlaylist = async (index) => {
    setIsLoading(true);
    const userId = localStorage.getItem('userId');
    try {
      await axios.delete(`http://127.0.0.1:8001/api/delete-playlist/${userId}`, {
        data: { playlistIndex: index },
      });
      setMyPlaylists((prev) => prev.filter((_, i) => i !== index));
      alert(translations[language].playlist_deleted);
      await fetchPlaylists();
    } catch (error) {
      const errorMsg =
        error.response?.status === 404
          ? translations[language].server_config_error
          : error.response?.data?.error || translations[language].delete_playlist_error;
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const removeSongFromPlaylist = async (playlistIndex, songIndex) => {
    setIsLoading(true);
    const userId = localStorage.getItem('userId');
    try {
      await axios.delete(`http://127.0.0.1:8001/api/remove-song-from-playlist/${userId}`, {
        data: { playlistIndex, songIndex },
      });
      setMyPlaylists((prev) =>
        prev.map((pl, i) =>
          i === playlistIndex ? { ...pl, songs: pl.songs.filter((_, j) => j !== songIndex) } : pl
        )
      );
      alert(translations[language].song_removed);
      await fetchPlaylists();
    } catch (error) {
      const errorMsg =
        error.response?.status === 404
          ? translations[language].server_config_error
          : error.response?.data?.error || translations[language].remove_song_error;
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewPlaylist = async () => {
    if (myPlaylists.length >= 4) {
      setError(translations[language].max_playlists);
      alert(translations[language].max_playlists);
      return;
    }
    setIsLoading(true);
    const userId = localStorage.getItem('userId');
    if (!userId || userId === 'null' || userId === 'undefined') {
      setError(translations[language].please_login);
      alert(translations[language].please_login);
      setIsLoading(false);
      return;
    }
    try {
      const defaultTitle = `${translations[language].my_playlists} #${myPlaylists.length + 1}`;
      await axios.post(`http://127.0.0.1:8001/api/create-new-playlist/${userId}`, {
        title: defaultTitle,
      });
      await fetchPlaylists();
      alert(translations[language].playlist_created);
    } catch (error) {
      const errorMsg =
        error.response?.status === 404
          ? translations[language].server_config_error
          : error.response?.data?.error || translations[language].create_playlist_error;
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const getPlaylistCover = (songs) => {
    if (!songs || !Array.isArray(songs) || songs.length === 0) {
      return '/public/default_cover.png';
    }
    return songs[0].cover || '/public/default_cover.png';
  };

  return (
    <aside className="sidebar-left">
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', flex: 1 }}>
        <div style={{ position: 'relative', width: '170px', height: '150px', margin: '-5px auto' }}>
          {isWebcamEnabled ? (
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              style={{ display: 'block', width: '100%', height: '100%', borderRadius: '8px', opacity: '1 !important' }}
            />
          ) : (
            <div
              style={{
                width: '170px',
                height: '130px',
                backgroundColor: 'black',
                margin: '10px auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666',
                fontSize: '14px',
                opacity: '1 !important',
              }}
            >
              {translations[language].webcam_off}
            </div>
          )}
        </div>
        <button
          onClick={() => checkLogin() && capture()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            margin: '0px auto 5px auto',
            padding: '8px',
            cursor: isWebcamEnabled ? 'pointer' : 'default',
            fontWeight: 'bold',
            border: 'none',
            width: '100%',
            color: 'white',
            borderRadius: '8px',
            background: 'none',
            transition: 'opacity 0.3s ease',
          }}
        >
          <span
            className="underline-text"
            style={{
              margin: 0,
              padding: 0,
              opacity: isWebcamEnabled ? 1 : 0,
              visibility: isWebcamEnabled ? 'visible' : 'hidden',
              transition: 'opacity 0.3s ease',
            }}
          >
            {translations[language].you_feel}
          </span>
          <span
            id="result"
            style={{
              margin: 0,
              padding: 0,
              fontWeight: 'bold',
              opacity: isWebcamEnabled ? 1 : 0,
              visibility: isWebcamEnabled ? 'visible' : 'hidden',
              transition: 'opacity 0.3s ease',
            }}
          >
            {result}
          </span>
        </button>

        <button
          style={{
            display: 'block',
            cursor: 'pointer',
            border: 'none',
            transition: 'transform 0.2s ease',
            color: isWebcamEnabled ? '#ff4444' : 'white',
            marginTop: '10px',
            padding: '8px',
            width: '100%',
            borderRadius: '8px',
            background: 'none',
            opacity: '1 !important',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
          onClick={() => checkLogin() && toggleWebcam()}
        >
          {isWebcamEnabled ? translations[language].toggle_webcam_off : translations[language].toggle_webcam_on}
        </button>
        <p
          style={{
            color: 'white',
            fontSize: '16px',
            textAlign: 'center',
            margin: '5px 0',
            lineHeight: '1.6',
            opacity: '1 !important',
          }}
        >
          {translations[language].webcam_description}
        </p>
        <hr style={{ width: '100%', border: '1px solid #ccc', margin: '0px' }} />
        <button
          style={{
            display: 'block',
            cursor: 'pointer',
            border: 'none',
            transition: 'transform 0.2s ease',
            color: 'white',
            marginTop: '10px',
            padding: '8px',
            width: '100%',
            borderRadius: '8px',
            background: 'none',
            opacity: '1 !important',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
          onClick={() => checkLogin() && setShowPlaylistManager(true)}
        >
          {translations[language].my_playlists}
        </button>
        {error && (
          <p style={{ color: '#ffffffff', fontSize: '14px', textAlign: 'center', marginTop: '10px', opacity: '1 !important' }}>
            {error}
          </p>
        )}
        {isLoading && (
          <p style={{ color: '#aaa', fontSize: '14px', textAlign: 'center', marginTop: '10px', opacity: '1 !important' }}>
            {translations[language].loading}
          </p>
        )}
        {checkLogin() && !showPlaylistManager && (
          myPlaylists.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(myPlaylists.length, 2)}, 1fr)`,
                gridTemplateRows: '1fr',
                gap: '2px',
                marginTop: '5px',
                width: '75%',
                height: '150px',
                borderRadius: '8px',
                overflow: 'hidden',
                marginLeft: '30px',
                opacity: '1 !important',
              }}
            >
              {myPlaylists.slice(0, 4).map((playlist, index) => (
                <img
                  key={index}
                  src={getPlaylistCover(playlist.songs)}
                  alt={`${playlist.title || `${translations[language].my_playlists} ${index + 1}`}`}
                  style={{ width: '90%', height: '85%', objectFit: 'cover', opacity: '1 !important' }}
                />
              ))}
            </div>
          ) : (
            <p
              style={{
                color: '#aaa',
                fontSize: '14px',
                marginTop: '10px',
                textAlign: 'center',
                fontStyle: 'italic',
                opacity: '1 !important',
              }}
            >
              {translations[language].empty_playlist}
            </p>
          )
        )}
        {showPlaylistManager && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
              opacity: '1 !important',
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0)',
                padding: '20px',
                borderRadius: '8px',
                width: '700px',
                maxHeight: '80vh',
                overflowY: 'auto',
                color: 'white',
                position: 'relative',
                zIndex: 9999,
                opacity: '1 !important',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
              }}
            >
              <h2 style={{ textAlign: 'center', marginBottom: '20px', opacity: '1 !important' }}>
                {translations[language].my_playlists}
              </h2>
              <button
                onClick={() => setShowPlaylistManager(false)}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '18px',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1002,
                  opacity: '1 !important',
                }}
                title={translations[language].back_button}
              >
                ✕
              </button>
              {isLoading && (
                <p style={{ textAlign: 'center', color: '#aaa', opacity: '1 !important' }}>
                  {translations[language].loading}
                </p>
              )}
              {myPlaylists.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#aaa', opacity: '1 !important' }}>
                  {translations[language].no_playlists}
                </p>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: '15px',
                    justifyContent: 'center',
                    opacity: '1 !important',
                  }}
                >
                  {myPlaylists.map((playlist, index) => (
                    <div
                      key={index}
                      style={{
                        width: '150px',
                        backgroundColor: '#333',
                        borderRadius: '8px',
                        padding: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        opacity: '1 !important',
                      }}
                    >
                      <img
                        src={getPlaylistCover(playlist.songs)}
                        alt={`${playlist.title || `${translations[language].my_playlists} ${index + 1}`}`}
                        style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '4px', opacity: '1 !important' }}
                      />
                      <input
                        type="text"
                        defaultValue={playlist.title || `${translations[language].my_playlists} ${index + 1}`}
                        onBlur={(e) => renamePlaylist(index, e.target.value)}
                        style={{
                          backgroundColor: '#444',
                          color: 'white',
                          border: '1px solid #555',
                          padding: '5px',
                          borderRadius: '4px',
                          width: '100%',
                          margin: '10px 0',
                          textAlign: 'center',
                          opacity: '1 !important',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={() => playPlaylist(playlist.songs)}
                          style={{
                            backgroundColor: '#000000ff',
                            color: 'white',
                            border: 'none',
                            padding: '5px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '30px',
                            height: '30px',
                            opacity: '1 !important',
                          }}
                          title={translations[language].my_playlists}
                        >
                          <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deletePlaylist(index)}
                          style={{
                            backgroundColor: 'transparent',
                            color: 'white',
                            border: 'none',
                            padding: '5px 10px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            opacity: '1 !important',
                          }}
                        >
                          {translations[language].delete}
                        </button>
                      </div>
                      {playlist.songs && playlist.songs.length > 0 ? (
                        <ul style={{ padding: '10px 0', listStyle: 'none', width: '100%', opacity: '1 !important' }}>
                          {playlist.songs.map((song, songIndex) => (
                            <li
                              key={songIndex}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '5px 0',
                                opacity: '1 !important',
                                marginTop: '-10px',
                              }}
                            >
                              <span
                                style={{ cursor: 'pointer', color: '#fff', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                onClick={() => playSong(song)}
                                title={`${song.title} - ${song.artist}`}
                              >
                                {song.title}
                              </span>
                              <button
                                onClick={() => removeSongFromPlaylist(index, songIndex)}
                                style={{
                                  backgroundColor: 'transparent',
                                  color: '#ff4444',
                                  border: 'none',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  opacity: '1 !important',
                                }}
                              >
                                X
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p style={{ color: '#aaa', fontStyle: 'italic', fontSize: '12px', textAlign: 'center', padding: '0 10px', opacity: '1 !important' }}>
                          {translations[language].playlist_empty}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={createNewPlaylist}
                style={{
                  backgroundColor: myPlaylists.length >= 4 ? '#ad0000ff' : '#0f0f0fff',
                  color: 'white',
                  border: 'none',
                  padding: '10px',
                  borderRadius: '8px',
                  cursor: myPlaylists.length >= 4 ? 'not-allowed' : 'pointer',
                  marginTop: '20px',
                  opacity: '1 !important',
                }}
                disabled={myPlaylists.length >= 4}
              >
                {myPlaylists.length >= 4 ? translations[language].max_playlists : translations[language].create_playlist}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default SidebarLeft;