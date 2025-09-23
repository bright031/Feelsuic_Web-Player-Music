import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { translations, currentLanguage } from '../translations';

const supportData = [
  {
    titleKey: 'account_management',
    contentKey: 'account_management_content',
  },
  {
    titleKey: 'app_features',
    contentKey: '',
    isExpandable: true,
    subItems: [
      { titleKey: 'getting_started', contentKey: 'getting_started_content' },
      { titleKey: 'app_setup', contentKey: 'app_setup_content' },
      { titleKey: 'troubleshooting', contentKey: 'troubleshooting_content' },
      { titleKey: 'playlist', contentKey: 'playlist_content' },
      { titleKey: 'webcam', contentKey: 'webcam_content' },
      { titleKey: 'social_features', contentKey: 'social_features_content' },
      { titleKey: 'privacy_settings', contentKey: 'privacy_settings_content' },
    ],
  },
  {
    titleKey: 'device_troubleshooting',
    contentKey: 'device_troubleshooting_content',
  },
];

const Helper = () => {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(null);
  const [openSubIndex, setOpenSubIndex] = useState(null);
  const [language, setLanguage] = useState(currentLanguage);

  useEffect(() => {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && translations[savedLanguage]) {
      setLanguage(savedLanguage);
    }
  }, []);

  const handleToggle = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
    setOpenSubIndex(null);
  };

  const handleSubToggle = (subIndex) => {
    setOpenSubIndex(openSubIndex === subIndex ? null : subIndex);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#121212',
        color: 'white',
        padding: '70px 40px',
        overflowY: 'auto',
        fontFamily: 'sans-serif',
      }}
    >
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '30px' }}>
        {translations[language].support_title}
      </h1>

      {supportData.map((item, index) => (
        <div
          key={index}
          onClick={() => handleToggle(index)}
          style={{
            width: '100%',
            padding: '20px',
            backgroundColor: '#1e1e1e',
            marginBottom: '10px',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <strong style={{ fontSize: '16px' }}>{translations[language][item.titleKey]}</strong>
            <span style={{ marginLeft: 'auto' }}>{activeIndex === index ? '▲' : '▼'}</span>
          </div>

          {activeIndex === index && (
            <div style={{ marginTop: '10px', fontSize: '14px', color: '#ccc' }}>
              {item.isExpandable ? (
                <div style={{ marginLeft: '14px' }}>
                  {item.subItems.map((sub, subIdx) => (
                    <div
                      key={subIdx}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSubToggle(subIdx);
                      }}
                      style={{
                        backgroundColor: '#292929',
                        padding: '12px',
                        borderRadius: '6px',
                        marginBottom: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{translations[language][sub.titleKey]}</strong>
                        <span>{openSubIndex === subIdx ? '▲' : '▼'}</span>
                      </div>
                      {openSubIndex === subIdx && (
                        <p style={{ marginTop: '6px', color: '#aaa' }}>
                          {translations[language][sub.contentKey]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p>{translations[language][item.contentKey]}</p>
              )}
            </div>
          )}
        </div>
      ))}

      <button
        style={{
          marginTop: '30px',
          padding: '10px 24px',
          backgroundColor: '#ffffff',
          color: '#000',
          border: 'none',
          borderRadius: '16px',
          fontWeight: 'bold',
          fontSize: '16px',
          cursor: 'pointer',
        }}
        onClick={() => navigate('/')}
      >
        {translations[language].back_button}
      </button>
    </div>
  );
};

export default Helper;