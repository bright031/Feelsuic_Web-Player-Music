import axios from 'axios';

const normalizeString = (str) => str?.trim() || '';

export function playAudio(song, audioRef, setCurrentSong, selectedAlbum = null) {
  const audioPlayer = audioRef.current;

  // Bảo vệ khi không có audio hoặc song
  if (!audioPlayer || !song) {
    console.error('Audio player hoặc song không hợp lệ:', { song, audioPlayer });
    return;
  }

  // Lấy đường dẫn phát nhạc an toàn
  const rawPath = song.file_path || song.src;
  if (!rawPath) {
    console.error('Không có file_path hoặc src trong song:', song);
    return;
  }

  const src = rawPath.startsWith('/') ? rawPath : '/' + rawPath;
  console.log('Attempting to play audio with src:', src);

  // Gán src và cập nhật bài hát hiện tại
  audioPlayer.src = src;
  setCurrentSong({
    file_path: src,
    cover: song.cover || '/public/default_cover.png',
    title: song.title || 'Chưa chọn bài',
    artist: song.artist || 'Chưa có nghệ sĩ',
  });

  // Phát nhạc
  audioPlayer.play()
    .then(() => {
      document.querySelector('.play i')?.classList.replace('fa-play', 'fa-pause');

      const userId = localStorage.getItem('userId') || 'default_user';
      if (!userId || userId === 'null' || userId === 'undefined') {
        console.error('Invalid userId, cannot save history:', userId);
        return;
      }

      const songData = {
        title: song.title || 'Chưa chọn bài',
        artist: song.artist || 'Nhiều nghệ sĩ',
        file_path: src,
        cover: song.cover || '/public/default_cover.png',
      };

      // Gửi lịch sử bài hát nếu chưa tồn tại
      axios.get(`http://127.0.0.1:8001/api/historysong/${userId}`)
        .then(response => {
          const existingSongs = response.data.data?.songs || [];
          const isDuplicate = existingSongs.some(
            s => normalizeString(s.title) === normalizeString(songData.title) &&
              normalizeString(s.artist) === normalizeString(songData.artist) &&
              s.file_path === songData.file_path
          );
          if (!isDuplicate) {
           axios.post(`http://127.0.0.1:8001/api/historysong/add/${userId}`, songData)
  .then(() => console.log(`Saved song ${songData.title} to historysongs.`))

              .catch(error => console.error('Error saving song to historysongs:', error.response?.data || error.message));
          } else {
            console.log(`Song ${songData.title} already exists in historysongs, skipping.`);
          }
        })
        .catch(error => console.error('Error checking song history:', error.response?.data || error.message));

      // Gửi lịch sử playlist nếu có
      if (selectedAlbum) {
        const albumData = {
          title: selectedAlbum.title || 'Chưa chọn danh sách',
          artist: selectedAlbum.artist || 'Nhiều nghệ sĩ',
          cover: selectedAlbum.cover || '/public/default_cover.png',
          songs: (selectedAlbum.songs || []).map(s => {
            const rawPath = s.file_path || s.src;
            const path = rawPath ? (rawPath.startsWith('/') ? rawPath : '/' + rawPath) : '';
            return {
              title: s.title || 'Chưa chọn bài',
              artist: s.artist || 'Nhiều nghệ sĩ',
              src: path,
              cover: s.cover || '/public/default_cover.png',
            };
          }),
        };

        axios.get(`http://127.0.0.1:8001/api/historylist/${userId}`)
          .then(response => {
            const existingLists = response.data.data?.lists || [];
            const isDuplicate = existingLists.some(
              l => normalizeString(l.title) === normalizeString(albumData.title) &&
                normalizeString(l.artist) === normalizeString(albumData.artist) &&
                JSON.stringify(l.songs.map(s => s.src)) === JSON.stringify(albumData.songs.map(s => s.src))
            );
            if (!isDuplicate) {
             axios.post(`http://127.0.0.1:8001/api/historylist/add/${userId}`, albumData)
  .then(() => console.log(`Saved list ${albumData.title} to historylists.`))

                .catch(error => console.error('Error saving list to historylists:', error.response?.data || error.message));
            } else {
              console.log(`List ${albumData.title} already exists in historylists, skipping.`);
            }
          })
          .catch(error => console.error('Error checking list history:', error.response?.data || error.message));
      } else {
        console.warn('No selectedAlbum provided, skipping historylists save.');
      }
    })
    .catch(error => {
      console.error('Error playing audio:', error, 'Source:', src);
    });
}

export function playAlbum(album, audioRef, setCurrentSong, setCurrentSongIndex, setPlaylist) {
  if (!album || !album.songs || album.songs.length === 0) {
    console.error('Invalid album data:', album);
    return;
  }

  const standardizedSongs = album.songs.map(song => {
    const rawPath = song.file_path || song.src;
    const path = rawPath ? (rawPath.startsWith('/') ? rawPath : '/' + rawPath) : '';
    return {
      title: song.title || 'Chưa chọn bài',
      artist: song.artist || 'Nhiều nghệ sĩ',
      src: path,
      cover: song.cover || '/public/default_cover.png',
      file_path: path,
    };
  });

  console.log('Standardized songs for album/list:', standardizedSongs);

  setPlaylist(standardizedSongs);
  setCurrentSongIndex(0);
  playAudio(standardizedSongs[0], audioRef, setCurrentSong, { ...album, songs: standardizedSongs });
}

export function togglePlay(audioRef) {
  const audioPlayer = audioRef.current;
  const playButton = document.querySelector('.play i');

  if (!audioPlayer) return;

  if (audioPlayer.paused) {
    audioPlayer.play()
      .then(() => {
        playButton?.classList.replace('fa-play', 'fa-pause');
      })
      .catch(error => {
        console.error('Error playing audio:', error);
      });
  } else {
    audioPlayer.pause();
    playButton?.classList.replace('fa-pause', 'fa-play');
  }
}

export function prevSong(currentSongIndex, setCurrentSongIndex, playlist, audioRef, setCurrentSong, selectedAlbum = null) {
  if (playlist.length === 0) return;
  const newIndex = currentSongIndex > 0 ? currentSongIndex - 1 : playlist.length - 1;
  setCurrentSongIndex(newIndex);
  playAudio(playlist[newIndex], audioRef, setCurrentSong, selectedAlbum);
}

export function nextSong(currentSongIndex, setCurrentSongIndex, playlist, audioRef, setCurrentSong, selectedAlbum = null) {
  if (playlist.length === 0) return;
  const newIndex = currentSongIndex < playlist.length - 1 ? currentSongIndex + 1 : 0;
  setCurrentSongIndex(newIndex);
  playAudio(playlist[newIndex], audioRef, setCurrentSong, selectedAlbum);
}

export function shuffleSong(currentSongIndex, setCurrentSongIndex, playlist, audioRef, setCurrentSong, selectedAlbum = null) {
  if (playlist.length === 0) return;
  let newIndex;
  do {
    newIndex = Math.floor(Math.random() * playlist.length);
  } while (newIndex === currentSongIndex);
  setCurrentSongIndex(newIndex);
  playAudio(playlist[newIndex], audioRef, setCurrentSong, selectedAlbum);
  console.log('Shuffled to song index:', newIndex);
}

export function initPlayer(audioRef, playerContext, volumeSliderId = 'volume-slider') {
  const audioPlayer = audioRef.current;
  const volumeSlider = document.getElementById(volumeSliderId);
  const progressBar = document.getElementById('progress');
  const currentTime = document.getElementById('current-time');
  const totalTime = document.getElementById('total-time');

  if (!audioPlayer || !volumeSlider || !progressBar || !currentTime || !totalTime || !playerContext) return;

  volumeSlider.value = audioPlayer.volume || 1;

  volumeSlider.addEventListener('input', () => {
    audioPlayer.volume = volumeSlider.value;
  });

  audioPlayer.addEventListener('volumechange', () => {
    volumeSlider.value = audioPlayer.volume;
  });

  audioPlayer.addEventListener('loadedmetadata', () => {
    totalTime.textContent = formatTime(audioPlayer.duration);
  });

  audioPlayer.addEventListener('timeupdate', () => {
    const current = audioPlayer.currentTime;
    const duration = audioPlayer.duration;
    if (!isNaN(duration)) {
      progressBar.value = (current / duration) * 100;
      currentTime.textContent = formatTime(current);
      totalTime.textContent = formatTime(duration);
    }
  });

  progressBar.addEventListener('input', () => {
    const duration = audioPlayer.duration;
    if (!isNaN(duration)) {
      audioPlayer.currentTime = (progressBar.value / 100) * duration;
    }
  });

  audioPlayer.addEventListener('ended', () => {
    if (playerContext && playerContext.nextSong) {
      playerContext.nextSong();
    } else {
      console.error('playerContext or nextSong is undefined in ended event');
    }
  });
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}
