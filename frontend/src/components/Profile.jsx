import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import './Profile.css';

const Profile = ({ user, viewedUserId, socket, onBack }) => {
  const [profileUser, setProfileUser] = useState(null);
  const [posts, setPosts] = useState([]);

  // Load profile data and posts
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_URL}/api/user/${viewedUserId}`);
        const data = await res.json();
        setProfileUser(data);
      } catch (err) {
        console.error('Failed to fetch profile', err);
      }
    };
    const fetchUserPosts = async () => {
      try {
        const res = await fetch(`${API_URL}/api/posts/user/${viewedUserId}`);
        const data = await res.json();
        setPosts(data);
      } catch (err) {
        console.error('Failed to fetch user posts', err);
      }
    };
    if (viewedUserId) {
      fetchProfile();
      fetchUserPosts();
    }
  }, [viewedUserId]);

  // Real‑time updates for this user's posts
  useEffect(() => {
    if (!socket) return;
    const onNewPost = (post) => {
      if (post.userId === viewedUserId) {
        setPosts((prev) => [post, ...prev]);
      }
    };
    const onLikeUpdate = ({ postId, likeCount }) => {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likeCount } : p))
      );
    };
    const onCommentUpdate = ({ postId, commentCount }) => {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, commentCount } : p))
      );
    };
    socket.on('new_post', onNewPost);
    socket.on('post_like_update', onLikeUpdate);
    socket.on('post_comment_update', onCommentUpdate);
    return () => {
      socket.off('new_post', onNewPost);
      socket.off('post_like_update', onLikeUpdate);
      socket.off('post_comment_update', onCommentUpdate);
    };
  }, [socket, viewedUserId]);

  if (!profileUser) return null;

  return (
    <div className="profile-container glass">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="profile-header">
        <div className="avatar">
          {profileUser.avatar ? (
            <img src={`${API_URL}${profileUser.avatar}`} alt="avatar" />
          ) : (
            <div className="placeholder-avatar">{profileUser.username.charAt(0).toUpperCase()}</div>
          )}
        </div>
        <h2>{profileUser.username}</h2>
        <p className="bio">{profileUser.bio}</p>
        <p>{profileUser.postCount} posts</p>
      </div>
      <div className="posts-grid">
        {posts.map((post) => (
          <div key={post.id} className="post-card">
            <img src={`${API_URL}${post.imageUrl}`} alt="post" className="post-image" />
            {post.caption && <p className="post-caption">{post.caption}</p>}
            <div className="post-actions">
              <span>❤️ {post.likeCount || 0}</span>
              <span>{post.commentCount || 0} comments</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Profile;
