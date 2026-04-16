// ── WEBRTC CALLING MODULE ─────────────────────────────
const CALL = {
  pc: null,           // RTCPeerConnection
  localStream: null,
  remoteStream: null,
  chatId: null,
  callType: null,     // 'audio' | 'video'
  isCaller: false,
  peerId: null,       // userId of the other person
  peerName: null,
  callStartTime: null,
  durationTimer: null,
  iceCandidateQueue: [],
  _callAccepted: false,
  _pendingSdpOffer: false,
};

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// ── INJECT CALL UI STYLES ─────────────────────────────
function injectCallStyles() {
  if (document.getElementById('callStyles')) return;
  const s = document.createElement('style');
  s.id = 'callStyles';
  s.textContent = `
    #callOverlay {
      position: fixed; inset: 0; z-index: 50000;
      background: rgba(7, 21, 37, 0.97);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 0; font-family: var(--font, 'Plus Jakarta Sans', sans-serif);
    }
    #callOverlay.hidden { display: none; }

    .co-avatar {
      width: 96px; height: 96px; border-radius: 50%;
      background: var(--acc, #4facfe);
      display: flex; align-items: center; justify-content: center;
      font-size: 36px; font-weight: 700; color: #071525;
      overflow: hidden; margin-bottom: 18px; flex-shrink: 0;
      border: 3px solid rgba(79,172,254,0.35);
    }
    .co-avatar img { width: 100%; height: 100%; object-fit: cover; }

    .co-name {
      font-size: 22px; font-weight: 700; color: #e8e8f0;
      margin-bottom: 6px; text-align: center;
    }
    .co-status {
      font-size: 14px; color: #7a8aa0; margin-bottom: 30px;
      text-align: center;
    }

    /* Remote video fills the overlay; local video is PiP */
    #remoteVideo {
      position: absolute; inset: 0;
      width: 100%; height: 100%; object-fit: cover;
      display: none; background: #000;
    }
    #localVideo {
      position: absolute; bottom: 100px; right: 16px;
      width: 120px; height: 90px; border-radius: 10px;
      object-fit: cover; border: 2px solid rgba(255,255,255,.2);
      display: none; z-index: 2; background: #111;
    }

    .co-inner {
      position: relative; z-index: 3;
      display: flex; flex-direction: column;
      align-items: center; width: 100%;
    }

    .co-controls {
      display: flex; gap: 18px; margin-top: 10px;
    }
    .cc-btn {
      width: 58px; height: 58px; border-radius: 50%;
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; transition: transform .12s, opacity .12s;
    }
    .cc-btn:hover { transform: scale(1.08); }
    .cc-btn:active { transform: scale(.96); opacity: .85; }
    .cc-btn.end   { background: #ef4444; color: #fff; }
    .cc-btn.mute  { background: rgba(255,255,255,.12); color: #e8e8f0; }
    .cc-btn.cam   { background: rgba(255,255,255,.12); color: #e8e8f0; }
    .cc-btn.active { background: rgba(255,255,255,.25); }
    .cc-btn i { font-size: 18px; pointer-events: none; }

    /* Incoming call card */
    #incomingCall {
      position: fixed; bottom: 28px; left: 50%;
      transform: translateX(-50%);
      z-index: 60000;
      background: #1a2030;
      border: 1px solid rgba(79,172,254,.3);
      border-radius: 20px;
      padding: 18px 24px;
      min-width: 300px; max-width: 360px;
      box-shadow: 0 16px 48px rgba(0,0,0,.7);
      display: flex; align-items: center; gap: 14px;
    }
    #incomingCall.hidden { display: none; }
    .ic-info { flex: 1; min-width: 0; }
    .ic-from { font-size: 15px; font-weight: 700; color: #e8e8f0; }
    .ic-type { font-size: 12px; color: #7a8aa0; margin-top: 2px; display: flex; align-items: center; gap: 5px; }
    .ic-type i { font-size: 11px; }
    .ic-btns { display: flex; gap: 10px; }
    .ic-ans { background: #22c55e; color: #fff; border: none; border-radius: 50%; width: 46px; height: 46px; font-size: 18px; cursor: pointer; transition: transform .12s; display: flex; align-items: center; justify-content: center; }
    .ic-ans:hover { transform: scale(1.1); }
    .ic-rej { background: #ef4444; color: #fff; border: none; border-radius: 50%; width: 46px; height: 46px; font-size: 16px; cursor: pointer; transition: transform .12s; display: flex; align-items: center; justify-content: center; }
    .ic-rej:hover { transform: scale(1.1); }

    @keyframes pulse-ring {
      0%   { box-shadow: 0 0 0 0 rgba(34,197,94,.5); }
      70%  { box-shadow: 0 0 0 16px rgba(34,197,94,0); }
      100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
    }
    .ic-ans { animation: pulse-ring 1.4s infinite; }

    .co-duration { font-size: 18px; color: #4facfe; font-weight: 600; margin-bottom: 4px; }
  `;
  document.head.appendChild(s);
}

// ── BUILD THE OVERLAY HTML ────────────────────────────
function buildCallOverlay() {
  injectCallStyles();
  if (document.getElementById('callOverlay')) return;

  const ov = document.createElement('div');
  ov.id = 'callOverlay';
  ov.className = 'hidden';
  ov.innerHTML = `
    <video id="remoteVideo" autoplay playsinline></video>
    <video id="localVideo"  autoplay playsinline muted></video>
    <div class="co-inner">
      <div class="co-avatar" id="coAvatar">?</div>
      <div class="co-name"   id="coName">—</div>
      <div class="co-duration hidden" id="coDuration">0:00</div>
      <div class="co-status" id="coStatus">Calling…</div>
      <div class="co-controls">
        <button class="cc-btn mute"       id="btnMute" onclick="CALL_toggleMute()"    title="Mute">
          <i class="fa-solid fa-microphone"></i>
        </button>
        <button class="cc-btn end"        onclick="endCall(true)"                     title="End call">
          <i class="fa-solid fa-phone-slash"></i>
        </button>
        <button class="cc-btn cam hidden" id="btnCam"  onclick="CALL_toggleCam()"    title="Camera">
          <i class="fa-solid fa-video"></i>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(ov);

  // Incoming call card
  const ic = document.createElement('div');
  ic.id = 'incomingCall';
  ic.className = 'hidden';
  ic.innerHTML = `
    <div class="co-avatar" id="icAvatar" style="width:50px;height:50px;font-size:18px;margin:0">?</div>
    <div class="ic-info">
      <div class="ic-from" id="icFrom">Someone</div>
      <div class="ic-type" id="icType">
        <i class="fa-solid fa-phone"></i> Incoming call
      </div>
    </div>
    <div class="ic-btns">
      <button class="ic-ans" onclick="answerCall()" title="Answer">
        <i class="fa-solid fa-phone"></i>
      </button>
      <button class="ic-rej" onclick="rejectCall()" title="Reject">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;
  document.body.appendChild(ic);
}

// ── START AN OUTGOING CALL ────────────────────────────
async function startCall(chatId, peerId, peerName, peerPic, type = 'audio') {
  if (CALL.pc) { toast('Already in a call', 'err'); return; }

  CALL.chatId        = chatId;
  CALL.peerId        = peerId;
  CALL.peerName      = peerName;
  CALL.callType      = type;
  CALL.isCaller      = true;
  CALL._callAccepted = false;
  CALL._pendingSdpOffer = false;

  buildCallOverlay();
  showCallOverlay(peerName, peerPic, 'Calling…', type);

  try {
    CALL.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video',
    });
  } catch (e) {
    toast('Could not access microphone/camera', 'err');
    resetCall();
    return;
  }

  if (type === 'video') {
    const lv = document.getElementById('localVideo');
    lv.srcObject = CALL.localStream;
    lv.style.display = 'block';
  }

  createPeerConnection();

  // Add tracks — this will trigger onnegotiationneeded, but we gate it
  // behind _callAccepted so the offer only goes out after the callee answers.
  CALL.localStream.getTracks().forEach(t => CALL.pc.addTrack(t, CALL.localStream));

  // Signal the callee via WebSocket (ring notification only — no SDP here)
  sendWS({
    type: 'call_offer',
    to: peerId,
    chatId,
    callType: type,
    from: APP.me._id,
    fromName: APP.me.name || APP.me.username,
  });
}

// ── HANDLE INCOMING call_offer (callee side) ──────────
function handleIncomingCallOffer(data) {
  if (CALL.pc) {
    // Already in a call — auto-reject
    sendWS({ type: 'call_rejected', to: data.from, chatId: data.chatId, reason: 'busy' });
    return;
  }

  CALL.chatId        = data.chatId;
  CALL.peerId        = data.from;
  CALL.peerName      = data.fromName || 'Unknown';
  CALL.callType      = data.callType || 'audio';
  CALL.isCaller      = false;
  CALL._pendingOffer = data; // store for when user taps Answer

  buildCallOverlay();

  const peer = APP._userCache[data.from] || {};
  const pic  = peer.profilePicture || '';
  const name = data.fromName || peer.name || peer.username || 'Unknown';

  // Show incoming card
  const ic = document.getElementById('incomingCall');
  const av = document.getElementById('icAvatar');
  const fr = document.getElementById('icFrom');
  const ty = document.getElementById('icType');

  if (pic) {
    av.innerHTML = `<img src="${pic}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  } else {
    av.textContent = name[0]?.toUpperCase() || '?';
    av.style.background = ac(name);
  }

  fr.textContent = name;
  ty.innerHTML = data.callType === 'video'
    ? '<i class="fa-solid fa-video"></i> Video call'
    : '<i class="fa-solid fa-phone"></i> Voice call';
  ic.classList.remove('hidden');

  playRingtone(true);
}

// ── ANSWER CALL ───────────────────────────────────────
async function answerCall() {
  playRingtone(false);
  document.getElementById('incomingCall').classList.add('hidden');

  const data = CALL._pendingOffer;
  if (!data) return;

  const peer = APP._userCache[CALL.peerId] || {};
  showCallOverlay(CALL.peerName, peer.profilePicture || '', 'Connecting…', CALL.callType);

  try {
    CALL.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: CALL.callType === 'video',
    });
  } catch (e) {
    toast('Could not access microphone/camera', 'err');
    resetCall();
    sendWS({ type: 'call_rejected', to: CALL.peerId, chatId: CALL.chatId, reason: 'no_device' });
    return;
  }

  if (CALL.callType === 'video') {
    const lv = document.getElementById('localVideo');
    lv.srcObject = CALL.localStream;
    lv.style.display = 'block';
  }

  createPeerConnection();
  CALL.localStream.getTracks().forEach(t => CALL.pc.addTrack(t, CALL.localStream));

  // Tell the caller we're ready — they will now send us the sdp_offer
  sendWS({ type: 'call_accepted', to: CALL.peerId, chatId: CALL.chatId, from: APP.me._id });
  console.log('[WebRTC] call_accepted sent to caller');
}

// ── REJECT INCOMING CALL ──────────────────────────────
function rejectCall() {
  playRingtone(false);
  document.getElementById('incomingCall').classList.add('hidden');
  sendWS({ type: 'call_rejected', to: CALL.peerId, chatId: CALL.chatId, reason: 'declined' });
  resetCall();
}

// ── CREATE PEER CONNECTION ────────────────────────────
function createPeerConnection() {
  CALL.pc = new RTCPeerConnection(ICE_SERVERS);

  CALL.pc.onicecandidate = (e) => {
    if (e.candidate) {
      sendWS({ type: 'ice_candidate', to: CALL.peerId, chatId: CALL.chatId, candidate: e.candidate });
    }
  };

  CALL.pc.onconnectionstatechange = () => {
    const state = CALL.pc?.connectionState;
    console.log('[WebRTC] Connection state:', state);
    const statusEl = document.getElementById('coStatus');
    if (state === 'connected') {
      if (statusEl) statusEl.classList.add('hidden');
      startCallDurationTimer();
    } else if (state === 'disconnected' || state === 'failed') {
      if (statusEl) { statusEl.textContent = 'Connection lost'; statusEl.classList.remove('hidden'); }
      setTimeout(() => endCall(false), 2000);
    }
  };

  CALL.pc.ontrack = (e) => {
    CALL.remoteStream = e.streams[0];
    const rv = document.getElementById('remoteVideo');
    if (rv) {
      rv.srcObject = CALL.remoteStream;
      if (CALL.callType === 'video') rv.style.display = 'block';
    }
    // For audio-only: play through a hidden audio element
    if (CALL.callType === 'audio') {
      let audio = document.getElementById('remoteAudio');
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = 'remoteAudio';
        audio.autoplay = true;
        document.body.appendChild(audio);
      }
      audio.srcObject = CALL.remoteStream;
    }
  };

  // ── KEY FIX: gate the offer behind _callAccepted ──────
  // onnegotiationneeded fires as soon as tracks are added (before the callee
  // has even answered). We buffer it and only actually send the offer once
  // we receive call_accepted from the callee.
  CALL.pc.onnegotiationneeded = async () => {
    if (!CALL.isCaller) return; // callee never initiates the offer
    if (!CALL._callAccepted) {
      // Callee hasn't answered yet — remember we need to send offer later
      console.log('[WebRTC] onnegotiationneeded fired early — buffering until call_accepted');
      CALL._pendingSdpOffer = true;
      return;
    }
    await _sendSdpOffer();
  };
}

// ── HELPER: build and send the SDP offer ─────────────
async function _sendSdpOffer() {
  if (!CALL.pc) return;
  try {
    const offer = await CALL.pc.createOffer();
    await CALL.pc.setLocalDescription(offer);
    sendWS({ type: 'sdp_offer', to: CALL.peerId, chatId: CALL.chatId, sdp: offer });
    console.log('[WebRTC] sdp_offer sent');
  } catch (e) {
    console.error('[WebRTC] _sendSdpOffer error:', e);
  }
}

// ── HANDLE call_accepted (caller side) ────────────────
// THIS is the correct place to kick off the SDP exchange.
async function handleCallAccepted(data) {
  console.log('[WebRTC] call_accepted received — triggering sdp_offer');
  const statusEl = document.getElementById('coStatus');
  if (statusEl) statusEl.textContent = 'Connecting…';

  CALL._callAccepted = true;

  // Send the offer now (onnegotiationneeded may have already fired and buffered it)
  await _sendSdpOffer();
}

// ── HANDLE sdp_offer (callee receives offer from caller) ──
async function handleSdpOffer(data) {
  if (!CALL.pc) {
    console.warn('[WebRTC] handleSdpOffer: no PeerConnection, ignoring.');
    return;
  }
  if (!data.sdp || !data.sdp.type) {
    console.warn('[WebRTC] handleSdpOffer: missing or invalid SDP, ignoring.');
    return;
  }
  try {
    console.log('[WebRTC] sdp_offer received — setting remote description');
    await CALL.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    flushIceCandidateQueue();
    const answer = await CALL.pc.createAnswer();
    await CALL.pc.setLocalDescription(answer);
    sendWS({ type: 'sdp_answer', to: CALL.peerId, chatId: CALL.chatId, sdp: answer });
    console.log('[WebRTC] sdp_answer sent');
  } catch (e) {
    console.error('[WebRTC] handleSdpOffer error:', e);
  }
}

// ── HANDLE sdp_answer (caller receives answer from callee) ──
async function handleSdpAnswer(data) {
  if (!CALL.pc) return;
  if (!data.sdp || !data.sdp.type) {
    console.warn('[WebRTC] handleSdpAnswer: missing or invalid SDP, ignoring.');
    return;
  }
  if (CALL.pc.signalingState === 'stable') {
    console.warn('[WebRTC] handleSdpAnswer: already stable, ignoring.');
    return;
  }
  try {
    console.log('[WebRTC] sdp_answer received — setting remote description');
    await CALL.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    flushIceCandidateQueue();
  } catch (e) {
    console.error('[WebRTC] handleSdpAnswer error:', e);
  }
}

// ── HANDLE call_answer (alias — kept for backwards compat) ──
async function handleCallAnswer(data) {
  await handleSdpAnswer(data);
}

// ── ICE CANDIDATES ────────────────────────────────────
async function handleIceCandidate(data) {
  const candidate = new RTCIceCandidate(data.candidate);
  if (CALL.pc && CALL.pc.remoteDescription) {
    try { await CALL.pc.addIceCandidate(candidate); }
    catch (e) { console.error('[WebRTC] ICE addIceCandidate error:', e); }
  } else {
    // Queue it until remote description is set
    CALL.iceCandidateQueue.push(candidate);
  }
}

async function flushIceCandidateQueue() {
  while (CALL.iceCandidateQueue.length && CALL.pc) {
    try { await CALL.pc.addIceCandidate(CALL.iceCandidateQueue.shift()); }
    catch (e) { console.error('[WebRTC] ICE flush error:', e); }
  }
}

// ── END CALL ──────────────────────────────────────────
function endCall(notify = true) {
  if (notify && CALL.peerId) {
    sendWS({ type: 'call_ended', to: CALL.peerId, chatId: CALL.chatId });
  }
  resetCall();
}

function handleCallEnded() {
  toast('Call ended', '', 2500);
  resetCall();
}

function handleCallRejected(data) {
  const msg = data.reason === 'busy'    ? 'User is busy'
            : data.reason === 'offline' ? 'User is offline'
            : 'Call declined';
  toast(msg, 'err', 3000);
  resetCall();
}

function resetCall() {
  stopCallDurationTimer();
  playRingtone(false);

  if (CALL.localStream) {
    CALL.localStream.getTracks().forEach(t => t.stop());
    CALL.localStream = null;
  }
  if (CALL.pc) { CALL.pc.close(); CALL.pc = null; }

  CALL.chatId           = null;
  CALL.peerId           = null;
  CALL.peerName         = null;
  CALL.callType         = null;
  CALL.isCaller         = false;
  CALL.remoteStream     = null;
  CALL.iceCandidateQueue = [];
  CALL._callAccepted    = false;
  CALL._pendingSdpOffer = false;
  delete CALL._pendingOffer;

  const ov = document.getElementById('callOverlay');
  if (ov) ov.classList.add('hidden');
  document.getElementById('incomingCall')?.classList.add('hidden');

  const ra = document.getElementById('remoteAudio');
  if (ra) ra.remove();
}

// ── IN-CALL CONTROLS ──────────────────────────────────
function CALL_toggleMute() {
  if (!CALL.localStream) return;
  const track = CALL.localStream.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  const btn = document.getElementById('btnMute');
  if (btn) {
    btn.classList.toggle('active', !track.enabled);
    btn.innerHTML = track.enabled
      ? '<i class="fa-solid fa-microphone"></i>'
      : '<i class="fa-solid fa-microphone-slash"></i>';
  }
}

function CALL_toggleCam() {
  if (!CALL.localStream) return;
  const track = CALL.localStream.getVideoTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  const btn = document.getElementById('btnCam');
  if (btn) {
    btn.classList.toggle('active', !track.enabled);
    btn.innerHTML = track.enabled
      ? '<i class="fa-solid fa-video"></i>'
      : '<i class="fa-solid fa-video-slash"></i>';
  }
}

// ── OVERLAY HELPERS ───────────────────────────────────
function showCallOverlay(name, pic, status, type) {
  buildCallOverlay();
  const ov  = document.getElementById('callOverlay');
  const av  = document.getElementById('coAvatar');
  const nm  = document.getElementById('coName');
  const st  = document.getElementById('coStatus');
  const cam = document.getElementById('btnCam');

  if (pic) {
    av.innerHTML = `<img src="${pic}" style="width:100%;height:100%;object-fit:cover">`;
  } else {
    av.textContent = name[0]?.toUpperCase() || '?';
    av.style.background = ac(name);
  }

  nm.textContent = name;
  st.textContent = status;
  st.classList.remove('hidden');
  document.getElementById('coDuration').classList.add('hidden');

  if (cam) cam.classList.toggle('hidden', type !== 'video');
  ov.classList.remove('hidden');
}

// ── CALL DURATION TIMER ───────────────────────────────
function startCallDurationTimer() {
  CALL.callStartTime = Date.now();
  const durEl  = document.getElementById('coDuration');
  const statEl = document.getElementById('coStatus');
  if (statEl) statEl.classList.add('hidden');
  if (durEl)  durEl.classList.remove('hidden');

  CALL.durationTimer = setInterval(() => {
    const s   = Math.floor((Date.now() - CALL.callStartTime) / 1000);
    const m   = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, '0');
    if (durEl) durEl.textContent = `${m}:${sec}`;
  }, 1000);
}

function stopCallDurationTimer() {
  clearInterval(CALL.durationTimer);
  CALL.durationTimer = null;
  CALL.callStartTime = null;
}

// ── RINGTONE ──────────────────────────────────────────
// AudioContext must be created/resumed after a user gesture.
// We create a fresh context each beep and immediately resume it.
let _ringtoneCtx   = null;
let _ringtoneTimer = null;

function playRingtone(on) {
  if (!on) {
    clearInterval(_ringtoneTimer);
    _ringtoneTimer = null;
    if (_ringtoneCtx) {
      try { _ringtoneCtx.close(); } catch (_) {}
      _ringtoneCtx = null;
    }
    return;
  }

  const beep = () => {
    try {
      // Close previous context to avoid accumulation
      if (_ringtoneCtx) { try { _ringtoneCtx.close(); } catch (_) {} }
      _ringtoneCtx = new (window.AudioContext || window.webkitAudioContext)();
      // Resume in case browser suspended it (autoplay policy)
      if (_ringtoneCtx.state === 'suspended') _ringtoneCtx.resume();

      const osc  = _ringtoneCtx.createOscillator();
      const gain = _ringtoneCtx.createGain();
      osc.connect(gain);
      gain.connect(_ringtoneCtx.destination);
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.2, _ringtoneCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, _ringtoneCtx.currentTime + 0.4);
      osc.start(_ringtoneCtx.currentTime);
      osc.stop(_ringtoneCtx.currentTime + 0.4);
    } catch (_) {}
  };

  beep();
  _ringtoneTimer = setInterval(beep, 1200);
}

// ── WS HELPER (sends via the app's _ws) ───────────────
function sendWS(data) {
  if (typeof _ws !== 'undefined' && _ws && _ws.readyState === 1) {
    _ws.send(JSON.stringify(data));
  } else {
    console.warn('[WebRTC] sendWS: WebSocket not open, dropping message:', data.type);
  }
}

// ── INIT ──────────────────────────────────────────────
buildCallOverlay();