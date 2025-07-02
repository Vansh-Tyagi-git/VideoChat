console.log('[client.js loaded]');

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

  const mainVideo = document.getElementById('mainVideo');
  mainVideo.srcObject = stream;
  mainVideo.addEventListener('loadedmetadata', () => mainVideo.play());
  myVideo.srcObject = stream;
  myVideo.addEventListener('loadedmetadata', () => myVideo.play());
  videoGrid.append(myVideo);

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
