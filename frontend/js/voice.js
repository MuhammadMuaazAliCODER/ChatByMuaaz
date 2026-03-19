// =====================================================
// VOICE RECORDING MODULE — FINAL CLEAN VERSION
// =====================================================
// HOW TO USE:
//   1. Delete ALL of the following from your main app JS:
//      - old toggleMic()
//      - old startRecording()
//      - old stopAndSendRecording()
//      - old cancelRecording()
//      - old showRecBar() / hideRecBar()
//      - old uploadAudio()
//      - the two btn_pro / btn_voice click listeners
//        at the bottom of your files
//   2. Paste THIS entire file's content in their place
//      (or include it as a separate <script> after app.js)
// =====================================================

const VOICE = (() => {
  let mediaRecorder  = null;
  let audioChunks    = [];
  let timerInterval  = null;
  let secondsElapsed = 0;
  let isRecording    = false;

  // ── Helpers ────────────────────────────────────────
  function fmtTime(s) {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  function _showRecUI() {
    document.getElementById('recBar')?.classList.remove('hidden');
    document.getElementById('inputBar')?.classList.add('hidden');
    document.getElementById('micBtn')?.classList.add('recording');
  }

  function _hideRecUI() {
    document.getElementById('recBar')?.classList.add('hidden');
    document.getElementById('inputBar')?.classList.remove('hidden');
    document.getElementById('micBtn')?.classList.remove('recording');
    const el = document.getElementById('recTime');
    if (el) el.textContent = '0:00';
  }

  function _stopTimer() {
    clearInterval(timerInterval);
    timerInterval  = null;
    secondsElapsed = 0;
  }

  function _startTimer() {
    secondsElapsed = 0;
    timerInterval  = setInterval(() => {
      secondsElapsed++;
      const el = document.getElementById('recTime');
      if (el) el.textContent = fmtTime(secondsElapsed);
      if (secondsElapsed >= 120) stop(); // auto-stop at 2 min
    }, 1000);
  }

  // ── Upload + send ─────────────────────────────────
  async function _uploadAndSend(blob) {
    if (!APP.currentChatId) {
      toast('No chat selected', 'err');
      return;
    }
    if (!blob || blob.size === 0) {
      toast('Recording was empty, please try again', 'err');
      return;
    }

    toast('Sending voice message…');

    // Step 1: upload the raw audio file
    const fd = new FormData();
    fd.append('audio', blob, 'voice.webm');

    const uploadRes = await API.voicemessage(fd);

    if (!uploadRes.ok) {
      toast(uploadRes.data?.message || 'Failed to upload audio', 'err');
      return;
    }

    const audioUrl = uploadRes.data?.url;
    if (!audioUrl) {
      toast('Upload succeeded but no URL returned', 'err');
      return;
    }

    // Step 2: send the message with the audio URL
    const msgRes = await API.sendAudioMessage({
      chatId:  APP.currentChatId,
      type:    'audio',
      audioUrl,
      content: '🎤 Voice message'
    });

    if (msgRes.ok) {
      APP._lastIds.clear();
      await loadMessages();
      loadChats();
    } else {
      toast(msgRes.data?.message || 'Failed to send voice message', 'err');
    }
  }

  // ── Public API ────────────────────────────────────

  async function start() {
    if (isRecording) return; // guard against double-tap

    if (!navigator.mediaDevices?.getUserMedia) {
      toast('Microphone not supported in this browser', 'err');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      toast('Microphone access denied', 'err');
      return;
    }

    audioChunks  = [];
    isRecording  = true;
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      // Stop all mic tracks immediately so the browser mic indicator goes away
      stream.getTracks().forEach(t => t.stop());

      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];

      if (!blob || blob.size === 0) {
        toast('Recording was too short or empty', 'err');
        return;
      }

      await _uploadAndSend(blob);
    };

    // 250 ms timeslice = data available frequently → no empty buffer on stop
    mediaRecorder.start(250);

    _showRecUI();
    _startTimer();
  }

  function stop() {
    if (!isRecording || !mediaRecorder) return;
    isRecording = false;
    _stopTimer();
    _hideRecUI();
    mediaRecorder.stop(); // triggers onstop → _uploadAndSend
    mediaRecorder = null;
  }

  function cancel() {
    if (!isRecording || !mediaRecorder) return;

    // Override onstop so we don't upload anything
    mediaRecorder.onstop = () => {};

    isRecording = false;
    _stopTimer();
    _hideRecUI();

    if (mediaRecorder.state === 'recording') mediaRecorder.stop();
    mediaRecorder = null;
    audioChunks   = [];

    toast('Recording cancelled');
  }

  return { start, stop, cancel, isRecording: () => isRecording };
})();

// ── Global functions called from HTML ─────────────────
// Your HTML buttons call these directly, so keep them global.

function toggleMic() {
  if (VOICE.isRecording()) {
    VOICE.stop();
  } else {
    VOICE.start();
  }
}

function stopAndSendRecording() {
  VOICE.stop();
}

function cancelRecording() {
  VOICE.cancel();
}