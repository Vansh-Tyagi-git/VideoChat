console.log('[client.js loaded]');
const roomId = window.ROOM_ID || window.location.pathname.split('/')[1];
const roomIdDisplay = document.getElementById('room-id-display');

roomIdDisplay.textContent = roomId;
const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
myVideo.muted = true;
const peers = {};

let localStream;
let myPeerId = null;

const myPeer = new Peer(undefined, {
  host: 'localhost',
  port: 3001,
  path: '/',
  secure: false
});

navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
  console.log('[Got media stream]');
  localStream = stream;

  // Set up main video
  const mainVideo = document.getElementById('mainVideo');
  mainVideo.srcObject = stream;
  mainVideo.addEventListener('loadedmetadata', () => mainVideo.play());
  myVideo.srcObject = stream;
  myVideo.addEventListener('loadedmetadata', () => myVideo.play());
  videoGrid.append(myVideo);

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

  myPeer.on('call', call => {
    call.answer(localStream);
    const video = document.createElement('video');
    call.on('stream', userVideoStream => {
      video.srcObject = userVideoStream;
      video.addEventListener('loadedmetadata', () => video.play());
      videoGrid.append(video);
    });
  });

  socket.on('approved', () => {
    console.log('[Approved by host]');
    document.querySelector('.waiting-panel').innerHTML = '';
    socket.emit('join-room', {
      roomId: window.ROOM_ID,
      userId: myPeerId,
      socketId: socket.id
    });
  });

  socket.on('user-connected', userId => {
    console.log('[User connected]', userId);
    connectToPeer(userId);
  });

  socket.on('host-peer-id', hostPeerId => {
    console.log('[Received host peer ID]', hostPeerId);
    connectToPeer(hostPeerId);
  });

  socket.on('user-disconnected', userId => {
    if (peers[userId]) peers[userId].close();
  });
});

myPeer.on('open', id => {
  myPeerId = id;
  socket.peerId = id; // 🔑 Attach peerId to socket
  
  setTimeout(() => {
    socket.emit('request-to-join', {
      roomId: window.ROOM_ID,
      userId: id,
      socketId: socket.id
    });
  }, 500);
});

function connectToPeer(peerId) {
  if (!localStream || peers[peerId]) return;
  const call = myPeer.call(peerId, localStream);
  const video = document.createElement('video');
  call.on('stream', userVideoStream => {
    video.srcObject = userVideoStream;
    video.addEventListener('loadedmetadata', () => video.play());
    videoGrid.append(video);
  });
  call.on('close', () => video.remove());
  peers[peerId] = call;
}

const leaveCallBtn = document.getElementById('leaveCallBtn');
leaveCallBtn.addEventListener('click', () => {
  // Stop local media
  const stream = document.getElementById('mainVideo')?.srcObject;
  if (stream) stream.getTracks().forEach(track => track.stop());

  // Close PeerJS connections
  for (let peerId in peers) {
    peers[peerId]?.close?.();
    delete peers[peerId];
  }

  // Disconnect socket and destroy peer
  socket.disconnect();
  myPeer?.destroy?.();

  // Replace body content with join form
  document.body.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#1a4040; font-family:Segoe UI, sans-serif; color:white; text-align:center;">
      <h2 style="font-size:2rem; margin-bottom:10px;">You have left the call</h2>
      <p style="margin-bottom: 20px;">Enter a Room ID to join another room</p>
      
      <input id="joinRoomInput" placeholder="Room ID..." 
        style="padding: 12px; width: 280px; border-radius: 6px; border: none; outline: none; font-size: 1rem;" />
      
      <button id="goToRoom"
        style="margin-top: 15px; padding: 12px 24px; background-color: #4CAF50; color: white; font-size: 1rem; border: none; border-radius: 6px; cursor: pointer;">
        Join Room
      </button>
      
      <div id="error-msg" style="margin-top: 15px; color: #ff4d4d; font-weight: bold;"></div>
    </div>
  `;

  // Add listener for Join
  document.getElementById('goToRoom').addEventListener('click', () => {
    const roomId = document.getElementById('joinRoomInput').value.trim();
    const errorMsg = document.getElementById('error-msg');

    // Basic validation
    if (!roomId || !/^[a-zA-Z0-9\-]{5,}$/.test(roomId)) {
      errorMsg.textContent = '❌ Please enter a valid Room ID.';
      return;
    }

    // Redirect if valid
    window.location.href = `/${roomId}/client`;
  });
});
