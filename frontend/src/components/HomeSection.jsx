import React, { useState, useEffect } from 'react';
import { translations, currentLanguage } from '../translations';

const HomeSection = ({
  selectedAlbum,
  isWebcamEnabled,
  emotion,
  playlist,
  setPlaylist,
  setCurrentSongIndex,
  playAudio,
  audioRef,
  setCurrentSong,
  addSongToHistory,
  isAudioMuted,
  albums,
  showAllAlbums,
  setShowAllAlbums,
  list,
  showAllList,
  setShowAllList,
  topArtists,
  showAllArtists,
  setShowAllArtists,
  selectedArtist,
  setSelectedArtist,
  playAlbum,
  setSelectedAlbum,
  recentLists,
  showAllRecentLists,
  setShowAllRecentLists,
  recentSongs,
  showAllRecentSongs,
  setShowAllRecentSongs,
  checkLogin,
  searchResults,
  selectedGenre,
}) => {
  const [songsByArtist, setSongsByArtist] = useState([]);
  const [songsByGenre, setSongsByGenre] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState(currentLanguage);

  // Đồng bộ ngôn ngữ từ localStorage
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language');
    const validLanguage = savedLanguage && translations[savedLanguage] ? savedLanguage : 'vi';
    setLanguage(validLanguage);
    if (validLanguage !== savedLanguage) {
      localStorage.setItem('language', validLanguage);
      console.debug(`HomeSection: Fallback ngôn ngữ về '${validLanguage}' vì '${savedLanguage}' không hợp lệ`);
    }

    // Lắng nghe sự kiện storage để cập nhật ngôn ngữ
    const handleStorageChange = (event) => {
      if (event.key === 'language') {
        const newLanguage = event.newValue && translations[event.newValue] ? event.newValue : 'vi';
        setLanguage(newLanguage);
        console.debug(`HomeSection: Ngôn ngữ thay đổi qua storage event thành '${newLanguage}'`);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Dọn dẹp listener khi component unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Debug trạng thái
  useEffect(() => {
    console.log('HomeSection: Nhận prop selectedGenre:', selectedGenre);
    console.log('HomeSection: Cập nhật trạng thái', {
      selectedGenre,
      songsByGenreLength: songsByGenre.length,
      searchResultsLength: searchResults?.length,
      selectedArtist: !!selectedArtist,
      selectedAlbum: !!selectedAlbum,
      isWebcamEnabled,
      emotion,
      playlistLength: playlist.length,
      language,
      translationsExist: !!translations[language],
      songsCountKey: translations[language]?.songs_count,
    });
  }, [selectedGenre, songsByGenre, searchResults, selectedArtist, selectedAlbum, isWebcamEnabled, emotion, playlist, language]);

  // Các hàm hiển thị/thu gọn
  const viewAllAlbums = () => setShowAllAlbums(true);
  const collapseAlbums = () => setShowAllAlbums(false);
  const viewAllList = () => setShowAllList(true);
  const collapseList = () => setShowAllList(false);
  const viewAllArtists = () => setShowAllArtists(true);
  const collapseArtists = () => setShowAllArtists(false);
  const viewAllRecentLists = () => setShowAllRecentLists(true);
  const collapseRecentLists = () => setShowAllRecentLists(false);
  const viewAllRecentSongs = () => setShowAllRecentSongs(true);
  const collapseRecentSongs = () => setShowAllRecentSongs(false);

  // Lấy bài hát theo nghệ sĩ
  useEffect(() => {
    if (!selectedArtist) {
      setSongsByArtist([]);
      setError(null);
      return;
    }
    setIsLoading(true);
    console.log('HomeSection: Lấy bài hát cho nghệ sĩ:', selectedArtist.artist);
    fetch(`http://localhost:8001/api/songs-by-artist?artist=${encodeURIComponent(selectedArtist.artist)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        console.log('HomeSection: Nhận bài hát nghệ sĩ:', data.data);
        setSongsByArtist(data.data || []);
        setError(null);
      })
      .catch((err) => {
        console.error('HomeSection: Lỗi lấy bài hát nghệ sĩ:', err.message);
        setError(translations[language]?.error_genre || 'Failed to load songs by artist.');
      })
      .finally(() => setIsLoading(false));
  }, [selectedArtist, language]);

  // Lấy bài hát theo thể loại
  useEffect(() => {
    if (!selectedGenre) {
      setSongsByGenre([]);
      setError(null);
      setIsLoading(false);
      console.log('HomeSection: Không có thể loại được chọn, reset songsByGenre');
      return;
    }
    setIsLoading(true);
    console.log('HomeSection: Lấy bài hát cho thể loại:', selectedGenre);
    fetch(`http://localhost:8001/api/songs-by-genre?genre=${encodeURIComponent(selectedGenre)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        console.log('HomeSection: Nhận bài hát thể loại:', data.data);
        setSongsByGenre(data.data || []);
        setError(null);
      })
      .catch((err) => {
        console.error('HomeSection: Lỗi lấy bài hát thể loại:', err.message);
        setError(translations[language]?.error_genre || 'Failed to load songs by genre.');
      })
      .finally(() => setIsLoading(false));
  }, [selectedGenre, language]);

  return (
    <>
      {selectedGenre ? (
        <div className="genre-results-section" style={{ maxWidth: '1400px', width: '100%', padding: '20px', color: 'white', fontFamily: 'sans-serif', marginTop: '20px', marginLeft: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', marginTop: '30px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {translations[language]?.genre || 'Genre'} {selectedGenre}
            </h2>
          </div>
          {isLoading && <p>{translations[language]?.loading || 'Loading...'}</p>}
          {error && <p style={{ color: 'red', marginBottom: '20px' }}>{error}</p>}
          {!isLoading && !error && songsByGenre.length === 0 && (
            <p>{translations[language]?.no_songs_genre?.replace('{genre}', selectedGenre) || `No songs found for genre ${selectedGenre}`}</p>
          )}
          {!isLoading && songsByGenre.length > 0 && (
            <div className="genre-results-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'flex-start' }}>
              {songsByGenre.map((song, index) => (
                <div
                  key={index}
                  onClick={() => {
                    if (!checkLogin()) return;
                    console.log('HomeSection: Phát bài hát thể loại:', song.title);
                    const correctPath = song.file_path?.startsWith('/') ? song.file_path : `/${song.file_path}`;
                    setPlaylist(songsByGenre);
                    setCurrentSongIndex(index);
                    playAudio({ ...song, file_path: correctPath }, audioRef, setCurrentSong);
                    addSongToHistory({ ...song, file_path: correctPath });
                  }}
                  style={{ width: '140px', cursor: checkLogin() ? 'pointer' : 'not-allowed', opacity: checkLogin() ? 1 : 0.5, position: 'relative' }}
                  onMouseEnter={(e) => {
                    if (checkLogin()) {
                      e.currentTarget.style.transform = 'scale(1.01)';
                      e.currentTarget.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (checkLogin()) {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  <img
                    src={song.cover || '/public/default_cover.png'}
                    alt={song.title}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '12px', marginBottom: '10px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)' }}
                  />
                  <button
                    className="play-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!checkLogin()) return;
                      console.log('HomeSection: Phát bài hát từ nút play:', song.title);
                      const correctPath = song.file_path?.startsWith('/') ? song.file_path : `/${song.file_path}`;
                      setPlaylist(songsByGenre);
                      setCurrentSongIndex(index);
                      playAudio({ ...song, file_path: correctPath }, audioRef, setCurrentSong);
                      addSongToHistory({ ...song, file_path: correctPath });
                    }}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'rgba(0, 0, 0, 0.6)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: checkLogin() ? 'pointer' : 'not-allowed',
                      opacity: checkLogin() ? 0 : 0.5,
                      transition: 'opacity 0.2s ease',
                    }}
                    onMouseEnter={(e) => { if (checkLogin()) e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { if (checkLogin()) e.currentTarget.style.opacity = '0'; }}
                  >
                    <i className="fa-solid fa-play" style={{ color: 'white', fontSize: '20px' }}></i>
                  </button>
                  <div style={{ color: 'white', textAlign: 'left', paddingLeft: '5px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>{song.title}</div>
                    <div style={{ fontSize: '12px', color: '#bbbbbb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>{song.artist}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : searchResults?.length > 0 ? (
        <div className="search-results-section" style={{ maxWidth: '1350px', width: '100%', padding: '20px', color: 'white', fontFamily: 'sans-serif', marginTop: '20px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '0px', marginTop: '35px' }}>{translations[language]?.search_results || 'Search Results'}</h2>
          <div className="search-results-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'flex-start' }}>
            {searchResults.map((item) => (
              <div
                key={item._id}
                onClick={() => {
                  if (!checkLogin()) return;
                  if (item.type === 'song') {
                    console.log('HomeSection: Phát bài hát tìm kiếm:', item.name);
                    const correctPath = item.file_path?.startsWith('/') ? item.file_path : `/${item.file_path}`;
                    setPlaylist([item]);
                    setCurrentSongIndex(0);
                    playAudio({ ...item, file_path: correctPath }, audioRef, setCurrentSong);
                    addSongToHistory({ ...item, file_path: correctPath });
                  } else if (item.type === 'artist') {
                    console.log('HomeSection: Chọn nghệ sĩ:', item.name);
                    setSelectedArtist(item);
                    window.scrollTo(0, 0);
                  } else if (item.type === 'list') {
                    console.log('HomeSection: Chọn danh sách:', item.name);
                    setSelectedAlbum(item);
                    if (item.songs?.length > 0) {
                      const correctPath = item.songs[0].file_path?.startsWith('/') ? item.songs[0].file_path : `/${item.songs[0].file_path}`;
                      setPlaylist(item.songs);
                      setCurrentSongIndex(0);
                      playAudio({ ...item.songs[0], file_path: correctPath }, audioRef, setCurrentSong);
                      addSongToHistory({ ...item.songs[0], file_path: correctPath });
                    }
                  }
                }}
                style={{ width: '140px', cursor: checkLogin() ? 'pointer' : 'not-allowed', opacity: checkLogin() ? 1 : 0.5, position: 'relative' }}
                onMouseEnter={(e) => { if (checkLogin()) { e.currentTarget.style.transform = 'scale(1.01)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.4)'; } }}
                onMouseLeave={(e) => { if (checkLogin()) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; } }}
              >
                <img
                  src={item.cover || '/public/default_cover.png'}
                  alt={item.name}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: item.type === 'artist' ? '50%' : '12px', marginBottom: '10px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)' }}
                />
                {item.type === 'song' && (
                  <button
                    className="play-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!checkLogin()) return;
                      console.log('HomeSection: Phát bài hát từ nút play:', item.name);
                      const correctPath = item.file_path?.startsWith('/') ? item.file_path : `/${item.file_path}`;
                      setPlaylist([item]);
                      setCurrentSongIndex(0);
                      playAudio({ ...item, file_path: correctPath }, audioRef, setCurrentSong);
                      addSongToHistory({ ...item, file_path: correctPath });
                    }}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'rgba(0, 0, 0, 0.6)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: checkLogin() ? 'pointer' : 'not-allowed',
                      opacity: checkLogin() ? 0 : 0.5,
                      transition: 'opacity 0.2s ease',
                    }}
                    onMouseEnter={(e) => { if (checkLogin()) e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { if (checkLogin()) e.currentTarget.style.opacity = '0'; }}
                  >
                    <i className="fa-solid fa-play" style={{ color: 'white', fontSize: '20px' }}></i>
                  </button>
                )}
                <div style={{ color: 'white', textAlign: 'left', paddingLeft: '5px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>{item.name}</div>
                  <div style={{ fontSize: '12px', color: '#bbbbbb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>
                    {item.type === 'song' ? item.artist : translations[language]?.[item.type] || item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : selectedArtist ? (
        <div style={{ width: '100%', maxWidth: '5000px', minHeight: '100vh', backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.6), #000), url(${selectedArtist.cover2 || selectedArtist.cover || '/public/default_cover.png'})`, backgroundSize: 'cover', backgroundPosition: 'center', padding: '40px', color: 'white', fontFamily: 'sans-serif', marginTop: '20px', marginLeft: '50px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px' }}>
            <img src={selectedArtist.cover || '/public/default_cover.png'} alt={selectedArtist.artist} style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '8px', boxShadow: '0 4px 30px rgba(68, 65, 65, 0.5)', marginTop: '10px' }} />
            <div>
              <h1 style={{ fontSize: '48px', fontWeight: 'bold', margin: 0 }}>{selectedArtist.artist}</h1>
              <p style={{ fontSize: '12px', color: '#ccc' }}>{translations[language]?.artist || 'Artist'}</p>
              <p style={{ fontSize: '14px', color: '#ccc' }}>{translations[language]?.songs_count?.replace('{count}', songsByArtist.length) || `${songsByArtist.length} songs`}</p>
            </div>
          </div>
          {isLoading && <p>{translations[language]?.loading || 'Loading...'}</p>}
          {error && <p style={{ color: 'red', marginTop: '20px' }}>{error}</p>}
          <div style={{ marginTop: '30px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'normal', marginBottom: '20px' }}>{translations[language]?.popular_songs || 'Popular Songs'}</h2>
            {songsByArtist.length > 0 ? (
              songsByArtist.map((song, index) => (
                <div
                  key={index}
                  onClick={() => {
                    if (!checkLogin()) return;
                    console.log('HomeSection: Phát bài hát nghệ sĩ:', song.title);
                    setPlaylist(songsByArtist);
                    setCurrentSongIndex(index);
                    const correctPath = song.file_path?.startsWith('/') ? song.file_path : `/${song.file_path}`;
                    playAudio({ ...song, file_path: correctPath }, audioRef, setCurrentSong);
                    addSongToHistory({ ...song, file_path: correctPath });
                  }}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '8px', marginBottom: '10px', backgroundColor: 'rgba(30, 30, 30, 0%)', cursor: checkLogin() ? 'pointer' : 'not-allowed', opacity: checkLogin() ? 1 : 0.5, transition: 'opacity 0.3s ease' }}
                >
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '16px' }}>{song.title}</div>
                    <div style={{ fontSize: '13px', color: '#aaa' }}>{song.artist}</div>
                  </div>
                </div>
              ))
            ) : (
              <p>{translations[language]?.no_songs_artist || 'No songs available for this artist'}</p>
            )}
          </div>
          <button
            onClick={() => {
              console.log('HomeSection: Quay lại từ nghệ sĩ');
              setSelectedArtist(null);
              setSongsByArtist([]);
              setError(null);
            }}
            style={{ marginTop: '30px', padding: '10px 20px', backgroundColor: 'transparent', color: 'white', border: '1px solid white', borderRadius: '20px', cursor: 'pointer' }}
          >
            {translations[language]?.back || 'Back'}
          </button>
        </div>
      ) : selectedAlbum ? (
        <div style={{ width: '100%', minHeight: '100vh', backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.6), #000), url(${selectedAlbum.cover})`, backgroundSize: 'cover', backgroundPosition: 'center', padding: '40px', color: 'white', fontFamily: 'sans-serif' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px' }}>
            <img src={selectedAlbum.cover || '/public/default_cover.png'} alt="cover" style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '8px', backgroundColor: 'rgba(30, 30, 30, 0.5)', marginTop: '20px' }} />
            <div>
              <h1 style={{ fontSize: '48px', fontWeight: 'bold', margin: 0 }}>{selectedAlbum.title}</h1>
              <p style={{ fontSize: '12px', textTransform: 'uppercase', color: '#ccc', marginBottom: '10px' }}>{translations[language]?.playlist || 'Playlist'}</p>
              <p style={{ fontSize: '14px', color: '#ccc', marginTop: '8px' }}>{selectedAlbum.artist} • {translations[language]?.songs_count?.replace('{count}', selectedAlbum.songs?.length || 0) || `${selectedAlbum.songs?.length || 0} songs`}</p>
            </div>
          </div>
          <div className="song-container">
            {selectedAlbum.songs?.length > 0 ? (
              selectedAlbum.songs.map((song, index) => (
                <div
                  key={index}
                  className="song-card"
                  data-src={song.src}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '8px', marginBottom: '10px', backgroundColor: 'rgba(30, 30, 30, 0%)', cursor: checkLogin() ? 'pointer' : 'not-allowed', opacity: checkLogin() ? 1 : 0.5, transition: 'opacity 0.3s ease', marginTop: '20px' }}
                >
                  <div className="song-info" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', textAlign: 'left' }}>
                    <p style={{ margin: 0, color: 'white', fontWeight: '500' }}>{song.title}</p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#aaa' }}>{song.artist}</p>
                  </div>
                  <button
                    className="play-icon"
                    onClick={() => {
                      if (!checkLogin()) return;
                      console.log('HomeSection: Phát bài hát từ album:', song.title);
                      setPlaylist(selectedAlbum.songs);
                      setCurrentSongIndex(index);
                      const correctPath = song.src?.startsWith('/') ? song.src : `/${song.src}`;
                      playAudio({ ...song, file_path: correctPath }, audioRef, setCurrentSong);
                      addSongToHistory({ ...song, file_path: correctPath });
                    }}
                    disabled={isAudioMuted || !checkLogin()}
                  >
                    <i className="fa-solid fa-play"></i>
                  </button>
                </div>
              ))
            ) : (
              <p>{translations[language]?.no_songs_album || 'No songs in this album yet'}</p>
            )}
          </div>
          <button
            onClick={() => {
              console.log('HomeSection: Quay lại từ album');
              setSelectedAlbum(null);
            }}
            style={{ marginTop: '30px', padding: '10px 20px', backgroundColor: 'transparent', color: 'white', border: '1px solid white', borderRadius: '20px', cursor: 'pointer' }}
          >
            {translations[language]?.back || 'Back'}
          </button>
        </div>
      ) : isWebcamEnabled && emotion && playlist.length > 0 ? (
        <div className="playlist-container" style={{ maxWidth: '1200px', width: '100%' }}>
          <div className="playlist-grid">
            {playlist.map((song, index) => (
              <div key={index} className="song-card" style={{ cursor: checkLogin() ? 'pointer' : 'not-allowed', opacity: checkLogin() ? 1 : 0.5 }}>
                <div className="song-info">
                  {song.cover && <img src={song.cover} alt={song.title} className="song-cover" />}
                  <div className="song-details">
                    <p className="song-title">{song.title}</p>
                    <p className="song-artist">{song.artist}</p>
                  </div>
                </div>
                <button
                  className="play-icon"
                  onClick={() => {
                    if (!checkLogin()) return;
                    console.log('HomeSection: Phát bài hát từ playlist:', song.title);
                    const correctPath = song.file_path?.startsWith('/') ? song.file_path : `/${song.file_path}`;
                    setPlaylist(playlist);
                    setCurrentSongIndex(index);
                    playAudio({ ...song, file_path: correctPath }, audioRef, setCurrentSong);
                    addSongToHistory({ ...song, file_path: correctPath });
                  }}
                  disabled={isAudioMuted || !checkLogin()}
                >
                  <i className="fa-solid fa-play"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div id="home-section" className="home">
          <section className="album">
            <div className="section-header">
              <div className="album-label">{translations[language]?.albums || 'Albums & EPs'}</div>
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', paddingLeft: '1050px' }}>
                {albums.length > 0 && !showAllAlbums && (
                  <button onClick={viewAllAlbums} style={{ color: 'white', backgroundColor: 'transparent', cursor: 'pointer', marginTop: '0px', whiteSpace: 'nowrap' }}>{translations[language]?.view_more || 'View More'}</button>
                )}
                {albums.length > 0 && showAllAlbums && (
                  <button onClick={collapseAlbums} style={{ color: 'white', backgroundColor: 'transparent', cursor: 'pointer', marginTop: '0px', whiteSpace: 'nowrap' }}>{translations[language]?.collapse || 'Collapse'}</button>
                )}
              </div>
            </div>
            <div className="album-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'flex-start' }}>
              {(showAllAlbums ? albums : albums.slice(0, 7)).map((album, index) => (
                <div
                  key={index}
                  onClick={() => {
                    if (!checkLogin()) return;
                    console.log('HomeSection: Chọn album:', album.title);
                    setSelectedAlbum(album);
                  }}
                  style={{ width: '150px', cursor: checkLogin() ? 'pointer' : 'not-allowed', opacity: checkLogin() ? 1 : 0.5, position: 'relative' }}
                  onMouseEnter={(e) => { if (checkLogin()) { e.currentTarget.style.transform = 'scale(1.001)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.4)'; } }}
                  onMouseLeave={(e) => { if (checkLogin()) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; } }}
                >
                  <img src={album.cover || '/public/default_cover.png'} alt={album.title} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '12px', marginBottom: '10px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)' }} />
                  <button
                    className="play-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!checkLogin()) return;
                      console.log('HomeSection: Phát album:', album.title);
                      playAlbum(album, audioRef, setCurrentSong, setCurrentSongIndex, setPlaylist);
                      setSelectedAlbum(album);
                      if (album.songs?.length > 0) addSongToHistory(album.songs[0]);
                    }}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'rgba(0, 0, 0, 0%)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: checkLogin() ? 'pointer' : 'not-allowed',
                      opacity: checkLogin() ? 0 : 0.5,
                      transition: 'opacity 0.2s ease',
                    }}
                    onMouseEnter={(e) => { if (checkLogin()) e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { if (checkLogin()) e.currentTarget.style.opacity = '0'; }}
                  >
                    <i className="fa-solid fa-play" style={{ color: 'white', fontSize: '20px' }}></i>
                  </button>
                  <div style={{ color: 'white', textAlign: 'left', paddingLeft: '5px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{album.title}</div>
                    <div style={{ fontSize: '13px', color: '#bbbbbb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{album.artist}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="list">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="list-label">{translations[language]?.lists || 'Playlists'}</div>
              <div style={{ marginTop: '-130px', display: 'flex', justifyContent: 'flex-end', paddingLeft: '880px' }}>
                {list.length > 0 && !showAllList && (
                  <button onClick={viewAllList} style={{ color: 'white', backgroundColor: 'transparent', cursor: 'pointer', marginTop: '0px' }}>{translations[language]?.view_more || 'View More'}</button>
                )}
                {list.length > 0 && showAllList && (
                  <button onClick={collapseList} style={{ color: 'white', backgroundColor: 'transparent', cursor: 'pointer' }}>{translations[language]?.collapse || 'Collapse'}</button>
                )}
              </div>
            </div>
            <div className="album-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'flex-start', marginTop: '-45px' }}>
              {(showAllList ? list : list.slice(0, 7)).map((item, index) => (
                <div
                  key={index}
                  onClick={() => {
                    if (!checkLogin()) return;
                    console.log('HomeSection: Chọn danh sách:', item.title);
                    setSelectedAlbum(item);
                  }}
                  style={{ width: '150px', cursor: checkLogin() ? 'pointer' : 'not-allowed', opacity: checkLogin() ? 1 : 0.5, position: 'relative' }}
                  onMouseEnter={(e) => { if (checkLogin()) { e.currentTarget.style.transform = 'scale(1.001)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.4)'; } }}
                  onMouseLeave={(e) => { if (checkLogin()) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; } }}
                >
                  <img src={item.cover || '/public/default_cover.png'} alt={item.title} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '12px', marginBottom: '10px', marginTop: '20px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)' }} />
                  <button
                    className="play-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!checkLogin()) return;
                      console.log('HomeSection: Phát danh sách:', item.title);
                      playAlbum(item, audioRef, setCurrentSong, setCurrentSongIndex, setPlaylist);
                      setSelectedAlbum(item);
                      if (item.songs?.length > 0) addSongToHistory(item.songs[0]);
                    }}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'rgba(0, 0, 0, 0.6)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: checkLogin() ? 'pointer' : 'not-allowed',
                      opacity: checkLogin() ? 0 : 0.5,
                      transition: 'opacity 0.2s ease',
                    }}
                    onMouseEnter={(e) => { if (checkLogin()) e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { if (checkLogin()) e.currentTarget.style.opacity = '0'; }}
                  >
                    <i className="fa-solid fa-play" style={{ color: 'white', fontSize: '20px' }}></i>
                  </button>
                  <div style={{ color: 'white', textAlign: 'left', paddingLeft: '5px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                    <div style={{ fontSize: '13px', color: '#bbbbbb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.artist || ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="top-artists">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="top-artists-label">{translations[language]?.top_artists || 'Top Artists'}</div>
              <div style={{ marginTop: '-130px', display: 'flex', justifyContent: 'flex-end', paddingLeft: '850px' }}>
                {topArtists.length > 0 && !showAllArtists && (
                  <button onClick={viewAllArtists} style={{ color: 'white', backgroundColor: 'transparent', cursor: 'pointer', marginTop: '0px', whiteSpace: 'nowrap' }}>{translations[language]?.view_more || 'View More'}</button>
                )}
                {topArtists.length > 0 && showAllArtists && (
                  <button onClick={collapseArtists} style={{ color: 'white', backgroundColor: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap' }}>{translations[language]?.collapse || 'Collapse'}</button>
                )}
              </div>
            </div>
            <div className="album-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'flex-start', marginTop: '-45px' }}>
              {(showAllArtists ? topArtists : topArtists.slice(0, 7)).map((artist, index) => (
                <div
                  key={index}
                  onClick={() => {
                    if (!checkLogin()) return;
                    console.log('HomeSection: Chọn nghệ sĩ:', artist.artist);
                    setSelectedArtist(artist);
                    window.scrollTo(0, 0);
                  }}
                  style={{ width: '150px', cursor: checkLogin() ? 'pointer' : 'not-allowed', opacity: checkLogin() ? 1 : 0.5, position: 'relative' }}
                  onMouseEnter={(e) => { if (checkLogin()) { e.currentTarget.style.transform = 'scale(1.01)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.4)'; } }}
                  onMouseLeave={(e) => { if (checkLogin()) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; } }}
                >
                  <img src={artist.cover || '/public/default_cover.png'} alt={artist.artist} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '50%', marginBottom: '10px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)' }} />
                  <div style={{ color: 'white', textAlign: 'left', paddingLeft: '5px' }}>
                    <div style={{ fontSize: '16px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artist.artist}</div>
                    <div style={{ fontSize: '13px', color: '#bbbbbb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{translations[language]?.artist || 'Artist'}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="historylist">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'left' }}>
              <div className="historylist-label">{translations[language]?.recent_lists || 'Recent Playlists'}</div>
              <div style={{ marginTop: '-130px', display: 'flex', justifyContent: 'flex-end', paddingLeft: '680px' }}>
                {recentLists.length > 0 && !showAllRecentLists && (
                  <button onClick={viewAllRecentLists} style={{ color: 'white', backgroundColor: 'transparent', cursor: 'pointer', marginTop: '0px' }}>{translations[language]?.view_more || 'View More'}</button>
                )}
                {recentLists.length > 0 && showAllRecentLists && (
                  <button onClick={collapseRecentLists} style={{ color: 'white', backgroundColor: 'transparent', cursor: 'pointer' }}>{translations[language]?.collapse || 'Collapse'}</button>
                )}
              </div>
            </div>
            <div className="album-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'flex-start', marginTop: '-40px' }}>
              {recentLists.length === 0 ? (
                <p style={{ color: 'white' }}>{translations[language]?.no_recent_lists || 'No recent playlists'}</p>
              ) : (
                (showAllRecentLists ? recentLists : recentLists.slice(0, 7)).map((item, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      if (!checkLogin()) return;
                      console.log('HomeSection: Chọn danh sách gần đây:', item.title);
                      setSelectedAlbum(item);
                      setPlaylist(item.songs || []);
                      setCurrentSongIndex(0);
                      if (item.songs?.length > 0) {
                        const correctPath = item.songs[0].src?.startsWith('/') ? item.songs[0].src : `/${item.songs[0].src}`;
                        playAudio({ ...item.songs[0], file_path: correctPath }, audioRef, setCurrentSong);
                        addSongToHistory({ ...item.songs[0], file_path: correctPath });
                      }
                    }}
                    style={{ width: '150px', cursor: checkLogin() ? 'pointer' : 'not-allowed', opacity: checkLogin() ? 1 : 0.5, position: 'relative' }}
                    onMouseEnter={(e) => { if (checkLogin()) { e.currentTarget.style.transform = 'scale(1.001)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.4)'; } }}
                    onMouseLeave={(e) => { if (checkLogin()) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; } }}
                  >
                    <img src={item.cover || '/public/default_cover.png'} alt={item.title} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '12px', marginBottom: '10px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)' }} />
                    <div style={{ color: 'white', textAlign: 'left', paddingLeft: '5px' }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{item.title}</div>
                      <div style={{ fontSize: '13px', color: '#bbbbbb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                        {item.artist || ''} • {translations[language]?.songs_count?.replace('{count}', item.songs?.length || 0) || `${item.songs?.length || 0} songs`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
          <section className="historysongs">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="historysongs-label">{translations[language]?.recent_songs || 'Recent Songs'}</div>
              <div style={{ marginTop: '-130px', display: 'flex', justifyContent: 'flex-end', paddingLeft: '680px' }}>
                {recentSongs.length > 0 && !showAllRecentSongs && (
                  <button onClick={viewAllRecentSongs} style={{ color: 'white', backgroundColor: 'transparent', cursor: 'pointer', marginTop: '0px' }}>{translations[language]?.view_more || 'View More'}</button>
                )}
                {recentSongs.length > 0 && showAllRecentSongs && (
                  <button onClick={collapseRecentSongs} style={{ color: 'white', backgroundColor: 'transparent', cursor: 'pointer' }}>{translations[language]?.collapse || 'Collapse'}</button>
                )}
              </div>
            </div>
            <div className="album-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'flex-start', marginTop: '-50px' }}>
              {recentSongs.length === 0 ? (
                <p style={{ color: 'white' }}>{translations[language]?.no_recent_songs || 'No recent songs'}</p>
              ) : (
                (showAllRecentSongs ? recentSongs : recentSongs.slice(0, 7)).map((song, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      if (!checkLogin()) return;
                      console.log('HomeSection: Phát bài hát gần đây:', song.title);
                      setSelectedAlbum(null);
                      setPlaylist([song]);
                      setCurrentSongIndex(0);
                      const correctPath = song.file_path?.startsWith('/') ? song.file_path : `/${song.file_path}`;
                      playAudio({ ...song, file_path: correctPath }, audioRef, setCurrentSong);
                      addSongToHistory({ ...song, file_path: correctPath });
                    }}
                    style={{ width: '150px', cursor: checkLogin() ? 'pointer' : 'not-allowed', opacity: checkLogin() ? 1 : 0.5, position: 'relative' }}
                    onMouseEnter={(e) => { if (checkLogin()) { e.currentTarget.style.transform = 'scale(1.001)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.4)'; } }}
                    onMouseLeave={(e) => { if (checkLogin()) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; } }}
                  >
                    <img src={song.cover || '/public/default_cover.png'} alt={song.title} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '12px', marginBottom: '10px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)' }} />
                    <div style={{ color: 'white', textAlign: 'left', paddingLeft: '5px' }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{song.title}</div>
                      <div style={{ fontSize: '13px', color: '#bbbbbb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{song.artist}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
};

export default HomeSection;
