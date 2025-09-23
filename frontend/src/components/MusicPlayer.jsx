import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '~/style.css';

const MusicPlayer = ({
  currentSong = {},
  audioRef,
  isAudioMuted,
  playlist,
  currentSongIndex,
  setCurrentSongIndex,
  setCurrentSong,
  addSongToHistory,
  togglePlay,
  prevSong,
  nextSong,
  shuffleSong,
  isLoggedIn,
  onAddToPlaylist,
}) => {
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [totalTime, setTotalTime] = useState('0:00');
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);
  const [myPlaylists, setMyPlaylists] = useState([]);
  const [isFetchingPlaylists, setIsFetchingPlaylists] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Debug: Kiểm tra props ban đầu
  useEffect(() => {
    console.debug('Debug: MusicPlayer mounted with props:', {
      currentSong,
      isAudioMuted,
      playlistLength: playlist.length,
      currentSongIndex,
      isLoggedIn,
    });
  }, []);

  // Cập nhật trạng thái mute cho audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      console.debug('Debug: Cập nhật trạng thái mute:', isMuted);
    }
  }, [isMuted, audioRef]);

  // Cập nhật âm lượng
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      console.debug('Debug: Cập nhật volume - volume:', volume, 'audioRef.volume:', audioRef.current.volume);
    }
  }, [volume, audioRef]);

  // Theo dõi tiến trình phát nhạc
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      const current = audio.currentTime;
      const duration = audio.duration || 0;
      setProgress(duration ? (current / duration) * 100 : 0);
      setCurrentTime(formatTime(current));
      setTotalTime(formatTime(duration));
    };

    const handleAudioError = (e) => {
      console.error('Debug: Lỗi phát audio:', e.nativeEvent);
    };

    const handleEnded = () => {
      if (isLoggedIn && !isAudioMuted && playlist.length > 0) {
        nextSong(currentSongIndex, setCurrentSongIndex, playlist, audioRef, setCurrentSong);
        const nextIndex = (currentSongIndex + 1) % playlist.length;
        addSongToHistory(playlist[nextIndex]);
      }
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateProgress);
    audio.addEventListener('error', handleAudioError);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', updateProgress);
      audio.removeEventListener('error', handleAudioError);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioRef, currentSongIndex, setCurrentSongIndex, playlist, nextSong, setCurrentSong, addSongToHistory, isLoggedIn, isAudioMuted]);

  // Lấy danh sách playlist từ backend
  const fetchPlaylists = async () => {
    if (isFetchingPlaylists) {
      console.debug('Debug: Đang tải playlists, bỏ qua yêu cầu mới');
      return;
    }
    setIsFetchingPlaylists(true);
    const userId = localStorage.getItem('userId');
    console.debug('Debug: Fetch playlists - userId:', userId);

    if (!userId || userId === 'null' || userId === 'undefined') {
      console.debug('Debug: userId không hợp lệ:', userId);
      alert('Vui lòng đăng nhập lại để xem danh sách phát');
      setIsFetchingPlaylists(false);
      return;
    }

    try {
      const response = await axios.get(`http://127.0.0.1:8001/api/myplaylist/${userId}`);
      const playlists = response.data.data?.playlists || [];
      console.debug('Debug: Nhận được danh sách playlists:', playlists);

      if (!Array.isArray(playlists)) {
        console.error('Debug: Dữ liệu playlist không hợp lệ:', playlists);
        alert('Dữ liệu danh sách phát không hợp lệ');
        setMyPlaylists([]);
      } else {
        setMyPlaylists(playlists);
      }
    } catch (error) {
      console.error('Debug: Lỗi khi tải playlists:', error.response?.data || error.message);
      alert(error.response?.data?.error || 'Không thể tải danh sách phát');
      setMyPlaylists([]);
    } finally {
      setIsFetchingPlaylists(false);
    }
  };

  // Xử lý khi nhấn "Thêm vào playlist"
  const handleAddToPlaylistClick = () => {
    console.debug('Debug: Nhấn nút Thêm vào playlist - isLoggedIn:', isLoggedIn, 'currentSong:', currentSong, 'audioRef:', !!audioRef.current, 'paused:', audioRef.current?.paused);
    if (!isLoggedIn) {
      console.debug('Debug: Không thể thêm bài hát, chưa đăng nhập');
      alert('Vui lòng đăng nhập để thêm bài hát vào Danh sách của tôi');
      return;
    }

    const userId = localStorage.getItem('userId');
    if (!userId || userId === 'null' || userId === 'undefined') {
      console.debug('Debug: Không thể thêm bài hát, userId không hợp lệ:', userId);
      alert('Vui lòng đăng nhập lại');
      return;
    }

    if (!currentSong.title || !currentSong.artist || !currentSong.file_path) {
      console.debug('Debug: Không thể thêm bài hát, thông tin bài hát không đầy đủ:', {
        title: currentSong.title || 'Không có tiêu đề',
        artist: currentSong.artist || 'Không có nghệ sĩ',
        file_path: currentSong.file_path || 'Không có file',
      });
      alert('Chọn bài hát mới được thêm vào danh sách phát nhé~~~');
      return;
    }

    if (!audioRef.current || audioRef.current.paused) {
      console.debug('Debug: Không thể thêm bài hát, bài hát chưa phát:', {
        audioRefExists: !!audioRef.current,
        isPaused: audioRef.current?.paused,
      });
      alert('Bài hát phải đang phát để thêm vào danh sách');
      return;
    }

    console.debug('Debug: Mở modal chọn playlist - song:', currentSong.title);
    fetchPlaylists();
    setShowPlaylistSelector(true);
  };

  // Thêm bài hát vào playlist được chọn
  const addToPlaylist = async (playlistIndex) => {
    const userId = localStorage.getItem('userId');
    console.debug('Debug: Thêm bài hát vào playlist - playlistIndex:', playlistIndex, 'song:', currentSong.title);
    try {
      await axios.post(`http://127.0.0.1:8001/api/add-to-playlist/${userId}`, {
        playlistIndex,
        title: currentSong.title,
        artist: currentSong.artist,
        file_path: currentSong.file_path || '',
        cover: currentSong.cover || '/public/default_cover.png',
      });
      console.debug('Debug: Thêm bài hát thành công vào playlist:', myPlaylists[playlistIndex]?.title || `Danh sách ${playlistIndex + 1}`);
      alert(`Đã thêm bài hát "${currentSong.title}" vào danh sách ${myPlaylists[playlistIndex]?.title || `Danh sách ${playlistIndex + 1}`}`);
      setShowPlaylistSelector(false);
      if (onAddToPlaylist) {
        console.debug('Debug: Gọi callback onAddToPlaylist');
        onAddToPlaylist();
      }
    } catch (err) {
      console.error('Debug: Lỗi khi thêm bài hát vào playlist:', err.response?.data || err.message);
      alert(err.response?.data?.error || 'Không thể thêm bài hát');
    }
  };

  // Xử lý thay đổi tiến trình
  const handleProgressChange = (e) => {
    if (audioRef.current && !isAudioMuted) {
      const newProgress = parseFloat(e.target.value);
      const duration = audioRef.current.duration || 0;
      audioRef.current.currentTime = (newProgress / 100) * duration;
      setProgress(newProgress);
    }
  };

  // Xử lý thay đổi âm lượng
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      console.debug('Debug: Thay đổi volume - newVolume:', newVolume);
    }
  };

  // Xử lý các nút điều khiển
  const handlePlayClick = () => {
    console.debug('Debug: Nhấn nút Play - currentSong:', currentSong.title || 'Không có bài hát');
    if (isLoggedIn && !isAudioMuted && playlist.length > 0 && currentSongIndex >= 0) {
      togglePlay(audioRef);
    }
  };

  const handlePrevClick = () => {
    console.debug('Debug: Nhấn nút Prev - currentSongIndex:', currentSongIndex);
    if (isLoggedIn && !isAudioMuted && playlist.length > 0) {
      prevSong(currentSongIndex, setCurrentSongIndex, playlist, audioRef, setCurrentSong);
      const prevIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
      addSongToHistory(playlist[prevIndex]);
    }
  };

  const handleNextClick = () => {
    console.debug('Debug: Nhấn nút Next - currentSongIndex:', currentSongIndex);
    if (isLoggedIn && !isAudioMuted && playlist.length > 0) {
      nextSong(currentSongIndex, setCurrentSongIndex, playlist, audioRef, setCurrentSong);
      const nextIndex = (currentSongIndex + 1) % playlist.length;
      addSongToHistory(playlist[nextIndex]);
    }
  };

  const handleShuffleClick = () => {
    console.debug('Debug: Nhấn nút Shuffle - playlistLength:', playlist.length);
    if (isLoggedIn && !isAudioMuted && playlist.length > 0) {
      shuffleSong();
    }
  };

  // Format thời gian
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <section className="music-player">
      <audio
        id="audio-player"
        ref={audioRef}
        style={{ display: 'none' }}
      >
        <source
          src={currentSong.file_path || '/default_song.mp3'}
          type="audio/mp3"
        />
      </audio>
      <div className="player-info">
        <img
          id="album-cover"
          src={currentSong.cover || '/public/default_cover.png'}
          alt="Album Cover"
        />
        <div className="track-info">
          <h3 id="song-name">{currentSong.title || 'Không có bài hát'}</h3>
          <p id="artist-name">{currentSong.artist || 'Không có nghệ sĩ'}</p>
        </div>
        <button
          onClick={handleAddToPlaylistClick}
          style={{
            padding: '8px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'white',
            cursor: 'pointer',
            fontSize: '18px',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.3s',
            marginLeft: '10px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          title="Thêm vào Danh sách của tôi"
        >
          ➕
        </button>
      </div>
      <div className="player-controls">
        <button
          className="prev"
          onClick={handlePrevClick}
          disabled={isAudioMuted || playlist.length === 0}
        >
          <i className="fa-solid fa-backward"></i>
        </button>
        <button
          className="play"
          onClick={handlePlayClick}
          disabled={isAudioMuted || playlist.length === 0 || currentSongIndex < 0}
        >
          <i className={audioRef.current && !audioRef.current.paused ? 'fa-solid fa-pause' : 'fa-solid fa-play'}></i>
        </button>
        <button
          className="next"
          onClick={handleNextClick}
          disabled={isAudioMuted || playlist.length === 0}
        >
          <i className="fa-solid fa-forward"></i>
        </button>
        <button
          className="shuffle"
          onClick={handleShuffleClick}
          disabled={isAudioMuted || playlist.length === 0}
        >
          <i className="fa-solid fa-shuffle"></i>
        </button>
      </div>
      <div className="progress-bar">
        <span id="current-time">{currentTime}</span>
        <input
          type="range"
          id="progress"
          value={progress}
          onChange={handleProgressChange}
          min="0"
          max="100"
          disabled={isAudioMuted}
        />
        <span id="total-time">{totalTime}</span>
      </div>
      <div className="volume-control">
        <button
          onClick={() => setIsMuted(!isMuted)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '18px',
            marginRight: '8px',
            cursor: 'pointer',
          }}
          title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
        >
          <i className={`fa-solid ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'}`}></i>
        </button>
        <input
          type="range"
          id="volume-slider"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          disabled={isMuted}
        />
      </div>
      {showPlaylistSelector && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#222',
              padding: '20px',
              borderRadius: '8px',
              width: '400px',
              maxHeight: '60vh',
              overflowY: 'auto',
              color: 'white',
            }}
          >
            <h2 style={{ textAlign: 'center' }}>Chọn Danh sách để thêm</h2>
            <button
              onClick={() => setShowPlaylistSelector(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '18px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
            {myPlaylists.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#aaa' }}>
                Chưa có danh sách phát nào. Hãy tạo một danh sách mới trong "Danh sách của tôi"!
              </p>
            ) : (
              myPlaylists.map((playlist, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px',
                    borderBottom: '1px solid #444',
                    cursor: 'pointer',
                  }}
                  onClick={() => addToPlaylist(index)}
                >
                  <span>{playlist.title || `Danh sách ${index + 1}`}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default MusicPlayer;