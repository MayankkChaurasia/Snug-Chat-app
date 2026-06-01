import { useState, useEffect, useRef } from 'react'
import io from 'socket.io-client'
import { API_URL } from '../config'
import CallManager from './CallManager'
import './Chat.css'

const Chat = ({ user, onLogout, onViewProfile, onUpdateUser, socket: externalSocket, onlineUsers: externalOnlineUsers }) => {
  const [socket, setSocket] = useState(externalSocket || null)
  const [messages, setMessages] = useState([])
  const [privateMessages, setPrivateMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [privateMessageInput, setPrivateMessageInput] = useState('')
  const [onlineUsers, setOnlineUsers] = useState(externalOnlineUsers || [])
  const [selectedUser, setSelectedUser] = useState(null)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [showSidebar, setShowSidebar] = useState(true)
  const [showDropdown, setShowDropdown] = useState(null)
  const callManagerRef = useRef(null)

  const messagesEndRef = useRef(null)
  const privateMessagesEndRef = useRef(null)

  const messagesContainerRef = useRef(null)
  const emojiPickerRef = useRef(null)
  const avatarInputRef = useRef(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAvatarOptions, setShowAvatarOptions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)
  const [showTranslateMenu, setShowTranslateMenu] = useState(false)
  const [translateLanguage, setTranslateLanguage] = useState('en')

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingTimerRef = useRef(null)
  const MAX_RECORDING_SECONDS = 300 // 5 minutes


  useEffect(() => {
    if (externalSocket) {
      setSocket(externalSocket)
      externalSocket.emit('join', user)
      return
    }
    const newSocket = io(API_URL)
    setSocket(newSocket)

    newSocket.emit('join', user)

    return () => {
      newSocket.disconnect()
    }
  }, [user, externalSocket])

  useEffect(() => {
    if (externalOnlineUsers) {
      setOnlineUsers(externalOnlineUsers)
    }
  }, [externalOnlineUsers])

  useEffect(() => {
    if (!socket) return

    const handleReceiveMessage = (message) => {
      setMessages(prev => [...prev, message])
    }
    const handleReceivePrivateMessage = (message) => {
      setPrivateMessages(prev => [...prev, message])
    }
    const handleMessageDeleted = (messageId) => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId))
    }
    const handlePrivateMessageDeleted = (messageId) => {
      setPrivateMessages(prev => prev.filter(msg => msg.id !== messageId))
    }
    const handleUsersUpdate = (users) => {
      console.log('Received users_update:', users);
      if (!externalOnlineUsers) {
        setOnlineUsers(users)
      }
    }

    socket.on('receive_message', handleReceiveMessage)
    socket.on('receive_private_message', handleReceivePrivateMessage)
    socket.on('message_deleted', handleMessageDeleted)
    socket.on('private_message_deleted', handlePrivateMessageDeleted)
    socket.on('users_update', handleUsersUpdate)

    fetchMessages()

    return () => {
      socket.off('receive_message', handleReceiveMessage)
      socket.off('receive_private_message', handleReceivePrivateMessage)
      socket.off('message_deleted', handleMessageDeleted)
      socket.off('private_message_deleted', handlePrivateMessageDeleted)
      socket.off('users_update', handleUsersUpdate)
    }
  }, [socket])


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false)
      }
    }

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showEmojiPicker])

  useEffect(() => {
    scrollToBottom()
    scrollToBottomPrivate()
  }, [messages, privateMessages])

  const fetchMessages = async () => {
    try {
      const response = await fetch(`${API_URL}/api/messages`)
      const data = await response.json()
      setMessages(data)
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const scrollToBottomPrivate = () => {
    privateMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchPrivateMessages = async (userId1, userId2) => {
    try {
      const response = await fetch(`${API_URL}/api/private-messages/${userId1}/${userId2}`)
      const data = await response.json()
      setPrivateMessages(data)
    } catch (error) {
      console.error('Failed to fetch private messages:', error)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (messageInput.trim() && socket) {
      socket.emit('send_message', {
        content: messageInput.trim(),
        username: user.username,
        userId: user.userId,
        type: 'text'
      })
      setMessageInput('')
    }
  }

  const sendPrivateMessage = async (e) => {
    e.preventDefault()
    if (privateMessageInput.trim() && socket && selectedUser) {
      socket.emit('send_private_message', {
        content: privateMessageInput.trim(),
        senderId: user.userId,
        senderUsername: user.username,
        receiverId: selectedUser.userId,
        receiverUsername: selectedUser.username,
        type: 'text'
      })
      setPrivateMessageInput('')
    }
  }

  const uploadImage = async (file) => {
    const formData = new FormData()
    formData.append('image', file)

    try {
      const response = await fetch(`${API_URL}/api/upload-image`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to upload image')
      }

      const data = await response.json()
      return data.imageUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Failed to upload image. Please try again.')
      return null
    }
  }

  const sendImageMessage = async (imageUrl, caption = '') => {
    if (socket && imageUrl) {
      if (selectedUser) {
        socket.emit('send_private_message', {
          content: caption,
          senderId: user.userId,
          senderUsername: user.username,
          receiverId: selectedUser.userId,
          receiverUsername: selectedUser.username,
          type: 'image',
          imageUrl: imageUrl
        })
      } else {
        socket.emit('send_message', {
          content: caption,
          username: user.username,
          userId: user.userId,
          type: 'image',
          imageUrl: imageUrl
        })
      }
    }
  }

  const handleImageSelect = async (file) => {
    if (file && file.type.startsWith('image/')) {
      const imageUrl = await uploadImage(file)
      if (imageUrl) {
        await sendImageMessage(imageUrl)
      }
    } else {
      alert('Please select a valid image file')
    }
  }

  const handleFileInputChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      handleImageSelect(file)
    }
    
    e.target.value = ''
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageSelect(e.dataTransfer.files[0])
    }
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  const triggerAvatarUpload = () => {
    avatarInputRef.current?.click()
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (file && file.type.startsWith('image/')) {
      const formData = new FormData()
      formData.append('avatar', file)
      formData.append('userId', user.userId)

      try {
        const response = await fetch(`${API_URL}/api/upload-avatar`, {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error('Failed to upload avatar')
        }

        const data = await response.json()
        const updatedUser = { ...user, avatar: data.avatarUrl }
        
        if (onUpdateUser) {
          onUpdateUser({ avatar: data.avatarUrl })
        }

        if (socket) {
          socket.emit('join', updatedUser)
        }
      } catch (error) {
        console.error('Error uploading avatar:', error)
        alert('Failed to upload avatar. Please try again.')
      }
    }
  }

  const handleRemoveAvatar = async () => {
    try {
      const response = await fetch(`${API_URL}/api/user/${user.userId}/avatar`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete avatar')
      }

      const updatedUser = { ...user, avatar: '' }
      
      if (onUpdateUser) {
        onUpdateUser({ avatar: '' })
      }

      if (socket) {
        socket.emit('join', updatedUser)
      }
      setShowAvatarOptions(false)
    } catch (error) {
      console.error('Error removing avatar:', error)
      alert('Failed to remove avatar. Please try again.')
    }
  }

  // ==================== VOICE RECORDING ====================

  // ==================== VOICE RECORDING ====================

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Microphone access is disabled by your browser because this site is being accessed over insecure HTTP instead of HTTPS (this happens when accessing local IPs like 192.168.x.x on mobile devices).\n\nTo enable voice/video and microphone features:\n1. On Laptop: Access via 'http://localhost:5173'\n2. On Mobile (Chrome): Search 'chrome://flags/#unsafely-treat-insecure-origin-as-secure' in Chrome, enter your laptop's URL (e.g. 'http://192.168.x.x:5173'), set to 'Enabled', and restart Chrome.\n3. Alternatively, host the app with HTTPS or use a tunneling tool like ngrok.");
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      let options = {}
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' }
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' }
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          options = { mimeType: 'audio/ogg' }
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
        const mimeType = mediaRecorder.mimeType || 'audio/webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        
        let ext = 'webm'
        if (mimeType.includes('mp4')) ext = 'mp4'
        else if (mimeType.includes('ogg')) ext = 'ogg'
        else if (mimeType.includes('wav')) ext = 'wav'

        await uploadAndSendVoice(audioBlob, `voice.${ext}`)
      }

      mediaRecorder.start(1000) // collect data every second
      setIsRecording(true)
      setRecordingTime(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_RECORDING_SECONDS - 1) {
            stopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Could not access microphone. Please ensure your device has a working microphone and you have allowed permission in your browser settings.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
      const stream = mediaRecorderRef.current.stream
      if (stream) stream.getTracks().forEach(track => track.stop())
    }
    setIsRecording(false)
    setRecordingTime(0)
    audioChunksRef.current = []
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  const uploadAndSendVoice = async (audioBlob, filename = 'voice.webm') => {
    const formData = new FormData()
    formData.append('voice', audioBlob, filename)
    formData.append('duration', recordingTime)

    try {
      const response = await fetch(`${API_URL}/api/upload-voice`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('Failed to upload voice')

      const data = await response.json()
      
      if (socket) {
        if (selectedUser) {
          socket.emit('send_private_message', {
            content: '',
            senderId: user.userId,
            senderUsername: user.username,
            receiverId: selectedUser.userId,
            receiverUsername: selectedUser.username,
            type: 'voice',
            voiceUrl: data.voiceUrl,
            voiceDuration: recordingTime
          })
        } else {
          socket.emit('send_message', {
            content: '',
            username: user.username,
            userId: user.userId,
            type: 'voice',
            voiceUrl: data.voiceUrl,
            voiceDuration: recordingTime
          })
        }
      }
    } catch (error) {
      console.error('Error uploading voice:', error)
      alert('Failed to send voice message.')
    }
    setRecordingTime(0)
  }

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // ==================== END VOICE ====================

  const translateMessage = async (text, targetLang) => {
    try {
      const response = await fetch(`${API_URL}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, targetLang }),
      })
      const data = await response.json()
      return data.translation
    } catch (error) {
      console.error('Translation failed:', error)
      return text
    }
  }

  const renderMessageContent = (content, messageId) => {
    if (!content) return null
    return (
      <div className="message-content">
        {content}
      </div>
    )
  }

  const deleteMessage = (messageId, isPrivate = false) => {
    if (socket) {
      if (isPrivate) {
        socket.emit('delete_private_message', messageId)
      } else {
        socket.emit('delete_message', messageId)
      }
    }
    setShowDropdown(null)
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const handleUserSelect = (selectedUser) => {
    setSelectedUser(selectedUser)
    fetchPrivateMessages(user.userId, selectedUser.userId)
    setShowSidebar(false)
  }

  const handleBackToMainChat = () => {
    setSelectedUser(null)
    setUserSearchQuery('')
    setShowSidebar(false)
  }

  const filteredUsers = onlineUsers.filter(onlineUser => 
    onlineUser.userId !== user.userId &&
    onlineUser.username.toLowerCase().includes(userSearchQuery.toLowerCase())
  )

  const handleLogout = () => {
    if (socket && !externalSocket) {
      socket.disconnect()
    }
    onLogout()
  }

  const handleDeleteAccount = async () => {
    try {
      const response = await fetch(`${API_URL}/api/user/${user.userId}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        if (socket && !externalSocket) {
          socket.disconnect()
        }
        onLogout()
        alert('Account deleted successfully')
      } else {
        const data = await response.json()
        alert(`Failed to delete account: ${data.error}`)
      }
    } catch (error) {
      alert('Failed to delete account. Please try again.')
    }
    setShowDeleteConfirm(false)
  }

  const VoiceMessage = ({ voiceUrl, duration }) => {
    const [isPlaying, setIsPlaying] = useState(false)
    const [progress, setProgress] = useState(0)
    const audioRef = useRef(null)

    const togglePlay = () => {
      if (!audioRef.current) return
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }

    const handleTimeUpdate = () => {
      if (audioRef.current) {
        const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100
        setProgress(pct)
      }
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setProgress(0)
    }

    const formatDur = (s) => {
      const m = Math.floor(s / 60)
      const sec = s % 60
      return `${m}:${String(sec).padStart(2, '0')}`
    }

    return (
      <div className="voice-message">
        <audio
          ref={audioRef}
          src={`${API_URL}${voiceUrl}`}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
        />
        <button className="voice-play-btn" onClick={togglePlay}>
          {isPlaying ? '⏸' : '▶️'}
        </button>
        <div className="voice-wave-container">
          <div className="voice-wave-bg">
            <div className="voice-wave-progress" style={{ width: `${progress}%` }} />
          </div>
          <span className="voice-duration">{formatDur(duration || 0)}</span>
        </div>
      </div>
    )
  }
 
  const emojis = [
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
    '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛',
    '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
    '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫',
    '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳',
    '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭',
    '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧',
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
    '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏',
    '🙌', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌',
    '🔥', '💯', '💢', '💨', '💫', '💦', '💨', '🕳️', '💣', '💬',
    '🗨️', '🗯️', '💭', '💤', '👁️', '🗨️', '🔇', '🔈', '🔉', '🔊'
  ]

  const addEmojiToMessage = (emoji) => {
    if (selectedUser) {
      setPrivateMessageInput(prev => prev + emoji)
    } else {
      setMessageInput(prev => prev + emoji)
    }
    setShowEmojiPicker(false)
  }

  const handleCallStateChange = (callState) => {
    console.log('Call state changed to:', callState)
  }

  const renderMessageBubble = (message, isPrivate) => {
    const isOwn = isPrivate ? message.senderId === user.userId : message.userId === user.userId
    const senderName = isPrivate ? message.senderUsername : message.username

    return (
      <div
        key={message.id}
        className={`message ${isOwn ? 'own-message' : 'other-message'}`}
      >
        <div className="message-bubble">
          {!isOwn && (
            <div 
              className="message-sender clickable-username" 
              onClick={() => {
                const senderId = isPrivate ? message.senderId : message.userId
                if (onViewProfile) onViewProfile(senderId)
              }}
            >
              {senderName}
            </div>
          )}
          {message.type === 'image' ? (
            <div className="message-image-container">
              <img 
                src={`${API_URL}${message.imageUrl}`} 
                alt="Shared image" 
                className="message-image"
                onClick={() => window.open(`${API_URL}${message.imageUrl}`, '_blank')}
              />
              {message.content && <div className="image-caption">{message.content}</div>}
            </div>
          ) : message.type === 'voice' ? (
            <VoiceMessage voiceUrl={message.voiceUrl} duration={message.voiceDuration} />
          ) : (
            <div className="message-content">{message.content}</div>
          )}
          <div className="message-time">{formatTime(message.timestamp)}</div>
          {isOwn && (
            <div className="message-options">
              <button 
                className="options-btn"
                onClick={() => setShowDropdown(showDropdown === message.id ? null : message.id)}
              >
                ⋯
              </button>
              {showDropdown === message.id && (
                <div className="dropdown-menu">
                  <button 
                    onClick={() => deleteMessage(message.id, isPrivate)}
                    className="delete-btn"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="chat-container">
      <div className="chat-layout">

        {showSidebar && <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />}
        <div className={`users-sidebar glass ${showSidebar ? 'sidebar-open' : ''}`}>
          <div className="users-header">
            {selectedUser ? (
              <div className="back-button-container">
                <button onClick={handleBackToMainChat} className="back-button">
                  ← Back to Main Chat
                </button>
                <h3>Private Chat</h3>
              </div>
            ) : (
              <>
                <h3>Users</h3>
                <div className="search-container">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>
              </>
            )}
          </div>
          <div className="users-list">
            {!selectedUser && (
              <>

                <div className="user-section">
                  <div className="section-title">Your Profile</div>
                  <div 
                    className="user-item current-user"
                    onClick={() => user.avatar ? setShowAvatarOptions(true) : triggerAvatarUpload()}
                    style={{ cursor: 'pointer' }}
                    title="Click to upload/change your avatar picture"
                  >
                    <input 
                      type="file" 
                      ref={avatarInputRef} 
                      style={{ display: 'none' }} 
                      accept="image/*" 
                      onChange={handleAvatarChange} 
                    />
                    <div className="user-avatar current-user-avatar">
                      {user.avatar ? (
                        <img src={`${API_URL}${user.avatar}`} alt="Avatar" className="avatar-img" />
                      ) : (
                        user.username.charAt(0).toUpperCase()
                      )}
                      <div className="avatar-overlay-edit">📷</div>
                    </div>
                    <span className="user-name">{user.username} (You)</span>
                  </div>
                </div>
                

                {filteredUsers.length > 0 ? (
                  <div className="user-section">
                    <div className="section-title">Other Users</div>
                    {filteredUsers.map((onlineUser) => (
                      <div
                        key={onlineUser.userId}
                        className="user-item"
                        onClick={() => handleUserSelect(onlineUser)}
                      >
                        <div className="user-avatar">
                          {onlineUser.avatar ? (
                            <img src={`${API_URL}${onlineUser.avatar}`} alt="Avatar" className="avatar-img" />
                          ) : (
                            onlineUser.username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="user-name">
                          {onlineUser.username}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-users">
                    {userSearchQuery ? "No users found" : "No other users online"}
                  </div>
                )}
              </>
            )}
          </div>
        </div>


        <div className="chat-main glass">
          <div className="chat-header">
            <button className="mobile-menu-btn" onClick={() => setShowSidebar(!showSidebar)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="chat-info">
              <h2>{selectedUser ? `Chat with ${selectedUser.username}` : 'Snug Chat'}</h2>
              <span className="online-count">
                {selectedUser ? 'Private Chat' : `${onlineUsers.length} user${onlineUsers.length !== 1 ? 's' : ''} online`}
              </span>
            </div>
            <div className="user-info">
              {selectedUser && (
                <div className="call-buttons">
                  <button 
                    className="call-btn voice-call"
                    onClick={() => callManagerRef.current?.startVoiceCall(selectedUser)}
                    disabled={callManagerRef.current?.isInCall}
                    title="Start voice call"
                  >
                    📞
                  </button>
                  <button 
                    className="call-btn video-call"
                    onClick={() => callManagerRef.current?.startVideoCall(selectedUser)}
                    disabled={callManagerRef.current?.isInCall}
                    title="Start video call"
                  >
                    📹
                  </button>
                </div>
              )}
              <span className="username">@{user.username}</span>
              <div className="user-actions">
                <button 
                  onClick={() => setShowDeleteConfirm(true)} 
                  className="delete-account-btn"
                  title="Delete Account"
                >
                  🗑️
                </button>
                <button onClick={handleLogout} className="logout-btn">
                  Sign Out
                </button>
              </div>
            </div>
          </div>



          <div className="messages-container" ref={messagesContainerRef}>
            <div className="messages-list">
              {selectedUser ? (
                privateMessages.map((message) => renderMessageBubble(message, true))
              ) : (
                messages.map((message) => renderMessageBubble(message, false))
              )}
              <div ref={selectedUser ? privateMessagesEndRef : messagesEndRef} />
            </div>
          </div>

          {isRecording ? (
            <div className="recording-bar">
              <button className="recording-cancel-btn" onClick={cancelRecording} title="Cancel">
                ✕
              </button>
              <div className="recording-indicator">
                <span className="recording-dot"></span>
                <span className="recording-time">{formatRecordingTime(recordingTime)}</span>
              </div>
              <button className="recording-send-btn" onClick={stopRecording} title="Send voice">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
                </svg>
              </button>
            </div>
          ) : (
            <form onSubmit={selectedUser ? sendPrivateMessage : sendMessage} className="message-input-form">
              <div 
                className={`input-container glass ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="image-button"
                  onClick={openFileDialog}
                  title="Upload image"
                >
                  📷
                </button>
                <div className="emoji-picker-container" ref={emojiPickerRef}>
                  <button
                    type="button"
                    className="emoji-button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    title="Add emoji"
                  >
                    😀
                  </button>
                  {showEmojiPicker && (
                    <div className="emoji-picker">
                      <div className="emoji-grid">
                        {emojis.map((emoji, index) => (
                          <button
                            key={index}
                            type="button"
                            className="emoji-option"
                            onClick={() => addEmojiToMessage(emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="voice-record-btn"
                  onClick={startRecording}
                  title="Record voice message (max 5 min)"
                >
                  🎙️
                </button>
                <input
                  type="text"
                  value={selectedUser ? privateMessageInput : messageInput}
                  onChange={(e) => selectedUser ? setPrivateMessageInput(e.target.value) : setMessageInput(e.target.value)}
                  placeholder={selectedUser ? `Message ${selectedUser.username}...` : "Type a message..."}
                  className="message-input"
                  maxLength={500}
                />
                <button type="submit" disabled={selectedUser ? !privateMessageInput.trim() : !messageInput.trim()} className="send-button">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M2 21L23 12L2 3V10L17 12L2 14V21Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      

      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <h3>Delete Account</h3>
            <p>Are you sure you want to delete your account? This action cannot be undone and will remove all your messages.</p>
            <div className="modal-actions">
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
                className="cancel-btn"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAccount} 
                className="confirm-delete-btn"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {showAvatarOptions && (
        <div className="modal-overlay" onClick={() => setShowAvatarOptions(false)}>
          <div className="modal-content glass" onClick={(e) => e.stopPropagation()}>
            <h3>Profile Picture</h3>
            <p>Would you like to upload a new picture or remove your current one?</p>
            <div className="modal-actions vertical-actions">
              <button 
                onClick={() => {
                  setShowAvatarOptions(false)
                  triggerAvatarUpload()
                }} 
                className="action-btn upload-btn"
              >
                📷 Upload New Photo
              </button>
              <button 
                onClick={handleRemoveAvatar} 
                className="action-btn remove-btn"
              >
                🗑️ Remove Current Photo
              </button>
              <button 
                onClick={() => setShowAvatarOptions(false)} 
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      

      
      {/* Call Manager Component */}
      <CallManager 
        ref={callManagerRef}
        socket={socket}
        user={user}
        onlineUsers={onlineUsers}
        onCallStateChange={handleCallStateChange}
      />
    </div>
  )
}

export default Chat