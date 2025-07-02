console.log('[host.js loaded]');

// Show Room ID on the page
const roomId = window.ROOM_ID || window.location.pathname.split('/')[1];
const roomIdDisplay = document.getElementById('room-id-display');
if (roomIdDisplay) {
  roomIdDisplay.textContent = roomId;
}

// Copy link to clipboard when button clicked
const copyBtn = document.getElementById('copy-room-btn');
if (copyBtn) {
  copyBtn.addEventListener('click', () => {
    const roomLink = `${window.location.origin}/${roomId}/client`;
    navigator.clipboard.writeText(roomLink)
      .then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = 'Copy Link';
        }, 2000);
      })
      .catch(() => {
        copyBtn.textContent = 'Failed to copy';
      });
  });
}




const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const approvalPanel = document.getElementById('approval-panel');
const myVideo = document.createElement('video');
myVideo.muted = true;
const peers = {};

const myPeer = new Peer(undefined, {
  host: 'peerjs-server-9g9m.onrender.com',
  port: 443,
  path: '/peerjs',
  secure: true
});


socket.emit('register-host', window.ROOM_ID);

navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
  myVideo.srcObject = stream;
  // Set up main video
  const mainVideo = document.getElementById('mainVideo');
  mainVideo.srcObject = stream;
  mainVideo.addEventListener('loadedmetadata', () => mainVideo.play());
  myVideo.addEventListener('loadedmetadata', () => myVideo.play());
  videoGrid.append(myVideo);

  myPeer.on('call', call => {//reciving call
    call.answer(stream);
    const video = document.createElement('video');
    video.id = `video-${call.peer}`; // Unique ID for later removal
    
    // Store the call for later reference
    peers[call.peer] = call; // 🔑 CRITICAL: Store call object
    
    call.on('stream', userVideoStream => {
      video.srcObject = userVideoStream;
      video.addEventListener('loadedmetadata', () => video.play());
      videoGrid.append(video);

    });

    // Add call cleanup handler
    call.on('close', () => {
      if (video) video.remove();
      delete peers[call.peer]; // Cleanup peers reference
    });
  });
  
  const micBtn = document.getElementById('micBtn');
  const cameraBtn = document.getElementById('cameraBtn');

  // MIC TOGGLE
  micBtn.addEventListener('click', () => {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    const isEnabled = audioTrack.enabled;
    audioTrack.enabled = !isEnabled;

    micBtn.classList.toggle('muted', isEnabled);
    micBtn.classList.toggle('active', !isEnabled);
  });

  // CAMERA TOGGLE
  cameraBtn.addEventListener('click', () => {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    const isEnabled = videoTrack.enabled;
    videoTrack.enabled = !isEnabled;

    cameraBtn.classList.toggle('off', isEnabled);
    cameraBtn.classList.toggle('active', !isEnabled);
  });


});

myPeer.on('open', id => {
  console.log('[Host Peer opened]', id);
});
myPeer.on('open', id => {
    console.log('[Host Peer opened]', id);
    socket.emit('host-peer-id', { roomId: window.ROOM_ID, peerId: id });
});

socket.on('join-request', ({ userId, socketId }) => {
  const btn = document.createElement('button');
  btn.textContent = `Allow ${userId}`;
  btn.className = 'approve-btn';
  btn.onclick = () => {
    socket.emit('approve-user', {
      roomId: window.ROOM_ID,
      socketId
    });
    btn.remove();
  };
  approvalPanel.appendChild(btn);
});

socket.on('user-disconnected', userId => {
  if (peers[userId]) {
    peers[userId].close(); // Now works because call is stored
  }
  // Video removal already handled by call's 'close' event
});

