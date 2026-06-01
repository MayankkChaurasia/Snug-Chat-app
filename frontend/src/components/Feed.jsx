import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import './Feed.css';

const Feed = ({ user, socket }) => {
  const [posts, setPosts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newImage, setNewImage] = useState(null);
  const [newCaption, setNewCaption] = useState('');

  // Fetch posts
  const fetchPosts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/posts`);
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      console.error('Failed to fetch posts', err);
    }
  };

  // Upload image helper (same as Chat component)
  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${API_URL}/api/upload-image`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Image upload failed');
    const data = await res.json();
    return data.imageUrl;
  };

  const handleCreatePost = async () => {
    if (!newImage) return;
    try {
      const imageUrl = await uploadImage(newImage);
      const payload = {
        userId: user.userId,
        username: user.username,
        caption: newCaption,
        imageUrl,
      };
      const res = await fetch(`${API_URL}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Create post failed');
      setShowModal(false);
      setNewImage(null);
      setNewCaption('');
    } catch (err) {
      console.error(err);
    }
  };

  const toggleLike = async (postId) => {
    try {
      await fetch(`${API_URL}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId }),
      });
    } catch (err) {
      console.error('Like error', err);
    }
  };

  const addComment = async (postId, content) => {
    try {
      await fetch(`${API_URL}/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId, username: user.username, content }),
      });
    } catch (err) {
      console.error('Comment error', err);
    }
  };

  // Socket listeners for real‑time updates
  useEffect(() => {
    fetchPosts();
    if (!socket) return;
    const onNewPost = (post) => setPosts((prev) => [post, ...prev]);
    const onPostLiked = ({ postId, likeCount }) =>
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likeCount } : p))
      );
    const onPostCommented = ({ postId, comment }) =>
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, comments: [...(p.comments || []), comment] }
            : p
        )
      );
    socket.on('new_post', onNewPost);
    socket.on('post_like_update', onPostLiked);
    socket.on('post_comment_update', onPostCommented);
    return () => {
      socket.off('new_post', onNewPost);
      socket.off('post_like_update', onPostLiked);
      socket.off('post_comment_update', onPostCommented);
    };
  }, [socket]);

  return (
    <div className="feed-container glass">
      <div className="feed-header">
        <h2>Feed</h2>
        <button onClick={() => setShowModal(true)} className="create-post-btn">
          + New Post
        </button>
      </div>
      {posts.map((post) => (
        <div key={post.id} className="post-card">
          <div className="post-header">
            <span className="post-author">{post.username}</span>
          </div>
          <img src={`${API_URL}${post.imageUrl}`} alt="post" className="post-image" />
          {post.caption && <p className="post-caption">{post.caption}</p>}
          <div className="post-actions">
            <button onClick={() => toggleLike(post.id)} className="like-btn">
              ❤️ {post.likeCount || 0}
            </button>
            <span>{post.commentCount || 0} comments</span>
          </div>
        </div>
      ))}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create Post</h3>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewImage(e.target.files[0])}
            />
            <textarea
              placeholder="Caption..."
              value={newCaption}
              onChange={(e) => setNewCaption(e.target.value)}
            />
            <button onClick={handleCreatePost}>Post</button>
            <button onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feed;
