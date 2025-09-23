import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { translations, currentLanguage, changeLanguage } from '../translations';
import '~/style.css';

const Header = ({
  searchQuery,
  setSearchQuery,
  isLoggedIn,
  username,
  setIsLoggedIn,
  setUsername,
  loadSection,
  setSearchResults,
  setSelectedGenre,
  setSelectedArtist,
  setSelectedAlbum,
}) => {
  const [language, setLanguage] = useState(currentLanguage);
  const userAccountRef = useRef(null);
  const searchRef = useRef(null);
  const genreRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [localSearchResults, setLocalSearchResults] = useState([]);
  const navigate = useNavigate();
  const debounceTimeout = useRef(null);

  const genres = ['Rap', 'Pop', 'R&B', 'Indie', 'Ballad', 'Citypop', 'Rock'];

  // Debug props
  useEffect(() => {
    console.debug('Debug Header: Khởi tạo với props', {
      isLoggedIn,
      username,
      searchQuery,
      setSelectedGenre: typeof setSelectedGenre,
      setSelectedArtist: typeof setSelectedArtist,
      setSelectedAlbum: typeof setSelectedAlbum,
    });
  }, []);

  // Xử lý nhấp vào Trang chủ
  const handleHomeClick = () => {
    console.debug('Debug Header: Nhấp vào Trang chủ');
    navigate('/');
    loadSection('home');
    setSearchResults([]);
    if (typeof setSelectedGenre === 'function') {
      setSelectedGenre(null);
      console.debug('Debug Header: Đã reset selectedGenre');
    }
    if (typeof setSelectedArtist === 'function') {
      setSelectedArtist(null);
      console.debug('Debug Header: Đã reset selectedArtist');
    }
    if (typeof setSelectedAlbum === 'function') {
      setSelectedAlbum(null);
      console.debug('Debug Header: Đã reset selectedAlbum');
    }
    console.debug('Debug Header: Đã reset trạng thái và điều hướng về trang chủ');
  };

  // Xử lý tìm kiếm với debounce
  const handleSearch = (query, immediate = false) => {
    setSearchQuery(query);
    if (!isLoggedIn || query.trim() === '') {
      setLocalSearchResults([]);
      setSearchResults([]);
      setShowSearchResults(false);
      console.debug('Debug Header: Không tìm kiếm (chưa đăng nhập hoặc query rỗng)', { isLoggedIn, query });
      return;
    }

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    const performSearch = async () => {
      try {
        console.debug(`Debug Header: Gửi yêu cầu tìm kiếm với query "${query}"`);
        const response = await fetch(
          `http://localhost:8001/api/search?query=${encodeURIComponent(query)}`,
          { headers: { 'Content-Type': 'application/json' } }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        const results = data.data || [];
        setLocalSearchResults(results);
        setSearchResults(results);
        setShowSearchResults(results.length > 0);
        console.debug(`Debug Header: Tìm kiếm thành công, ${results.length} kết quả`, results);
      } catch (error) {
        console.error('Debug Header: Lỗi tìm kiếm:', error.message);
        setLocalSearchResults([]);
        setSearchResults([]);
        setShowSearchResults(false);
      }
    };

    if (immediate) {
      performSearch();
    } else {
      debounceTimeout.current = setTimeout(performSearch, 300);
    }
  };

  // Xử lý phím Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      console.debug('Debug Header: Nhấn Enter với query:', searchQuery);
      handleSearch(searchQuery, true);
    }
  };

  // Toggle dropdown tài khoản
  const toggleDropdown = () => {
    console.debug('Debug Header: Toggle dropdown tài khoản, trạng thái:', showDropdown);
    setShowDropdown((prev) => !prev);
    setShowGenreDropdown(false);
  };

  // Toggle dropdown thể loại
  const toggleGenreDropdown = () => {
    if (!isLoggedIn) {
      console.debug('Debug Header: Không mở dropdown thể loại, chưa đăng nhập');
      return;
    }
    console.debug('Debug Header: Toggle dropdown thể loại, trạng thái:', showGenreDropdown);
    setShowGenreDropdown((prev) => !prev);
    setShowDropdown(false);
  };

  // Xử lý chọn thể loại
  const handleGenreSelect = (genre) => {
    if (typeof setSelectedGenre !== 'function') {
      console.error('Debug Header: setSelectedGenre không phải hàm', { setSelectedGenre });
      return;
    }
    console.debug(`Debug Header: Chọn thể loại: ${genre}`);
    setSelectedGenre(genre);
    setSelectedArtist(null);
    setSelectedAlbum(null);
    setShowGenreDropdown(false);
    setSearchResults([]);
    setSearchQuery('');
    navigate('/');
    console.debug('Debug Header: Sau khi chọn thể loại, điều hướng về trang chủ và reset trạng thái');
  };

  // Xử lý đăng xuất
  const handleLogout = () => {
    console.debug('Debug Header: Đăng xuất');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    setIsLoggedIn(false);
    setUsername('');
    setShowDropdown(false);
    setSelectedGenre(null);
    setSelectedArtist(null);
    setSelectedAlbum(null);
    navigate('/');
    console.debug('Debug Header: Đăng xuất hoàn tất, điều hướng về trang chủ');
  };

  // Xử lý thay đổi ngôn ngữ
const handleToggleLanguage = () => {
  const newLang = language === 'vi' ? 'en' : 'vi';
  changeLanguage(newLang);
  setLanguage(newLang);
  localStorage.setItem('language', newLang);
  console.debug(`Debug Header: Thay đổi ngôn ngữ: ${newLang}, đang reload trang`);
  window.location.reload();
};

  // Khôi phục ngôn ngữ từ localStorage
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && translations[savedLanguage]) {
      setLanguage(savedLanguage);
      changeLanguage(savedLanguage);
    }
  }, []);

  // Xử lý nhấp ngoài dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        userAccountRef.current &&
        !event.target.closest('.user-account') &&
        searchRef.current &&
        !event.target.closest('.search') &&
        genreRef.current &&
        !event.target.closest('.genre-nav')
      ) {
        console.debug('Debug Header: Nhấp ngoài, đóng tất cả dropdown');
        setShowDropdown(false);
        setShowSearchResults(false);
        setShowGenreDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, []);

  // Vị trí dropdown
  const dropdownPosition = userAccountRef.current?.getBoundingClientRect() || { bottom: 0, left: 0 };
  const searchPosition = searchRef.current?.getBoundingClientRect() || { bottom: 0, left: 0 };
  const genrePosition = genreRef.current?.getBoundingClientRect() || { bottom: 0, left: 0 };

  // Dropdown tài khoản
  const dropdownMenu = showDropdown && (
    <div
      className="dropdown-menu"
      style={{
        position: 'fixed',
        top: `${dropdownPosition.bottom}px`,
        left: `${dropdownPosition.left - 30}px`,
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
        minWidth: '150px',
        zIndex: 100000,
        padding: '5px 0',
      }}
    >
      <a
        href="#"
        onClick={() => {
          console.debug('Debug Header: Điều hướng /profile');
          navigate('/profile');
          setShowDropdown(false);
        }}
        style={{ display: 'block', padding: '10px 15px', color: 'white', textDecoration: 'none', fontSize: '14px' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        {translations[language].profile}
      </a>
      <a
        href="#"
        onClick={() => {
          console.debug('Debug Header: Điều hướng /helper');
          navigate('/helper');
          setShowDropdown(false);
        }}
        style={{ display: 'block', padding: '10px 15px', color: 'white', textDecoration: 'none', fontSize: '14px' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        {translations[language].support}
      </a>
      <a
        href="#"
        onClick={() => {
          console.debug('Debug Header: Điều hướng /aboutus');
          navigate('/aboutus');
          setShowDropdown(false);
        }}
        style={{ display: 'block', padding: '10px 15px', color: 'white', textDecoration: 'none', fontSize: '14px' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        {translations[language].about}
      </a>
      <a
        href="#"
        onClick={() => {
          console.debug('Debug Header: Đăng xuất từ dropdown');
          handleLogout();
        }}
        style={{ display: 'block', padding: '10px 15px', color: 'white', textDecoration: 'none', fontSize: '14px' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        {translations[language].logout}
      </a>
    </div>
  );

  // Dropdown kết quả tìm kiếm
  const searchResultsDropdown = showSearchResults && localSearchResults.length > 0 && (
    <div
      className="search-results-dropdown"
      style={{
        position: 'fixed',
        top: `${searchPosition.bottom}px`,
        left: `${searchPosition.left}px`,
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
        minWidth: `${searchPosition.width}px`,
        maxHeight: '300px',
        overflowY: 'auto',
        zIndex: 100000,
        padding: '5px 0',
      }}
    >
      {localSearchResults.map((item) => (
        <a
          key={item._id}
          href="#"
          onClick={() => {
            console.debug(`Debug Header: Điều hướng ${item.type}: ${item.name}`);
            navigate(`/${item.type}/${item._id}`);
            setShowSearchResults(false);
            setSearchQuery('');
            setSearchResults([]);
          }}
          style={{ display: 'block', padding: '10px 15px', color: 'white', textDecoration: 'none', fontSize: '14px' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          {item.name}
        </a>
      ))}
    </div>
  );

  // Dropdown thể loại
  const genreDropdown = showGenreDropdown && (
    <div
      className="genre-dropdown"
      style={{
        position: 'fixed',
        top: `${genrePosition.bottom}px`,
        left: `${genrePosition.left}px`,
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
        minWidth: '150px',
        zIndex: 100000,
        padding: '5px 0',
      }}
    >
      {genres.map((genre) => (
        <a
          key={genre}
          href="#"
          onClick={() => {
            console.debug(`Debug Header: Nhấp vào thể loại: ${genre}`);
            handleGenreSelect(genre);
          }}
          style={{ display: 'block', padding: '10px 15px', color: 'white', textDecoration: 'none', fontSize: '14px' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          {genre}
        </a>
      ))}
    </div>
  );

  return (
    <header>
      <div
        className="logo"
        onClick={handleHomeClick}
      >
        <img src="/public/logo.png" alt={translations[language].logo_alt} />
      </div>
      <div className="search" ref={searchRef}>
        <input
          type="text"
          id="search-input-header"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={translations[language].searchPlaceholder}
          disabled={!isLoggedIn}
        />
      </div>
      <div className="nav-links">
        <a href="#" onClick={handleHomeClick}>
          {translations[language].home}
        </a>
        <a
          href="#"
          onClick={() => {
            if (isLoggedIn) {
              console.debug('Debug Header: Điều hướng /aboutus');
              navigate('/aboutus');
              setSearchResults([]);
              if (typeof setSelectedGenre === 'function') {
                setSelectedGenre(null);
                console.debug('Debug Header: Đã reset selectedGenre');
              }
              if (typeof setSelectedArtist === 'function') {
                setSelectedArtist(null);
                console.debug('Debug Header: Đã reset selectedArtist');
              }
              if (typeof setSelectedAlbum === 'function') {
                setSelectedAlbum(null);
                console.debug('Debug Header: Đã reset selectedAlbum');
              }
            }
          }}
        >
          {translations[language].about}
        </a>
        <div className="genre-nav" ref={genreRef}>
          <a href="#" onClick={toggleGenreDropdown}>
            {translations[language].genres}
          </a>
        </div>
      </div>
      <div className="language-switcher">
        <div
          className="language-btn"
          onClick={handleToggleLanguage}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '-5px' }}
        >
          <i className="fa fa-globe"></i>
          <span id="current-lang">
            {language === 'vi' ? translations[language].language_vietnamese : translations[language].language_english}
          </span>
        </div>
      </div>
      <div className="header-buttons" style={{ display: 'flex', gap: '10px', marginLeft: 'auto', position: 'relative' }}>
        {isLoggedIn ? (
          <div className="user-account" ref={userAccountRef}>
            <button
              style={{
                padding: '8px',
                color: 'white',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                zIndex: 99999,
              }}
              onClick={toggleDropdown}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <i className="fa-solid fa-user" style={{ fontSize: '18px' }}></i>
              <span>{username || translations[language].account}</span>
            </button>
          </div>
        ) : (
          <>
            <button
              style={{
                padding: '5px 15px',
                color: 'white',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                marginLeft: '10px',
              }}
              onClick={() => navigate('/signup')}
            >
              {translations[language].signup}
            </button>
            <button
              style={{
                padding: '8px 15px',
                color: 'black',
                backgroundColor: 'white',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '18px',
                border: 'none',
              }}
              onClick={() => navigate('/login')}
            >
              {translations[language].login}
            </button>
          </>
        )}
      </div>
      {ReactDOM.createPortal(dropdownMenu, document.body)}
      {ReactDOM.createPortal(searchResultsDropdown, document.body)}
      {ReactDOM.createPortal(genreDropdown, document.body)}
    </header>
  );
};

export default Header;