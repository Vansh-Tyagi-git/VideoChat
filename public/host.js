console.log('[host.js loaded]');

const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const approvalPanel = document.getElementById('approval-panel');
const myVideo = document.createElement('video');
myVideo.muted = true;
const peers = {};

const myPeer = new Peer(undefined, {
  host: 'localhost',
  port: 3001,
  path: '/',
  secure: false
});

socket.emit('register-host', window.ROOM_ID);

navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
  myVideo.srcObject = stream;
  myVideo.addEventListener('loadedmetadata', () => myVideo.play());
  videoGrid.append(myVideo);

  myPeer.on('call', call => {
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
