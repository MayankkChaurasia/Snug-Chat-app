import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import './CallManager.css'

const CallManager = forwardRef(({ socket, user, onlineUsers, onCallStateChange }, ref) => {
  const [callState, setCallState] = useState('idle')
  const [currentCall, setCurrentCall] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isVideoCall, setIsVideoCall] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [incomingCall, setIncomingCall] = useState(null)
  const [callTimer, setCallTimer] = useState(0)
  const [connectionState, setConnectionState] = useState('new')

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const timerRef = useRef(null)


  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }


  const startCallTimer = () => {
    timerRef.current = setInterval(() => {
      setCallTimer(prev => prev + 1)
    }, 1000)
  }


  const stopCallTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setCallTimer(0)
  }


  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }


  const getUserMedia = async (video = false) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera/Microphone access is disabled by your browser because this site is being accessed over insecure HTTP instead of HTTPS (this happens when accessing local IPs like 192.168.x.x on mobile devices).\n\nTo enable voice/video features:\n1. On Laptop: Access via 'http://localhost:5173'\n2. On Mobile (Chrome): Search 'chrome://flags/#unsafely-treat-insecure-origin-as-secure' in Chrome, enter your laptop's URL (e.g. 'http://192.168.x.x:5173'), set to 'Enabled', and restart Chrome.\n3. Alternatively, host the app with HTTPS or use a tunneling tool like ngrok.");
        return null
      }

      // Try capturing video + audio if requested
      if (video) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
          })
          setLocalStream(stream)
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream
          }
          return stream
        } catch (videoError) {
          console.warn('Camera access failed, falling back to audio-only:', videoError)
          alert('Could not access or detect a working camera. Starting a voice-only call instead.')
          setIsVideoCall(false)
        }
      }

      // Fallback or explicit audio-only capture
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      })
      
      setLocalStream(stream)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      
      return stream
    } catch (error) {
      console.error('Error accessing media devices:', error)
      alert('Could not access your microphone. Please ensure you have allowed permissions in your browser settings and a working microphone is connected.')
      return null
    }
  }


  const endCall = () => {
    if (socket && currentCall) {
      socket.emit('end_call', {
        callId: currentCall.id,
        endedBy: user.userId
      })
    }
    

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
      setLocalStream(null)
    }
    
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop())
      setRemoteStream(null)
    }
    

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    

    setCallState('idle')
    setCurrentCall(null)
    setIncomingCall(null)
    setIsMuted(false)
    setIsVideoEnabled(true)
    setConnectionState('new')
    stopCallTimer()
    

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
  }


  const startVoiceCall = async (targetUser) => {
    if (!socket || callState !== 'idle') return
    
    const stream = await getUserMedia(false)
    if (!stream) return
    
    setIsVideoCall(false)
    setCallState('calling')
    
    const callData = {
      id: Date.now().toString(),
      caller: user,
      participant: targetUser,
      isVideo: false,
      timestamp: new Date().toISOString()
    }
    
    setCurrentCall(callData)
    socket.emit('initiate_call', callData)
  }


  const startVideoCall = async (targetUser) => {
    if (!socket || callState !== 'idle') return
    
    const stream = await getUserMedia(true)
    if (!stream) return
    
    const hasVideo = stream.getVideoTracks().length > 0
    setIsVideoCall(hasVideo)
    setCallState('calling')
    
    const callData = {
      id: Date.now().toString(),
      caller: user,
      participant: targetUser,
      isVideo: hasVideo,
      timestamp: new Date().toISOString()
    }
    
    setCurrentCall(callData)
    socket.emit('initiate_call', callData)
  }


  const createPeerConnection = useCallback(() => {
    const peerConnection = new RTCPeerConnection(rtcConfig)

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket && currentCall) {
        socket.emit('ice_candidate', {
          candidate: event.candidate,
          callId: currentCall.id,
          to: currentCall.participant.userId
        })
      }
    }

    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams
      setRemoteStream(remoteStream)
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream
      }
    }

    peerConnection.onconnectionstatechange = () => {
      setConnectionState(peerConnection.connectionState)
      if (peerConnection.connectionState === 'connected') {
        startCallTimer()
      } else if (['disconnected', 'failed', 'closed'].includes(peerConnection.connectionState)) {
        endCall()
      }
    }

    return peerConnection
  }, [socket, currentCall])


  useImperativeHandle(ref, () => ({
    startVoiceCall,
    startVideoCall,
    callState,
    isInCall: callState !== 'idle'
  }), [startVoiceCall, startVideoCall, callState])


  useEffect(() => {
    if (onCallStateChange) {
      onCallStateChange(callState)
    }
  }, [callState, onCallStateChange])


  useEffect(() => {
    if (!socket) return

    socket.on('incoming_call', (callData) => {
      setIncomingCall(callData)
      setCallState('receiving')
      setIsVideoCall(callData.isVideo)
    })

    socket.on('call_accepted', async (callData) => {
      if (callState === 'calling') {
        setCurrentCall(callData)
        setCallState('in_call')
        
        const peerConnection = createPeerConnection()
        peerConnectionRef.current = peerConnection
        
        if (localStream) {
          localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream)
          })
        }
        
        try {
          const offer = await peerConnection.createOffer()
          await peerConnection.setLocalDescription(offer)
          
          socket.emit('webrtc_offer', {
            offer,
            callId: callData.id,
            to: callData.participant.userId
          })
        } catch (error) {
          console.error('Error creating offer:', error)
          endCall()
        }
      }
    })

    socket.on('call_rejected', () => {
      if (callState === 'calling') {
        endCall()
        alert('Call was rejected')
      }
    })

    socket.on('call_ended', () => {
      endCall()
    })

    socket.on('webrtc_offer', async (data) => {
      if (callState === 'in_call' && peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(data.offer)
          const answer = await peerConnectionRef.current.createAnswer()
          await peerConnectionRef.current.setLocalDescription(answer)
          
          socket.emit('webrtc_answer', {
            answer,
            callId: data.callId,
            to: data.from
          })
        } catch (error) {
          console.error('Error handling offer:', error)
          endCall()
        }
      }
    })

    socket.on('webrtc_answer', async (data) => {
      if (callState === 'in_call' && peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(data.answer)
        } catch (error) {
          console.error('Error handling answer:', error)
          endCall()
        }
      }
    })

    socket.on('ice_candidate', async (data) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(data.candidate)
        } catch (error) {
          console.error('Error adding ICE candidate:', error)
        }
      }
    })

    return () => {
      socket.off('incoming_call')
      socket.off('call_accepted')
      socket.off('call_rejected')
      socket.off('call_ended')
      socket.off('webrtc_offer')
      socket.off('webrtc_answer')
      socket.off('ice_candidate')
    }
  }, [socket, callState, localStream, createPeerConnection])


  const acceptCall = async () => {
    if (!incomingCall || !socket) return
    
    const stream = await getUserMedia(incomingCall.isVideo)
    if (!stream) return
    
    setCurrentCall(incomingCall)
    setCallState('in_call')
    
    const peerConnection = createPeerConnection()
    peerConnectionRef.current = peerConnection
    
    stream.getTracks().forEach(track => {
      peerConnection.addTrack(track, stream)
    })
    
    socket.emit('accept_call', {
      callId: incomingCall.id,
      acceptedBy: user.userId
    })
    
    setIncomingCall(null)
  }


  const rejectCall = () => {
    if (!incomingCall || !socket) return
    
    socket.emit('reject_call', {
      callId: incomingCall.id,
      rejectedBy: user.userId
    })
    
    setIncomingCall(null)
    setCallState('idle')
  }


  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMuted(!audioTrack.enabled)
      }
    }
  }


  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoEnabled(videoTrack.enabled)
      }
    }
  }


  const CallControls = () => (
    <div className="call-controls">
      <button
        className={`control-btn ${isMuted ? 'muted' : ''}`}
        onClick={toggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '🔇' : '🎤'}
      </button>
      
      {isVideoCall && (
        <button
          className={`control-btn ${!isVideoEnabled ? 'disabled' : ''}`}
          onClick={toggleVideo}
          title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isVideoEnabled ? '📹' : '📷'}
        </button>
      )}
      
      <button
        className="control-btn end-call"
        onClick={endCall}
        title="End call"
      >
        📞
      </button>
    </div>
  )


  if (incomingCall) {
    return (
      <div className="call-overlay">
        <div className="incoming-call-modal glass">
          <div className="caller-info">
            <div className="caller-avatar">
              {incomingCall.caller.username.charAt(0).toUpperCase()}
            </div>
            <h3>Incoming {incomingCall.isVideo ? 'Video' : 'Voice'} Call</h3>
            <p>{incomingCall.caller.username}</p>
          </div>
          
          <div className="incoming-call-actions">
            <button className="accept-btn" onClick={acceptCall}>
              {incomingCall.isVideo ? '📹' : '📞'} Accept
            </button>
            <button className="reject-btn" onClick={rejectCall}>
              ❌ Decline
            </button>
          </div>
        </div>
      </div>
    )
  }


  if (callState === 'calling' || callState === 'in_call') {
    const participant = currentCall?.participant || currentCall?.caller
    
    return (
      <div className="call-overlay">
        <div className={`call-interface ${isVideoCall ? 'video-call' : 'voice-call'}`}>
          {isVideoCall ? (
            <div className="video-container">
              <video
                ref={remoteVideoRef}
                className="remote-video"
                autoPlay
                playsInline
              />
              
              <video
                ref={localVideoRef}
                className="local-video"
                autoPlay
                playsInline
                muted
              />
              
              <div className="call-info">
                <div className="participant-name">{participant?.username}</div>
                <div className="call-status">
                  {callState === 'calling' ? 'Calling...' : formatTime(callTimer)}
                </div>
                <div className="connection-status">
                  {connectionState === 'connecting' && 'Connecting...'}
                  {connectionState === 'connected' && '🟢 Connected'}
                  {connectionState === 'disconnected' && '🟡 Reconnecting...'}
                  {connectionState === 'failed' && '🔴 Connection failed'}
                </div>
              </div>
              
              <CallControls />
            </div>
          ) : (
            <div className="voice-call-container">
              <div className="participant-avatar">
                {participant?.username.charAt(0).toUpperCase()}
              </div>
              
              <div className="call-info">
                <h3>{participant?.username}</h3>
                <div className="call-status">
                  {callState === 'calling' ? 'Calling...' : formatTime(callTimer)}
                </div>
                <div className="connection-status">
                  {connectionState === 'connecting' && 'Connecting...'}
                  {connectionState === 'connected' && '🟢 Connected'}
                  {connectionState === 'disconnected' && '🟡 Reconnecting...'}
                  {connectionState === 'failed' && '🔴 Connection failed'}
                </div>
              </div>
              
              <CallControls />
            </div>
          )}
        </div>
      </div>
    )
  }


  return null
})

export default CallManager