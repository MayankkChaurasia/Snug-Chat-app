import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Chat from './components/Chat';
import { API_URL } from './config';
import io from 'socket.io-client';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('snugUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (user) {
      const newSocket = io(API_URL);
      setSocket(newSocket);
      return () => {
        newSocket.disconnect();
      };
    } else {
      setSocket(null);
    }
  }, [user]);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('snugUser', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('snugUser');
  };

  const handleUpdateUser = (updatedData) => {
    setUser(prev => {
      const updated = { ...prev, ...updatedData };
      localStorage.setItem('snugUser', JSON.stringify(updated));
      return updated;
    });
  };

  const handleViewProfile = (userId) => {
    // No profile view in chat-only version
  };

  return (
    <div className={`app ${!user ? 'login-mode' : 'chat-mode'}`}>
      {!user ? (
        <Auth onLogin={handleLogin} />
      ) : (
        socket && <Chat user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} onViewProfile={handleViewProfile} socket={socket} />
      )}
    </div>
  );
}

export default App;