// ── VOICE RECORDING MODULE ───────────────────────────
const VOICE = (() => {
  let mediaRecorder = null;
  let audioChunks = [];
  let timerInterval = null;
  let secondsElapsed = 0;
  let isRecording = false;

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast('Microphone not supported in this browser', 'err'); return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      secondsElapsed = 0;

      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        onRecordingComplete(blob);
      };

      mediaRecorder.start();
      isRecording = true;

      // Update UI
      document.getElementById('recBar').classList.remove('hidden');
      document.getElementById('inputBar').classList.add('hidden');
      document.getElementById('micBtn').classList.add('recording');

      timerInterval = setInterval(() => {
        secondsElapsed++;
        document.getElementById('recTime').textContent = fmtTime(secondsElapsed);
        if (secondsElapsed >= 120) stopAndSend(); // max 2 min
      }, 1000);

      return true;
    } catch (err) {
      toast('Microphone access denied', 'err'); return false;
    }
  }

  function stop() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
      clearInterval(timerInterval);
      resetUI();
    }
  }

  function cancel() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.onstop = null; // prevent sending
      mediaRecorder.stop();
      isRecording = false;
      clearInterval(timerInterval);
      resetUI();
      toast('Recording cancelled');
    }
  }

  function resetUI() {
    document.getElementById('recBar').classList.add('hidden');
    document.getElementById('inputBar').classList.remove('hidden');
    document.getElementById('micBtn').classList.remove('recording');
    document.getElementById('recTime').textContent = '0:00';
  }

  // Convert blob to base64 and send as audio message
// REPLACE onRecordingComplete with this:
async function onRecordingComplete(blob) {
  await uploadAudio(blob); // directly pass blob — no base64 needed
}

// REMOVE sendVoiceMessage entirely — it's no longer used

  return {
    start, stop, cancel,
    isRecording: () => isRecording,
  };
})();

// Exposed to HTML
function toggleRecording() {
  if (VOICE.isRecording()) {
    VOICE.stop();
  } else {
    VOICE.start();
  }
}
function cancelRecording() { VOICE.cancel(); }

async function sendVoiceMessage(blobUrl, duration, base64Data) {
  if (!APP.currentChatId) return;
  const durationStr = formatDuration(duration);

  // We send it as an audio type message, content holds the duration label
  // In production you'd upload the audio file and send the URL
  const res = await API.voicemessage({
    chatId: APP.currentChatId,
    content: `🎤 Voice message (${durationStr})`,
    type: 'audio',
    audioUrl: blobUrl, // local blob URL - works for same session
  });

  if (res.ok) {
    APP._lastIds.clear();
    await loadMessages();
    loadChats();
  } else {
    toast(res.data?.message || 'Failed to send voice', 'err');
  }
}

function formatDuration(secs) {
  const m = Math.floor(secs / 60);
  return m > 0 ? `${m}m ${secs % 60}s` : `${secs}s`;
}
