import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { playAudio, togglePlay, prevSong, nextSong, initPlayer, playAlbum } from '~/player';
import Header from './components/Header';
import SidebarLeft from './components/SidebarLeft';
import HomeSection from './components/HomeSection';
import MusicPlayer from './components/MusicPlayer';
import Footer from './components/Footer';
import AboutUs from './components/AboutUs';
import ProfilePage from './components/ProfilePage.jsx';
import Login from './components/Login.jsx';
import Signup from './components/Signup.jsx';
import Helper from './components/Helper.jsx';
import '~/style.css';

function App() {
  const webcamRef = useRef(null);
  const audioRef = useRef(null);
  const navigate = useNavigate();
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [emotion, setEmotion] = useState('');
  const [result, setResult] = useState('');
  const [playlist, setPlaylist] = useState([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(-1);
  const [currentSong, setCurrentSong] = useState({
    file_path: null,
    cover: '/public/default_cover.png',
    title: 'Nah',
    artist: 'Nah',
  });
  const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
  const [isAudioMuted] = useState(false);
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [showAllAlbums, setShowAllAlbums] = useState(false);
  const [list, setList] = useState([]);
  const [showAllList, setShowAllList] = useState(false);
  const [showAllRecentLists, setShowAllRecentLists] = useState(false);
  const [showAllRecentSongs, setShowAllRecentSongs] = useState(false);
  const [recentLists, setRecentLists] = useState([]);
  const [recentSongs, setRecentSongs] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('userId'));
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [topArtists, setTopArtists] = useState([]);
  const [showAllArtists, setShowAllArtists] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'; // Dùng biến môi trường

  const checkLogin = () => {
    return isLoggedIn;
  };

  const addSongToHistory = async (song, selectedAlbum = null) => {
    const userId = localStorage.getItem('userId');
    if (!userId || userId === 'null' || userId === 'undefined') {
      console.warn('App: Không có userId, không thể thêm bài hát vào lịch sử');
      return;
    }

    try {
      const songData = {
        title: song.title || 'Unknown Title',
        artist: song.artist || 'Unknown Artist',
        file_path: song.file_path?.startsWith('/') ? song.file_path : `/${song.file_path || ''}`,
        cover: song.cover || '/public/default_cover.png',
      };

      console.log('App: Sending add_historysong request:', songData, 'userId:', userId);
      await axios.post(`${apiUrl}/api/historysong/add/${userId}`, songData);
      console.log('App: Added song to history:', songData.title);

      const historySongResponse = await axios.get(`${apiUrl}/api/historysong/${userId}`);
      setRecentSongs(
        historySongResponse.data.data?.songs.sort((a, b) => new Date(b.listenedAt) - new Date(a.listenedAt)) || []
      );

      if (selectedAlbum) {
        const listData = {
          title: selectedAlbum.title || 'Unknown List',
          artist: selectedAlbum.artist || 'Nhiều nghệ sĩ',
          cover: selectedAlbum.cover || '/public/default_cover.png',
          songs: (selectedAlbum.songs || []).map(s => ({
            title: s.title || 'Unknown',
            artist: s.artist || 'Unknown',
            src: s.src || (s.file_path?.startsWith('/') ? s.file_path : `/${s.file_path || ''}`),
            cover: s.cover || '/public/default_cover.png',
          })),
        };

        console.log('App: Sending add_historylist request:', listData);
        await axios.post(`${apiUrl}/api/historylist/add/${userId}`, listData);
        console.log('App: Added list to history:', listData.title);

        const historyListResponse = await axios.get(`${apiUrl}/api/historylist/${userId}`);
        setRecentLists(
          historyListResponse.data.data?.lists.sort((a, b) => new Date(b.listenedAt) - new Date(a.listenedAt)) || []
        );
      }
    } catch (error) {
      console.error('App: Lỗi khi thêm bài hát hoặc danh sách vào lịch sử:', error.response?.data || error.message);
    }
  };

  const shuffleSong = () => {
    if (!isAudioMuted && playlist.length > 0) {
      const randomIndex = Math.floor(Math.random() * playlist.length);
      setCurrentSongIndex(randomIndex);
      playAudio(playlist[randomIndex], audioRef, setCurrentSong);
      addSongToHistory(playlist[randomIndex]);
      console.log('App: Shuffled to song index:', randomIndex);
    }
  };

  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const listsResponse = await axios.get(`${apiUrl}/api/list`);
        const fetchedLists = listsResponse.data.data;
        const shuffled = [...fetchedLists].sort(() => 0.5 - Math.random());
        setList(shuffled);
        console.log('App: Fetched & shuffled lists:', shuffled);
      } catch (error) {
        console.error('App: Lỗi khi lấy dữ liệu danh sách từ MongoDB:', error);
        setList([]);
      }
    };
    fetchData();
  }, [apiUrl]);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    console.log('App: Checking userId:', userId, 'isLoggedIn:', isLoggedIn);
    if (!userId || userId === 'null' || userId === 'undefined') {
      console.warn('App: Không có userId hợp lệ, chuyển hướng đến login');
      setIsLoggedIn(false);
      setRecentLists([]);
      setRecentSongs([]);
      navigate('/login');
      return;
    }

    setIsLoggedIn(true);

    const fetchData = async () => {
      try {
        console.log('App: Fetching history with userId:', userId);
        const historyListResponse = await axios.get(`${apiUrl}/api/historylist/${userId}`);
        const historySongResponse = await axios.get(`${apiUrl}/api/historysong/${userId}`);

        const fetchedRecentLists = historyListResponse.data.data?.lists || [];
        const fetchedRecentSongs = historySongResponse.data.data?.songs || [];

        setRecentLists(fetchedRecentLists.sort((a, b) => new Date(b.listenedAt) - new Date(a.listenedAt)));
        setRecentSongs(fetchedRecentSongs.sort((a, b) => new Date(b.listenedAt) - new Date(a.listenedAt)));

        console.log('App: Fetched recent lists:', fetchedRecentLists);
        console.log('App: Fetched recent songs:', fetchedRecentSongs);
      } catch (error) {
        console.error('App: Lỗi khi lấy dữ liệu lịch sử từ MongoDB:', error.response?.data || error.message);
        setRecentLists([]);
        setRecentSongs([]);
      }
    };

    fetchData();
  }, [navigate, apiUrl]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const albumsResponse = await axios.get(`${apiUrl}/api/albums`);
        const fetchedAlbums = albumsResponse.data.data;
        const shuffled = [...fetchedAlbums].sort(() => 0.5 - Math.random());
        setAlbums(shuffled);
        console.log('App: Fetched & shuffled albums:', shuffled);
      } catch (error) {
        console.error('App: Lỗi khi lấy dữ liệu album từ MongoDB:', error);
        setAlbums([]);
      }
    };
    fetchData();

    initPlayer(audioRef, {
      currentSongIndex,
      setCurrentSongIndex,
      playlist,
      setCurrentSong,
      nextSong: () => {
        if (!isAudioMuted && playlist.length > 0) {
          nextSong(currentSongIndex, setCurrentSongIndex, playlist, audioRef, setCurrentSong);
          addSongToHistory(playlist[(currentSongIndex + 1) % playlist.length]);
        }
      },
      prevSong: () => {
        if (!isAudioMuted && playlist.length > 0) {
          prevSong(currentSongIndex, setCurrentSongIndex, playlist, audioRef, setCurrentSong);
          addSongToHistory(playlist[(currentSongIndex - 1 + playlist.length) % playlist.length]);
        }
      },
      shuffleSong: () => {
        if (!isAudioMuted && playlist.length > 0) {
          shuffleSong();
        }
      },
    });
    console.log('App: Playlist after init:', playlist);
    if (isAudioMuted) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [currentSongIndex, playlist, isAudioMuted, apiUrl]);

  useEffect(() => {
    console.log('App: isLoggedIn updated to:', isLoggedIn);
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    if (userId && username) {
      setIsLoggedIn(true);
      setUsername(username);
    } else {
      setIsLoggedIn(false);
      setUsername('');
    }
  }, []);

  useEffect(() => {
    const fetchTopArtists = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/artists`);
        const fetchedArtists = response.data.data || [];
        const shuffledArtists = shuffleArray(fetchedArtists);
        setTopArtists(shuffledArtists);
        console.log('App: Fetched & shuffled top artists:', shuffledArtists);
      } catch (error) {
        console.error('App: Lỗi khi lấy danh sách nghệ sĩ:', error);
        setTopArtists([]);
      }
    };
    fetchTopArtists();
  }, [apiUrl]);

  const mapEmotionToVietnamese = (emotion) => {
    const emotionMap = {
      happy: 'vui',
      sad: 'buồn',
      neutral: 'bình thường',
      'No face detected': 'Không phát hiện khuôn mặt',
    };
    return emotionMap[emotion] || emotion;
  };

  const capture = async () => {
    if (webcamRef.current && isWebcamEnabled) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        const blob = await (await fetch(imageSrc)).blob();
        const formData = new FormData();
        const userId = localStorage.getItem('userId');
        if (!userId || userId === 'null' || userId === 'undefined') {
          console.warn('App: Không có userId, chuyển hướng đến login');
          navigate('/login');
          return;
        }
        formData.append('userId', userId);
        formData.append('image', blob, 'webcam.jpg');
        try {
          console.log('App: Sending predict-emotion request for userId:', userId);
          const response = await axios.post(`${apiUrl}/api/predict-emotion`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          setEmotion(response.data.emotion);
          let newPlaylist = response.data.playlist || [];
          console.log('App: Playlist from API:', newPlaylist);
          for (let i = newPlaylist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newPlaylist[i], newPlaylist[j]] = [newPlaylist[j], newPlaylist[i]];
          }
          setPlaylist(newPlaylist);
          if (newPlaylist.length > 0) {
            const vietnameseEmotion = mapEmotionToVietnamese(response.data.emotion);
            setResult(vietnameseEmotion === 'Không phát hiện khuôn mặt' ? 'Không phát hiện khuôn mặt' : `${vietnameseEmotion}`);
            setCurrentSongIndex(0);
            addSongToHistory(newPlaylist[0]);
          } else {
            setResult('Không có bài hát được gợi ý');
          }
        } catch (error) {
          console.error('App: Error capturing or predicting:', error.response?.data || error.message);
          setResult('Lỗi: Không thể dự đoán cảm xúc');
        }
      } else {
        console.error('App: Không thể chụp ảnh từ webcam');
        setResult('Không thể chụp ảnh');
      }
    }
  };

  const toggleWebcam = () => {
    setIsWebcamEnabled(!isWebcamEnabled);
    if (!isWebcamEnabled) {
      setEmotion('');
      setResult('');
      setPlaylist([]);
      setCurrentSongIndex(-1);
      setSelectedAlbum(null);
    }
  };

  const loadSection = useCallback(
    (name) => {
      console.log('App: loadSection called with name:', name);
      const album = albums.find((album) => album.title === name);
      const danhSachPhat = list.find((l) => l.title === name);
      const found = album || danhSachPhat;
      if (found) {
        setSelectedAlbum(found);
        setPlaylist(found.songs || []);
        setCurrentSongIndex(0);
        if (found.songs && found.songs.length > 0) {
          addSongToHistory(found.songs[0]);
        }
        console.log(`App: Đã tải ${album ? 'album' : 'danh sách phát'}: ${name}`);
      } else if (name === 'home') {
        setSelectedAlbum(null);
        setPlaylist([]);
        setCurrentSongIndex(-1);
        setEmotion('');
        setResult('');
        setSearchResults([]);
        setSearchQuery('');
        setTopArtists((prevArtists) => {
          const shuffledArtists = shuffleArray(prevArtists);
          console.log('App: Shuffled top artists on home:', shuffledArtists);
          return shuffledArtists;
        });
        navigate('/');
        setAlbums((prevAlbums) => shuffleArray(prevAlbums));
        setList((prevList) => shuffleArray(prevList));
        console.log('App: Đã trở về trang chủ với albums, danh sách và nghệ sĩ được xáo trộn');
      } else {
        console.log(`App: Không tìm thấy album/danh sách phát: ${name}`);
      }
    },
    [albums, list, navigate, apiUrl]
  );

  return (
    <Routes>
      <Route
        path="*"
        element={
          <>
            <Header
              searchQuery={searchQuery}
              setSearchResults={setSearchResults}
              setSearchQuery={setSearchQuery}
              isLoggedIn={isLoggedIn}
              username={username}
              setIsLoggedIn={setIsLoggedIn}
              setUsername={setUsername}
              navigate={navigate}
              loadSection={loadSection}
              setSelectedGenre={setSelectedGenre}
              selectedGenre={selectedGenre}
              setSelectedArtist={setSelectedArtist}
              currentSong={currentSong}
              audioRef={audioRef}
              isAudioMuted={false}
              playlist={playlist}
              currentSongIndex={currentSongIndex}
              setCurrentSongIndex={setCurrentSongIndex}
              setCurrentSong={setCurrentSong}
              addSongToHistory={addSongToHistory}
              togglePlay={togglePlay}
              prevSong={prevSong}
              nextSong={nextSong}
              shuffleSong={shuffleSong}
            />
            <main style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', minHeight: 'calc(100vh - 60px)', marginTop: '20px' }}>
              <SidebarLeft
                webcamRef={webcamRef}
                isWebcamEnabled={isWebcamEnabled}
                toggleWebcam={toggleWebcam}
                capture={capture}
                result={result}
                checkLogin={checkLogin}
                setPlaylist={setPlaylist}
                setCurrentSongIndex={setCurrentSongIndex}
                setCurrentSong={setCurrentSong}
                addSongToHistory={addSongToHistory}
              />
              <HomeSection
                selectedGenre={selectedGenre}
                setSelectedGenre={setSelectedGenre}
                selectedAlbum={selectedAlbum}
                isWebcamEnabled={isWebcamEnabled}
                emotion={emotion}
                playlist={playlist}
                setPlaylist={setPlaylist}
                setCurrentSongIndex={setCurrentSongIndex}
                playAudio={playAudio}
                audioRef={audioRef}
                setCurrentSong={setCurrentSong}
                addSongToHistory={addSongToHistory}
                isAudioMuted={isAudioMuted}
                albums={albums}
                showAllAlbums={showAllAlbums}
                setShowAllAlbums={setShowAllAlbums}
                list={list}
                showAllList={showAllList}
                setShowAllList={setShowAllList}
                topArtists={topArtists}
                showAllArtists={showAllArtists}
                setShowAllArtists={setShowAllArtists}
                selectedArtist={selectedArtist}
                setSelectedArtist={setSelectedArtist}
                loadSection={loadSection}
                playAlbum={playAlbum}
                setSelectedAlbum={setSelectedAlbum}
                recentLists={recentLists}
                showAllRecentLists={showAllRecentLists}
                setShowAllRecentLists={setShowAllRecentLists}
                recentSongs={recentSongs}
                showAllRecentSongs={showAllRecentSongs}
                setShowAllRecentSongs={setShowAllRecentSongs}
                checkLogin={checkLogin}
                searchResults={searchResults}
                currentSong={currentSong}
                currentSongIndex={currentSongIndex}
                togglePlay={togglePlay}
                prevSong={prevSong}
                nextSong={nextSong}
                shuffleSong={shuffleSong}
              />
              <MusicPlayer
                currentSong={currentSong}
                audioRef={audioRef}
                isAudioMuted={false}
                playlist={playlist}
                currentSongIndex={currentSongIndex}
                setCurrentSongIndex={setCurrentSongIndex}
                setCurrentSong={setCurrentSong}
                addSongToHistory={addSongToHistory}
                togglePlay={togglePlay}
                prevSong={prevSong}
                nextSong={nextSong}
                shuffleSong={shuffleSong}
                isLoggedIn={isLoggedIn}
              />
            </main>
            <Footer />
          </>
        }
      />
      <Route
        path="/profile"
        element={
          isLoggedIn ? (
            <ProfilePage isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} setUsername={setUsername} />
          ) : (
            <Login setIsLoggedIn={setIsLoggedIn} setUsername={setUsername} />
          )
        }
      />
      <Route path="/helper" element={<Helper />} />
      <Route path="/aboutus" element={<AboutUs />} />
      <Route path="/login" element={<Login setIsLoggedIn={setIsLoggedIn} setUsername={setUsername} />} />
      <Route path="/signup" element={<Signup />} />
    </Routes>
  );
}

export default App;