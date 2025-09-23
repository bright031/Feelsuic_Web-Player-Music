import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App.jsx';
import Login from './components/Login.jsx';
import Signup from './components/Signup.jsx';
import Helper from './components/Helper.jsx';
import AboutUs from './components/AboutUs.jsx';
import ProfilePage from './components/ProfilePage.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
       <Route path="/aboutus" element={<AboutUs />} />
            <Route path="/helper" element={<Helper />} />
       <Route path="/profile" element={<ProfilePage  />} />

      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);