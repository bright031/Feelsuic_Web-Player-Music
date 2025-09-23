import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { translations, currentLanguage } from '../translations';
import '~/style.css';

const AboutUs = () => {
  const navigate = useNavigate();
  const [language, setLanguage] = useState(currentLanguage);

  useEffect(() => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && translations[savedLanguage]) {
      setLanguage(savedLanguage);
    }
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'white',
        color: 'black',
        padding: '70px 20px',
        textAlign: 'center',
        margin: 0,
        overflowY: 'auto',
      }}
    >
      <h1 style={{ fontSize: '36px', color: 'black', marginBottom: '20px' }}>
        {translations[language].about_title}
      </h1>

      <div style={{ maxWidth: '800px', textAlign: 'justify' }}>
        <p
          style={{ fontSize: '18px', lineHeight: '1.6', marginBottom: '24px' }}
          dangerouslySetInnerHTML={{ __html: translations[language].about_description_1 }}
        />
        <p
          style={{ fontSize: '18px', lineHeight: '1.6', marginBottom: '24px' }}
          dangerouslySetInnerHTML={{ __html: translations[language].about_description_2 }}
        />
        <p
          style={{ fontSize: '18px', lineHeight: '1.6', marginBottom: '32px' }}
          dangerouslySetInnerHTML={{ __html: translations[language].about_description_3 }}
        />

        <div style={{ marginTop: '40px', borderTop: '1px solid #ccc', paddingTop: '30px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '15px' }}>
            {translations[language].address_title}
          </h2>
          <p
            style={{ fontSize: '16px', lineHeight: '1.6', marginBottom: '10px' }}
            dangerouslySetInnerHTML={{ __html: translations[language].address_content }}
          />
        </div>
      </div>

      <button
        style={{
          padding: '10px 20px',
          backgroundColor: 'black',
          color: 'white',
          border: 'none',
          borderRadius: '16px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          marginTop: '30px',
          transition: 'background-color 0.3s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'black')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'black')}
        onClick={() => navigate('/')}
      >
        {translations[language].back_button}
      </button>
    </div>
  );
};

export default AboutUs;