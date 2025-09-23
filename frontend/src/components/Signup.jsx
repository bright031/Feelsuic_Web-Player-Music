import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { translations, currentLanguage } from '../translations';

function Signup() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState(currentLanguage);
  const navigate = useNavigate();

  useEffect(() => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && translations[savedLanguage]) {
      setLanguage(savedLanguage);
    }
  }, []);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert(translations[language].password_mismatch);
      return;
    }
    try {
      console.log('Sending signup request:', { username, email, password, phone });
      const response = await axios.post('http://127.0.0.1:8001/api/register', {
        username,
        password,
        email,
        phone,
      });
      console.log('Signup response:', response.data);
      const { userId, username: responseUsername } = response.data;
      if (!userId || userId === 'null' || userId === 'undefined') {
        throw new Error(`Invalid userId received: ${userId}`);
      }
      if (!responseUsername) {
        throw new Error('Username not received in response');
      }
      localStorage.setItem('userId', userId);
      localStorage.setItem('username', responseUsername);
      console.log('Stored in localStorage:', { userId, username: responseUsername });
      alert(translations[language].signup_success);
      navigate('/login');
    } catch (error) {
      console.error('Signup error:', error.response?.data || error.message);
      alert(translations[language].signup_failed + (error.response?.data?.message || error.message));
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
    overflowY: 'auto',
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
    marginTop: '170px',
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
        <h2 style={{ marginBottom: '20px', fontSize: '24px' }}>{translations[language].signup_title}</h2>
        <form onSubmit={handleSignup}>
          <div style={inputGroupStyle}>
            <input
              style={inputStyle}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={translations[language].username_placeholder}
              required
            />
          </div>
          <div style={inputGroupStyle}>
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={translations[language].email_placeholder}
              required
            />
          </div>
          <div style={inputGroupStyle}>
            <input
              style={inputStyle}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={translations[language].phone_placeholder}
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
          <div style={inputGroupStyle}>
            <input
              style={inputStyle}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={translations[language].confirm_password_placeholder}
              required
            />
          </div>
          <button type="submit" style={loginBtnStyle}>{translations[language].signup_button}</button>
        </form>
        <p
          style={signupLinkStyle}
          dangerouslySetInnerHTML={{ __html: translations[language].login_link + ' | ' + translations[language].forgot_password }}
        />
      </div>
    </div>
  );
};

export default Signup;