const btn_voice =  getElementById('micBtn');
btn_voice.addEventListener('click',() =>{
    toast('Audio recording feature is currently in testing and may not work perfectly. Please try again later.', 'info');
});

// ── VOICE RECORDING MODULE ───────────────────────────
const VOICE = (() => {
  let mediaRecorder    = null;
  let audioChunks      = [];
  let timerInterval    = null;
  let secondsElapsed   = 0;
  let isRecording      = false;

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast('Microphone not supported in this browser', 'err');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks      = [];
      secondsElapsed   = 0;
      mediaRecorder    = new MediaRecorder(stream);

      // Collect chunks every 250ms — prevents empty buffer on stop
      mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        if (!blob || blob.size === 0) {
          toast('Recording was empty, please try again', 'err');
          return;
        }
        await _uploadAudio(blob);
      };

      mediaRecorder.start(250); // 250ms timeslice — key fix
      isRecording = true;

      // Show recording UI
      document.getElementById('recBar').classList.remove('hidden');
      document.getElementById('inputBar').classList.add('hidden');
      document.getElementById('micBtn').classList.add('recording');

      timerInterval = setInterval(() => {
        secondsElapsed++;
        const el = document.getElementById('recTime');
        if (el) el.textContent = fmtTime(secondsElapsed);
        if (secondsElapsed >= 120) stop(); // max 2 min
      }, 1000);

      return true;
    } catch (err) {
      toast('Microphone access denied', 'err');
      return false;
    }
  }

  function stop() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
      clearInterval(timerInterval);
      _resetUI();
    }
  }

  function cancel() {
    if (mediaRecorder) {
      mediaRecorder.onstop = () => {
        // Override — discard audio, just stop the stream
        if (mediaRecorder?.stream) {
          mediaRecorder.stream.getTracks().forEach(t => t.stop());
        }
      };
      if (isRecording) mediaRecorder.stop();
    }
    audioChunks    = [];
    isRecording    = false;
    clearInterval(timerInterval);
    _resetUI();
    toast('Recording cancelled');
  }

  function _resetUI() {
    document.getElementById('recBar').classList.add('hidden');
    document.getElementById('inputBar').classList.remove('hidden');
    document.getElementById('micBtn').classList.remove('recording');
    const el = document.getElementById('recTime');
    if (el) el.textContent = '0:00';
  }

  async function _uploadAudio(blob) {
    if (!APP.currentChatId) return;
    if (!blob || blob.size === 0) {
      toast('Recording was empty, please try again', 'err');
      return;
    }

    const fd = new FormData();
    fd.append('audio',  blob, 'voice.webm');
    fd.append('chatId', APP.currentChatId);
    fd.append('type',   'audio');

    const r = await API.voicemessage(fd);
    if (r.ok) {
      APP._lastIds.clear();
      await loadMessages();
      loadChats();
    } else {
      toast(r.data?.message || 'Failed to send audio', 'err');
    }
  }

  return {
    start,
    stop,
    cancel,
    isRecording: () => isRecording,
  };
})();


// ── GLOBAL FUNCTIONS CALLED FROM HTML ────────────────

// Called by mic button in input bar
function toggleMic() {
  if (VOICE.isRecording()) {
    VOICE.stop();
  } else {
    VOICE.start();
  }
}

// Called by stop button in rec bar
function stopAndSendRecording() {
  VOICE.stop();
}

// Called by cancel button in rec bar
function cancelRecording() {
  VOICE.cancel();
}