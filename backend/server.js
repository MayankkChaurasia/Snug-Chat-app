require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  }
});

const adapter = new JSONFile('db.json');
const defaultData = { users: [], messages: [], privateMessages: [], posts: [], comments: [], likes: [] };
const db = new Low(adapter, defaultData);

async function initializeDB() {
  await db.read();
  db.data = db.data || { users: [], messages: [], privateMessages: [], posts: [], comments: [], likes: [] };
  if (!db.data.posts) db.data.posts = [];
  if (!db.data.comments) db.data.comments = [];
  if (!db.data.likes) db.data.likes = [];
  await db.write();
}
 
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const voicesDir = path.join(__dirname, 'uploads', 'voices');
if (!fs.existsSync(voicesDir)) {
  fs.mkdirSync(voicesDir, { recursive: true });
}

const avatarsDir = path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}
 
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const voiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, voicesDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
    cb(null, uniqueName);
  }
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const voiceUpload = multer({
  storage: voiceStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB for 5min voice
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

async function translateText(text, targetLang = 'en') {
  try {
    const response = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${targetLang}`);
    return response.data.responseData.translatedText;
  } catch (error) {
    console.error('Translation Error:', error);
    return text;
  }
}


app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const existingUser = db.data.users.find(user => user.username === username);
  if (existingUser) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    id: Date.now().toString(),
    username,
    password: hashedPassword,
    bio: '',
    avatar: '',
    createdAt: new Date().toISOString()
  };

  db.data.users.push(user);
  await db.write();

  res.json({ message: 'User registered successfully', userId: user.id, username: user.username, avatar: user.avatar || '' });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.data.users.find(user => user.username === username);
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({ message: 'Login successful', userId: user.id, username: user.username, avatar: user.avatar || '' });
});

app.get('/api/messages', (req, res) => {
  res.json(db.data.messages);
});

app.get('/api/private-messages/:userId1/:userId2', (req, res) => {
  const { userId1, userId2 } = req.params;
  const privateMessages = db.data.privateMessages.filter(msg => 
    (msg.senderId === userId1 && msg.receiverId === userId2) ||
    (msg.senderId === userId2 && msg.receiverId === userId1)
  );
  res.json(privateMessages);
});

app.delete('/api/user/:userId', async (req, res) => {
  const { userId } = req.params;
  
  const userIndex = db.data.users.findIndex(user => user.id === userId);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
   
  db.data.users.splice(userIndex, 1);
  db.data.messages = db.data.messages.filter(msg => msg.userId !== userId);
  db.data.privateMessages = db.data.privateMessages.filter(msg => 
    msg.senderId !== userId && msg.receiverId !== userId
  );
  // Also clean up posts, comments, likes
  db.data.posts = db.data.posts.filter(post => post.userId !== userId);
  db.data.comments = db.data.comments.filter(comment => comment.userId !== userId);
  db.data.likes = db.data.likes.filter(like => like.userId !== userId);
  
  await db.write();
  res.json({ message: 'User account deleted successfully' });
});

app.delete('/api/messages/:messageId', async (req, res) => {
  const { messageId } = req.params;
  const messageIndex = db.data.messages.findIndex(msg => msg.id === messageId);
  
  if (messageIndex === -1) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  db.data.messages.splice(messageIndex, 1);
  await db.write();
  res.json({ message: 'Message deleted successfully' });
});

app.delete('/api/private-messages/:messageId', async (req, res) => {
  const { messageId } = req.params;
  const messageIndex = db.data.privateMessages.findIndex(msg => msg.id === messageId);
  
  if (messageIndex === -1) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  db.data.privateMessages.splice(messageIndex, 1);
  await db.write();
  res.json({ message: 'Message deleted successfully' });
});

app.post('/api/upload-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Voice message upload
app.post('/api/upload-voice', voiceUpload.single('voice'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No voice file uploaded' });
    }
    
    const voiceUrl = `/uploads/voices/${req.file.filename}`;
    const duration = req.body.duration || 0;
    res.json({ voiceUrl, duration });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload voice message' });
  }
});

// Avatar upload
app.post('/api/upload-avatar', avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No avatar file uploaded' });
    }
    
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const userId = req.body.userId;
    
    if (userId) {
      const user = db.data.users.find(u => u.id === userId);
      if (user) {
        user.avatar = avatarUrl;
        await db.write();
      }
    }
    
    res.json({ avatarUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Delete avatar
app.delete('/api/user/:userId/avatar', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = db.data.users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.avatar = '';
    await db.write();
    res.json({ message: 'Avatar deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete avatar' });
  }
});

app.post('/api/translate', async (req, res) => {
  const { text, targetLang } = req.body;
  try {
    const translation = await translateText(text, targetLang);
    res.json({ translation });
  } catch (error) {
    res.status(500).json({ error: 'Translation failed' });
  }
});

// ==================== PROFILE APIs ====================

// Get user profile
app.get('/api/user/:userId', (req, res) => {
  const { userId } = req.params;
  const user = db.data.users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const postCount = db.data.posts.filter(p => p.userId === userId).length;
  
  res.json({
    id: user.id,
    username: user.username,
    bio: user.bio || '',
    avatar: user.avatar || '',
    postCount,
    createdAt: user.createdAt
  });
});

// Update user profile
app.put('/api/user/:userId/profile', async (req, res) => {
  const { userId } = req.params;
  const { bio } = req.body;
  
  const user = db.data.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  if (bio !== undefined) user.bio = bio;
  await db.write();
  
  res.json({ message: 'Profile updated', bio: user.bio, avatar: user.avatar || '' });
});

// ==================== POSTS APIs ====================

// Get all posts (feed)
app.get('/api/posts', (req, res) => {
  const posts = [...db.data.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Add like count and user info to each post
  const postsWithMeta = posts.map(post => {
    const likeCount = db.data.likes.filter(l => l.postId === post.id).length;
    const commentCount = db.data.comments.filter(c => c.postId === post.id).length;
    const user = db.data.users.find(u => u.id === post.userId);
    return {
      ...post,
      likeCount,
      commentCount,
      userAvatar: user?.avatar || ''
    };
  });
  
  res.json(postsWithMeta);
});

// Get posts by user
app.get('/api/posts/user/:userId', (req, res) => {
  const { userId } = req.params;
  const posts = db.data.posts
    .filter(p => p.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const postsWithMeta = posts.map(post => {
    const likeCount = db.data.likes.filter(l => l.postId === post.id).length;
    const commentCount = db.data.comments.filter(c => c.postId === post.id).length;
    return { ...post, likeCount, commentCount };
  });
  
  res.json(postsWithMeta);
});

// Create post
app.post('/api/posts', upload.single('image'), async (req, res) => {
  try {
    const { userId, username, caption } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Image is required for a post' });
    }
    
    const imageUrl = `/uploads/${req.file.filename}`;
    const post = {
      id: Date.now().toString(),
      userId,
      username,
      imageUrl,
      caption: caption || '',
      createdAt: new Date().toISOString()
    };
    
    db.data.posts.push(post);
    await db.write();
    
    // Broadcast new post to all connected users
    io.emit('new_post', { ...post, likeCount: 0, commentCount: 0 });
    
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Delete post
app.delete('/api/posts/:postId', async (req, res) => {
  const { postId } = req.params;
  const postIndex = db.data.posts.findIndex(p => p.id === postId);
  
  if (postIndex === -1) {
    return res.status(404).json({ error: 'Post not found' });
  }
  
  db.data.posts.splice(postIndex, 1);
  // Also delete related comments and likes
  db.data.comments = db.data.comments.filter(c => c.postId !== postId);
  db.data.likes = db.data.likes.filter(l => l.postId !== postId);
  await db.write();
  
  io.emit('post_deleted', postId);
  
  res.json({ message: 'Post deleted successfully' });
});

// ==================== LIKES APIs ====================

// Toggle like
app.post('/api/posts/:postId/like', async (req, res) => {
  const { postId } = req.params;
  const { userId } = req.body;
  
  const existingLike = db.data.likes.find(l => l.postId === postId && l.userId === userId);
  
  if (existingLike) {
    // Unlike
    db.data.likes = db.data.likes.filter(l => !(l.postId === postId && l.userId === userId));
    await db.write();
    const likeCount = db.data.likes.filter(l => l.postId === postId).length;
    io.emit('post_like_update', { postId, likeCount, userId, liked: false });
    res.json({ liked: false, likeCount });
  } else {
    // Like
    const like = {
      id: Date.now().toString(),
      postId,
      userId
    };
    db.data.likes.push(like);
    await db.write();
    const likeCount = db.data.likes.filter(l => l.postId === postId).length;
    io.emit('post_like_update', { postId, likeCount, userId, liked: true });
    res.json({ liked: true, likeCount });
  }
});

// Check if user liked a post
app.get('/api/posts/:postId/liked/:userId', (req, res) => {
  const { postId, userId } = req.params;
  const liked = db.data.likes.some(l => l.postId === postId && l.userId === userId);
  const likeCount = db.data.likes.filter(l => l.postId === postId).length;
  res.json({ liked, likeCount });
});

// ==================== COMMENTS APIs ====================

// Get comments for a post
app.get('/api/posts/:postId/comments', (req, res) => {
  const { postId } = req.params;
  const comments = db.data.comments
    .filter(c => c.postId === postId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  
  // Add user avatar to comments
  const commentsWithMeta = comments.map(comment => {
    const user = db.data.users.find(u => u.id === comment.userId);
    return { ...comment, userAvatar: user?.avatar || '' };
  });
  
  res.json(commentsWithMeta);
});

// Add comment
app.post('/api/posts/:postId/comments', async (req, res) => {
  const { postId } = req.params;
  const { userId, username, content } = req.body;
  
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment content is required' });
  }
  
  const comment = {
    id: Date.now().toString(),
    postId,
    userId,
    username,
    content: content.trim(),
    createdAt: new Date().toISOString()
  };
  
  db.data.comments.push(comment);
  await db.write();
  
  const commentCount = db.data.comments.filter(c => c.postId === postId).length;
  io.emit('post_comment_update', { postId, commentCount, comment });
  
  res.json(comment);
});

// Delete comment
app.delete('/api/comments/:commentId', async (req, res) => {
  const { commentId } = req.params;
  const commentIndex = db.data.comments.findIndex(c => c.id === commentId);
  
  if (commentIndex === -1) {
    return res.status(404).json({ error: 'Comment not found' });
  }
  
  const postId = db.data.comments[commentIndex].postId;
  db.data.comments.splice(commentIndex, 1);
  await db.write();
  
  const commentCount = db.data.comments.filter(c => c.postId === postId).length;
  io.emit('post_comment_update', { postId, commentCount });
  
  res.json({ message: 'Comment deleted successfully' });
});

// ==================== PRODUCTION: Serve Frontend ====================
const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  // For any non-API route, serve index.html (SPA fallback)
  app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

const connectedUsers = new Map();
const activeCalls = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userData) => {
    connectedUsers.set(socket.id, userData);
    socket.broadcast.emit('user_joined', userData);
    io.emit('users_update', Array.from(connectedUsers.values()));
  });

  socket.on('send_message', async (messageData) => {
    const message = {
      id: Date.now().toString(),
      username: messageData.username,
      userId: messageData.userId,
      content: messageData.content,
      type: messageData.type || 'text', 
      imageUrl: messageData.imageUrl || null,
      voiceUrl: messageData.voiceUrl || null,
      voiceDuration: messageData.voiceDuration || null,
      timestamp: new Date().toISOString()
    };

    db.data.messages.push(message);
    await db.write();
    io.emit('receive_message', message);
  });

  socket.on('send_private_message', async (messageData) => {
    const message = {
      id: Date.now().toString(),
      senderId: messageData.senderId,
      senderUsername: messageData.senderUsername,
      receiverId: messageData.receiverId,
      receiverUsername: messageData.receiverUsername,
      content: messageData.content,
      type: messageData.type || 'text', 
      imageUrl: messageData.imageUrl || null,
      voiceUrl: messageData.voiceUrl || null,
      voiceDuration: messageData.voiceDuration || null,
      timestamp: new Date().toISOString()
    };

    db.data.privateMessages.push(message);
    await db.write();

    const receiverSocket = Array.from(connectedUsers.entries())
      .find(([socketId, userData]) => userData.userId === messageData.receiverId);
    
    if (receiverSocket) {
      io.to(receiverSocket[0]).emit('receive_private_message', message);
    }
    
    socket.emit('receive_private_message', message);
  });

  socket.on('delete_message', async (messageId) => {
    const messageIndex = db.data.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex !== -1) {
      db.data.messages.splice(messageIndex, 1);
      await db.write();
      io.emit('message_deleted', messageId);
    }
  });

  socket.on('delete_private_message', async (messageId) => {
    const messageIndex = db.data.privateMessages.findIndex(msg => msg.id === messageId);
    if (messageIndex !== -1) {
      const message = db.data.privateMessages[messageIndex];
      db.data.privateMessages.splice(messageIndex, 1);
      await db.write();
      
      const receiverSocket = Array.from(connectedUsers.entries())
        .find(([socketId, userData]) => userData.userId === message.receiverId || userData.userId === message.senderId);
      
      if (receiverSocket) {
        io.to(receiverSocket[0]).emit('private_message_deleted', messageId);
      }
      
      socket.emit('private_message_deleted', messageId);
    }
  });

  socket.on('initiate_call', (callData) => {
    const { id, caller, participant, isVideo } = callData;
    const targetSocket = Array.from(connectedUsers.entries())
      .find(([socketId, userData]) => userData.userId === participant.userId);
    
    if (targetSocket) {
      activeCalls.set(id, {
        id,
        caller,
        participant,
        isVideo,
        status: 'ringing',
        callerSocketId: socket.id,
        participantSocketId: targetSocket[0]
      });
      
      io.to(targetSocket[0]).emit('incoming_call', callData);
    } else {
      socket.emit('call_failed', { error: 'User not available' });
    }
  });

  socket.on('accept_call', (data) => {
    const { callId } = data;
    const call = activeCalls.get(callId);
    
    if (call) {
      call.status = 'accepted';
      io.to(call.callerSocketId).emit('call_accepted', call);
    }
  });

  socket.on('reject_call', (data) => {
    const { callId } = data;
    const call = activeCalls.get(callId);
    
    if (call) {
      io.to(call.callerSocketId).emit('call_rejected', { callId });
      activeCalls.delete(callId);
    }
  });

  socket.on('end_call', (data) => {
    const { callId } = data;
    const call = activeCalls.get(callId);
    
    if (call) {
      if (socket.id === call.callerSocketId) {
        io.to(call.participantSocketId).emit('call_ended', { callId });
      } else {
        io.to(call.callerSocketId).emit('call_ended', { callId });
      }
      activeCalls.delete(callId);
    }
  });

  socket.on('webrtc_offer', (data) => {
    const { offer, callId, to } = data;
    const targetSocket = Array.from(connectedUsers.entries())
      .find(([socketId, userData]) => userData.userId === to);
    
    if (targetSocket) {
      io.to(targetSocket[0]).emit('webrtc_offer', {
        offer,
        callId,
        from: connectedUsers.get(socket.id)?.userId
      });
    }
  });

  socket.on('webrtc_answer', (data) => {
    const { answer, callId, to } = data;
    const targetSocket = Array.from(connectedUsers.entries())
      .find(([socketId, userData]) => userData.userId === to);
    
    if (targetSocket) {
      io.to(targetSocket[0]).emit('webrtc_answer', {
        answer,
        callId,
        from: connectedUsers.get(socket.id)?.userId
      });
    }
  });

  socket.on('ice_candidate', (data) => {
    const { candidate, callId, to } = data;
    const targetSocket = Array.from(connectedUsers.entries())
      .find(([socketId, userData]) => userData.userId === to);
    
    if (targetSocket) {
      io.to(targetSocket[0]).emit('ice_candidate', {
        candidate,
        callId,
        from: connectedUsers.get(socket.id)?.userId
      });
    }
  });

  socket.on('disconnect', () => {
    const userData = connectedUsers.get(socket.id);
    if (userData) {
      activeCalls.forEach((call, callId) => {
        if (call.callerSocketId === socket.id || call.participantSocketId === socket.id) {
          const otherSocketId = call.callerSocketId === socket.id ? call.participantSocketId : call.callerSocketId;
          io.to(otherSocketId).emit('call_ended', { callId });
          activeCalls.delete(callId);
        }
      });
      
      connectedUsers.delete(socket.id);
      socket.broadcast.emit('user_left', userData);
      io.emit('users_update', Array.from(connectedUsers.values()));
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

async function startServer() {
  await initializeDB();
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
