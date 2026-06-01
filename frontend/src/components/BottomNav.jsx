import React from 'react';
import './BottomNav.css';

const BottomNav = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="bottom-nav glass">
      <button
        className={activeTab === 'chat' ? 'active' : ''}
        onClick={() => setActiveTab('chat')}
        aria-label="Chat"
      >
        💬
      </button>
      <button
        className={activeTab === 'feed' ? 'active' : ''}
        onClick={() => setActiveTab('feed')}
        aria-label="Feed"
      >
        📸
      </button>
      <button
        className={activeTab === 'profile' ? 'active' : ''}
        onClick={() => setActiveTab('profile')}
        aria-label="Profile"
      >
        👤
      </button>
    </nav>
  );
};

export default BottomNav;
