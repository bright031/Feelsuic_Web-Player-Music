import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { translations, currentLanguage } from '../translations';
import '~/style.css';

const ProfilePage = ({ isLoggedIn = false, setIsLoggedIn = () => {}, setUsername = () => {} }) => {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState({ username: '', email: '', phone: '' });
  const [error, setError] = useState('');
  const [hoveredBtn, setHoveredBtn] = useState(null);
  const [showContent, setShowContent] = useState({
    privacy: false,
    loginHistory: false,
    musicHistory: false,
    changePassword: false,
    changeEmail: false,
  });
  const [loginHistory, setLoginHistory] = useState([]);
  const [musicHistory, setMusicHistory] = useState([]);
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [formError, setFormError] = useState('');
  const [language, setLanguage] = useState(currentLanguage);

  useEffect(() => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && translations[savedLanguage]) {
      setLanguage(savedLanguage);
    }
  }, []);

  const fetchUserInfo = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId || userId === 'null' || userId === 'undefined') {
      setError(translations[language].fetch_user_error);
      navigate('/login');
      return;
    }
    try {
      const response = await axios.get(`http://127.0.0.1:8001/api/user/${userId}`);
      setUserInfo({
        username: response.data.username || translations[language].not_updated,
        email: response.data.email || translations[language].not_updated,
        phone: response.data.phone || translations[language].not_updated,
      });
      setUsername(response.data.username || '');
    } catch (err) {
      setError(err.response?.data?.error || translations[language].fetch_user_error);
    }
  };

  const fetchLoginHistory = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId || userId === 'null' || userId === 'undefined') {
      setError(translations[language].fetch_user_error);
      return;
    }
    try {
      const response = await axios.get(`http://127.0.0.1:8001/api/login-history/${userId}`);
      setLoginHistory(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || translations[language].fetch_login_history_error);
    }
  };

  const fetchMusicHistory = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId || userId === 'null' || userId === 'undefined') {
      setError(translations[language].fetch_user_error);
      return;
    }
    try {
      const response = await axios.get(`http://127.0.0.1:8001/api/music-history/${userId}`);
      setMusicHistory(response.data.data.songs || []);
    } catch (err) {
      setError(err.response?.data?.error || translations[language].fetch_music_history_error);
    }
  };

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setFormError(translations[language].password_too_short);
      return;
    }
    const userId = localStorage.getItem('userId');
    try {
      await axios.put(`http://127.0.0.1:8001/api/update_user/${userId}`, { password: newPassword });
      setNewPassword('');
      alert(translations[language].password_changed);
      setFormError('');
    } catch (err) {
      setFormError(err.response?.data?.error || translations[language].change_password_error);
    }
  };

  const changeEmail = async () => {
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setFormError(translations[language].invalid_email);
      return;
    }
    const userId = localStorage.getItem('userId');
    try {
      const response = await axios.put(`http://127.0.0.1:8001/api/update_user/${userId}`, { email: newEmail });
      setUserInfo((prev) => ({ ...prev, email: response.data.email }));
      setNewEmail('');
      alert(translations[language].email_changed);
      setFormError('');
    } catch (err) {
      setFormError(err.response?.data?.error || translations[language].change_email_error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    setIsLoggedIn(false);
    setUsername('');
    navigate('/login');
  };

  const toggleContent = (section) => {
    setShowContent((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
    if (section === 'loginHistory' && !showContent.loginHistory) {
      fetchLoginHistory();
    }
    if (section === 'musicHistory' && !showContent.musicHistory) {
      fetchMusicHistory();
    }
    if (section === 'changePassword' || section === 'changeEmail') {
      setFormError('');
    }
  };

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId || userId === 'null' || userId === 'undefined') {
      navigate('/login');
    } else {
      fetchUserInfo();
    }
  }, [isLoggedIn, navigate, language]);

  const getButtonStyle = (id) => ({
    backgroundColor: '#1a1a1a',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'block',
    width: '100%',
    padding: '10px 10px',
    textAlign: 'left',
    transition: 'opacity 0.3s',
    opacity: hoveredBtn === id ? 0.2 : 1,
  });

  return (
    <div
      className="profile-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#392929',
        padding: '20px',
        margin: '0',
        position: 'fixed',
        top: 0,
        left: 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Thẻ chứa thông tin tài khoản */}
      <div
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
          padding: '20px',
          maxWidth: '800px',
          width: '100%',
          color: 'white',
          marginTop: '60px',
        }}
      >
        <h2 style={{ marginBottom: '10px', fontSize: '24px', textAlign: 'left' }}>
          {translations[language].profile_title}
        </h2>
        <table style={{ width: '100%', fontSize: '14px', padding: '0 10px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px 0', fontWeight: 'bold' }}>{translations[language].username_label}</td>
              <td>{userInfo.username}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', fontWeight: 'bold' }}>{translations[language].email_label}</td>
              <td>{userInfo.email}</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 0', fontWeight: 'bold' }}>{translations[language].phone_label}</td>
              <td>{userInfo.phone}</td>
            </tr>
          </tbody>
        </table>
        {error && <p style={{ color: '#ff4d4f', marginTop: '10px' }}>{error}</p>}
      </div>

      {/* Khung VIP */}
      <div
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
          padding: '20px',
          maxWidth: '800px',
          width: '100%',
          color: 'white',
          marginTop: '20px',
        }}
      >
        <h3 style={{ marginBottom: '10px', fontSize: '24px', textAlign: 'left' }}>
          {translations[language].vip_title}
        </h3>
        {[
          { label: translations[language].premium_label, path: '/', id: 'premium' },
          { label: translations[language].purchase_history_label, path: '/', id: 'list-buy' },
        ].map(({ label, path, id }) => (
          <button
            key={id}
            onClick={() => navigate(path)}
            onMouseEnter={() => setHoveredBtn(id)}
            onMouseLeave={() => setHoveredBtn(null)}
            style={getButtonStyle(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Khung Bảo mật & quyền riêng tư */}
      <div
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
          padding: '20px',
          maxWidth: '800px',
          width: '100%',
          color: 'white',
          marginTop: '20px',
        }}
      >
        <h3 style={{ marginBottom: '10px', fontSize: '24px', textAlign: 'left' }}>
          {translations[language].privacy_security_title}
        </h3>
        <div>
          <button
            onClick={() => toggleContent('privacy')}
            onMouseEnter={() => setHoveredBtn('private')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={getButtonStyle('private')}
          >
            {translations[language].privacy_label}
          </button>
          {showContent.privacy && (
            <div style={{ padding: '10px', fontSize: '14px' }}>
              <p>{translations[language].privacy_content}</p>
            </div>
          )}

          <button
            onClick={() => toggleContent('loginHistory')}
            onMouseEnter={() => setHoveredBtn('login-history')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={getButtonStyle('login-history')}
          >
            {translations[language].login_history_label}
          </button>
          {showContent.loginHistory && (
            <div style={{ padding: '10px', fontSize: '14px' }}>
              {loginHistory.length > 0 ? (
                <ul style={{ listStyle: 'none' }}>
                  {loginHistory.map((entry, index) => (
                    <li key={index} style={{ marginBottom: '5px' }}>
                      {new Date(entry.timestamp).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} - {entry.device}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{translations[language].no_login_history}</p>
              )}
            </div>
          )}

          <button
            onClick={() => toggleContent('musicHistory')}
            onMouseEnter={() => setHoveredBtn('music-history')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={getButtonStyle('music-history')}
          >
            {translations[language].music_history_label}
          </button>
          {showContent.musicHistory && (
            <div style={{ padding: '10px', fontSize: '14px' }}>
              {musicHistory.length > 0 ? (
                <ul style={{ listStyle: 'none' }}>
                  {musicHistory.map((song, index) => (
                    <li key={index} style={{ marginBottom: '5px' }}>
                      {song.title} - {song.artist} -{' '}
                      {new Date(song.listenedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{translations[language].no_music_history}</p>
              )}
            </div>
          )}

          <button
            onClick={() => toggleContent('changePassword')}
            onMouseEnter={() => setHoveredBtn('change-password')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={getButtonStyle('change-password')}
          >
            {translations[language].change_password_label}
          </button>
          {showContent.changePassword && (
            <div style={{ padding: '10px' }}>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={translations[language].new_password_placeholder}
                style={{
                  padding: '8px',
                  width: '100%',
                  marginBottom: '10px',
                  borderRadius: '8px',
                  border: '1px solid #444',
                  backgroundColor: '#2a2a2a',
                  color: 'white',
                }}
              />
              <button
                onClick={changePassword}
                style={getButtonStyle('save-password')}
              >
                {translations[language].save_password_button}
              </button>
            </div>
          )}

          <button
            onClick={() => toggleContent('changeEmail')}
            onMouseEnter={() => setHoveredBtn('change-gmail')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={getButtonStyle('change-gmail')}
          >
            {translations[language].change_email_label}
          </button>
          {showContent.changeEmail && (
            <div style={{ padding: '10px' }}>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={translations[language].new_email_placeholder}
                style={{
                  padding: '8px',
                  width: '100%',
                  marginBottom: '10px',
                  borderRadius: '8px',
                  border: '1px solid #444',
                  backgroundColor: '#2a2a2a',
                  color: 'white',
                }}
              />
              <button
                onClick={changeEmail}
                style={getButtonStyle('save-email')}
              >
                {translations[language].save_email_button}
              </button>
            </div>
          )}
          {formError && <p style={{ color: '#ff4d4f', marginTop: '10px' }}>{formError}</p>}
        </div>
      </div>

      {/* Khung Trợ giúp */}
      <div
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
          padding: '20px',
          maxWidth: '800px',
          width: '100%',
          color: 'white',
          marginTop: '20px',
        }}
      >
        <h3 style={{ marginBottom: '10px', fontSize: '24px', textAlign: 'left' }}>
          {translations[language].help_title}
        </h3>
        <button
          onClick={() => navigate('/helper')}
          onMouseEnter={() => setHoveredBtn('helper')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={getButtonStyle('helper')}
        >
          {translations[language].support_label}
        </button>
      </div>

      {/* Nút đăng xuất */}
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button
          onClick={handleLogout}
          onMouseEnter={() => setHoveredBtn('logout')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={{
            ...getButtonStyle('logout'),
            borderRadius: '20px',
            textAlign: 'center',
            width: 'fit-content',
            padding: '8px 20px',
            margin: 'auto',
            backgroundColor: 'black',
          }}
        >
          {translations[language].logout_button}
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;