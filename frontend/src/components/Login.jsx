import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { translations, currentLanguage } from '../translations';

function Login({ setIsLoggedIn, setUsername }) {
  const [localUsername, setLocalUsername] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState(currentLanguage);
  const navigate = useNavigate();

  useEffect(() => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && translations[savedLanguage]) {
      setLanguage(savedLanguage);
    }
  }, []);

  console.log('Login: setIsLoggedIn type:', typeof setIsLoggedIn, 'value:', setIsLoggedIn);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001'; // Fallback cho local
    console.log('Login: Sending login request:', { username: localUsername, password });
    const response = await axios.post(`${apiUrl}/api/login`, {
      username: localUsername,
      password,
    });
      console.log('Login: Response:', response.data);
      const { userId, username: responseUsername } = response.data;
      if (!userId || userId === 'null' || userId === 'undefined') {
        throw new Error(`Login: Invalid userId received: ${userId}`);
      }
      if (!responseUsername) {
        throw new Error('Login: Username not received in response');
      }
      localStorage.setItem('userId', userId);
      localStorage.setItem('username', responseUsername);
      if (typeof setIsLoggedIn === 'function') {
        setIsLoggedIn(true);
      } else {
        console.error('Login: setIsLoggedIn is not a function:', setIsLoggedIn);
      }
      if (typeof setUsername === 'function') {
        setUsername(responseUsername);
      } else {
        console.error('Login: setUsername is not a function:', setUsername);
      }
      console.log('Login: Stored in localStorage:', { userId, username: responseUsername });
      alert(translations[language].login_success);
      navigate('/');
    } catch (error) {
      console.error('Login: Error:', error.response?.data || error.message);
      alert(translations[language].login_failed + (error.response?.data?.message || error.message));
    }
  };

  const loginContainerStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100vw',
    height: '100vh',
    backgroundColor: '#414141',
    padding: '20px',
    margin: '0',
    position: 'fixed',
    top: 0,
    left: 0,
  };

  const loginBoxStyle = {
    backgroundColor: '#121212',
    padding: '40px',
    borderRadius: '10px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
    color: '#fff',
  };

  const loginLogoStyle = {
    maxWidth: '150px',
    marginBottom: '20px',
  };

  const inputGroupStyle = {
    marginBottom: '15px',
    textAlign: 'left',
  };

  const inputStyle = {
    width: '100%',
    padding: '10px',
    border: '1px solid #333',
    borderRadius: '4px',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '16px',
  };

  const loginBtnStyle = {
    width: '100%',
    padding: '12px',
    backgroundColor: 'white',
    color: 'black',
    border: 'none',
    borderRadius: '20px',
    fontSize: '16px',
    cursor: 'pointer',
  };

  const signupLinkStyle = {
    marginTop: '15px',
    color: '#b3b3b3',
  };

  return (
    <div style={loginContainerStyle}>
      <div style={loginBoxStyle}>
        <img src="/public/logo.png" alt={translations[language].logo_alt} style={loginLogoStyle} />
        <h2 style={{ marginBottom: '20px', fontSize: '24px' }}>{translations[language].login_title}</h2>
        <form onSubmit={handleLogin}>
          <div style={inputGroupStyle}>
            <input
              style={inputStyle}
              type="text"
              value={localUsername}
              onChange={(e) => setLocalUsername(e.target.value)}
              placeholder={translations[language].username_placeholder}
              required
            />
          </div>
          <div style={inputGroupStyle}>
            <input
              style={inputStyle}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={translations[language].password_placeholder}
              required
            />
          </div>
          <button type="submit" style={loginBtnStyle}>{translations[language].login_button}</button>
        </form>
        <p
          style={signupLinkStyle}
          dangerouslySetInnerHTML={{ __html: translations[language].signup_link + ' | ' + translations[language].forgot_password }}
        />
      </div>
    </div>
  );
};

export default Login;