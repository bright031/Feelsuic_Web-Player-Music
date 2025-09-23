import React, { useState, useEffect } from 'react';
import { translations, currentLanguage } from '../translations';
import '~/style.css';

const Footer = () => {
  const [language, setLanguage] = useState(currentLanguage);

  useEffect(() => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && translations[savedLanguage]) {
      setLanguage(savedLanguage);
    }
  }, []);

  return (
    <footer>
      <h1>{translations[language].partners}</h1>
      <div className="partners-container">
        <div className="partner-card">
          <img src="/public/doitac1.png" alt="" className="partner-logo" />
        </div>
        <div className="partner-card">
          <img src="/public/doitac2.png" alt="" className="partner-logo" />
        </div>
        <div className="partner-card">
          <img src="/public/doitacnhaccuatui.png" alt="" className="partner-logo" />
        </div>
        <div className="partner-card">
          <img src="/public/doitac4.png" alt="" className="partner-logo" />
        </div>
        <div className="partner-card">
          <img src="/public/doitac5.png" alt="" className="partner-logo" />
        </div>
        <div className="partner-card">
          <img src="/public/doitacspotify.jpg" alt="" className="partner-logo" />
        </div>
        <div className="partner-card">
          <img src="/public/doitac7.png" alt="" className="partner-logo" />
        </div>
        <div className="partner-card">
          <img src="/public/doitac8.png" alt="" className="partner-logo" />
        </div>
        <div className="partner-card">
          <img src="/public/doitac9.png" alt="" className="partner-logo" />
        </div>
        <div className="partner-card">
          <img src="/public/doitac10.png" alt="" className="partner-logo" />
        </div>
      </div>
      <div className="footer-links-container">
        <div className="footer-links-row">
          <a
            href="https://www.spotify.com/vn-vi/legal/privacy-policy/"
            target="_blank"
            rel="noopener"
          >
            {translations[language].privacy_policy}
          </a>
          <a
            href="https://www.spotify.com/vn-vi/legal/cookies-policy/"
            target="_blank"
            rel="noopener"
          >
            {translations[language].cookies}
          </a>
          <a
            href="https://www.spotify.com/vn-vi/safetyandprivacy/"
            target="_blank"
            rel="noopener"
          >
            {translations[language].safety_center}
          </a>
        </div>
        <div className="footer-links-row">
          <a
            href="https://www.spotify.com/vn-vi/legal/terms-of-use/"
            target="_blank"
            rel="noopener"
          >
            {translations[language].terms_of_use}
          </a>
          <a
            href="https://www.spotify.com/vn-vi/legal/end-user-agreement/"
            target="_blank"
            rel="noopener"
          >
            {translations[language].legal}
          </a>
          <a
            href="https://www.spotify.com/vn-vi/help/"
            target="_blank"
            rel="noopener"
          >
            {translations[language].support}
          </a>
        </div>
      </div>
      <div className="social-icons">
        <a href="https://www.facebook.com/shars171003/" target="_blank" rel="noopener">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg"
            alt="Facebook"
            className="social-icon"
          />
        </a>
        <a href="https://www.instagram.com/shar_s17/e" target="_blank" rel="noopener">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Instagram_logo_2022.svg/512px-Instagram_logo_2022.svg.png"
            alt="Instagram"
            className="social-icon"
          />
        </a>
        <a href="https://github.com/bright031" target="_blank" rel="noopener">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/9/91/Octicons-mark-github.svg"
            alt="GitHub"
            className="social-icon"
          />
        </a>
      </div>
      <p>{translations[language].copyright}</p>
    </footer>
  );
};

export default Footer;