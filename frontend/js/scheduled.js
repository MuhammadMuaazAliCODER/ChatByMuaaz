
(function injectScheduledStyles() {
  if (document.getElementById('schedStyles')) return;
  const s = document.createElement('style');
  s.id = 'schedStyles';
  s.textContent = `
    /* ── Clock button in chat header ── */
    #schedBtn {
      position: relative;
    }
    #schedBtn .sched-dot {
      position: absolute;
      top: 4px; right: 4px;
      width: 7px; height: 7px;
      background: var(--acc);
      border-radius: 50%;
      border: 1.5px solid var(--bg2);
      display: none;
    }
    #schedBtn.has-pending .sched-dot { display: block; }

    /* ── Scheduled panel overlay ── */
    #schedPanel {
      position: fixed;
      inset: 0;
      z-index: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgba(0,0,0,.65);
      backdrop-filter: blur(6px);
      animation: spFadeIn .2s ease;
    }
    @keyframes spFadeIn { from { opacity: 0; } }

    #schedPanel .sp-card {
      background: var(--bg2);
      border: 1px solid var(--bdr);
      border-radius: 20px;
      box-shadow: 0 32px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(79,172,254,.06);
      width: 100%;
      max-width: 500px;
      max-height: 86vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: spSlideUp .25s cubic-bezier(.34,1.2,.64,1);
    }
    @keyframes spSlideUp {
      from { opacity: 0; transform: translateY(20px) scale(.97); }
    }

    #schedPanel .sp-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--bdr);
      flex-shrink: 0;
    }
    #schedPanel .sp-title {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -.3px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #schedPanel .sp-title-icon {
      width: 30px; height: 30px;
      background: var(--acc-dim);
      border: 1px solid var(--bdr2);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: var(--acc);
    }

    /* Tabs */
    #schedPanel .sp-tabs {
      display: flex;
      gap: 4px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--bdr);
      flex-shrink: 0;
    }
    #schedPanel .sp-tab {
      flex: 1;
      background: transparent;
      border: 1px solid var(--bdr);
      border-radius: 9px;
      color: var(--txt3);
      cursor: pointer;
      font-family: var(--f);
      font-size: 12px;
      font-weight: 600;
      padding: 7px 8px;
      transition: all .15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    #schedPanel .sp-tab i {
      font-size: 11px;
    }
    #schedPanel .sp-tab.active {
      background: var(--acc-dim);
      border-color: var(--bdr2);
      color: var(--acc);
    }
    #schedPanel .sp-tab:hover:not(.active) {
      background: var(--bgh);
      color: var(--txt);
    }

    /* Body */
    #schedPanel .sp-body {
      flex: 1;
      overflow-y: auto;
      padding: 14px 16px 20px;
      scrollbar-width: thin;
      scrollbar-color: var(--txt3) transparent;
    }

    /* ── List view ── */
    .sched-item {
      background: var(--bg3);
      border: 1px solid var(--bdr);
      border-radius: 14px;
      padding: 13px 14px;
      margin-bottom: 10px;
      position: relative;
      overflow: hidden;
      transition: border-color .2s, opacity .35s, transform .35s;
    }
    .sched-item::before {
      content: '';
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 3px;
      background: linear-gradient(180deg, var(--acc), var(--acc2));
      border-radius: 3px 0 0 3px;
    }
    .sched-item:hover { border-color: var(--bdr2); }
    .sched-item.cancelling { opacity: 0; transform: translateX(16px); }

    .sched-item-top {
      display: flex;
      gap: 10px;
      margin-bottom: 8px;
      align-items: flex-start;
    }
    .sched-content {
      flex: 1;
      font-size: 13px;
      color: var(--txt);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .sched-cancel-btn {
      background: rgba(255,107,114,.12);
      border: 1px solid rgba(255,107,114,.25);
      border-radius: 7px;
      color: var(--red);
      cursor: pointer;
      font-family: var(--f);
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      transition: background .15s;
      white-space: nowrap;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .sched-cancel-btn i { font-size: 10px; }
    .sched-cancel-btn:hover { background: rgba(255,107,114,.22); }

    .sched-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .sched-meta-chip {
      font-size: 11px;
      color: var(--txt2);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .sched-meta-chip i { font-size: 10px; color: var(--txt3); }
    .sched-countdown {
      font-size: 10px;
      font-weight: 700;
      color: var(--acc);
      background: var(--acc-dim);
      border: 1px solid var(--bdr2);
      border-radius: 20px;
      padding: 2px 9px;
      font-family: 'DM Mono', monospace, var(--f);
      letter-spacing: .01em;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .sched-countdown i { font-size: 9px; }
    .sched-recipients {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 7px;
      align-items: center;
    }
    .sched-recipient-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(79,172,254,.1);
      border: 1px solid rgba(79,172,254,.22);
      border-radius: 20px;
      padding: 2px 8px;
      font-size: 11px;
      color: var(--acc);
    }
    .sched-recipient-pill i { font-size: 9px; }

    .sched-empty {
      text-align: center;
      padding: 40px 0;
      color: var(--txt3);
      font-size: 13px;
    }
    .sched-empty-icon {
      font-size: 38px;
      margin-bottom: 12px;
      color: var(--txt3);
      opacity: .5;
    }

    /* ── Compose form ── */
    .sp-field { margin-bottom: 14px; }
    .sp-label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      color: var(--txt3);
      letter-spacing: .5px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .sp-input, .sp-select, .sp-textarea {
      width: 100%;
      background: var(--bg3);
      border: 1.5px solid var(--bdr);
      border-radius: 10px;
      color: var(--txt);
      font-family: var(--f);
      font-size: 13px;
      padding: 10px 12px;
      outline: none;
      transition: border-color .18s, box-shadow .18s;
      -webkit-appearance: none;
    }
    .sp-input:focus, .sp-select:focus, .sp-textarea:focus {
      border-color: var(--acc);
      box-shadow: 0 0 0 3px var(--acc-dim);
    }
    .sp-textarea { resize: vertical; min-height: 80px; line-height: 1.55; }
    .sp-select option { background: var(--bg2); color: var(--txt); }

    /* Recipient search list */
    .sp-contact-list {
      background: var(--bg3);
      border: 1.5px solid var(--bdr);
      border-radius: 10px;
      max-height: 160px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--acc-dim) transparent;
    }
    .sp-contact-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      cursor: pointer;
      border-bottom: 1px solid var(--bdr);
      transition: background .13s;
    }
    .sp-contact-row:last-child { border-bottom: none; }
    .sp-contact-row:hover { background: var(--bgh); }
    .sp-contact-row.selected { background: var(--acc-dim); }
    .sp-contact-info { flex: 1; min-width: 0; }
    .sp-contact-name { font-size: 13px; font-weight: 600; color: var(--txt); }
    .sp-contact-user { font-size: 11px; color: var(--txt3); }
    .sp-check {
      width: 17px; height: 17px;
      border-radius: 5px;
      border: 1.5px solid var(--bdr2);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: all .13s;
      font-size: 9px;
      color: #071525;
    }
    .sp-check.on { background: var(--acc); border-color: var(--acc); }

    .sp-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 7px;
    }
    .sp-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: var(--acc-dim);
      border: 1px solid var(--bdr2);
      border-radius: 20px;
      padding: 3px 10px;
      font-size: 11px;
      color: var(--acc);
    }
    .sp-pill i { font-size: 9px; }
    .sp-pill-x {
      cursor: pointer;
      opacity: .6;
      font-size: 11px;
      line-height: 1;
      transition: opacity .13s;
    }
    .sp-pill-x:hover { opacity: 1; }

    .sp-submit {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, var(--acc), var(--acc2));
      border: none;
      border-radius: 12px;
      color: #071525;
      font-family: var(--f);
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 4px;
      transition: opacity .15s, transform .13s, box-shadow .15s;
      box-shadow: 0 4px 16px var(--acc-glow);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .sp-submit i { font-size: 13px; }
    .sp-submit:hover { opacity: .92; transform: translateY(-1px); }
    .sp-submit:active { transform: translateY(0); }
    .sp-submit:disabled { opacity: .45; cursor: not-allowed; transform: none; }

    input[type="datetime-local"]::-webkit-calendar-picker-indicator {
      filter: invert(.55) sepia(1) saturate(4) hue-rotate(175deg);
      cursor: pointer;
    }

    /* Mobile tweaks */
    @media(max-width: 520px) {
      #schedPanel { padding: 0; align-items: flex-end; }
      #schedPanel .sp-card {
        border-radius: 20px 20px 0 0;
        max-height: 92vh;
      }
    }
  `;
  document.head.appendChild(s);
})();


// ── STATE ─────────────────────────────────────────────
const SCHED = {
  items: [],            // pending scheduled messages
  selectedRecipients: [], // for compose form
  countdownTimers: [],
};


// ── HELPERS ───────────────────────────────────────────
function schedFormatRelative(iso) {
  const diff = new Date(iso) - Date.now();
  if (diff <= 0) return 'Sending…';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0)   return `${h}h ${m}m`;
  return `${m}m`;
}

function schedFormatAbsolute(iso) {
  return new Date(iso).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function schedLocalInputValue(date) {
  const d = new Date(date);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


// ── CLOCK BUTTON — injected into chat header ──────────
function injectSchedButton() {
  const head = document.querySelector('.cw-head-actions');
  if (!head || document.getElementById('schedBtn')) return;

  const btn = document.createElement('button');
  btn.className = 'ib';
  btn.id        = 'schedBtn';
  btn.title     = 'Scheduled Messages';
  btn.innerHTML = `
    <i class="fa-regular fa-clock"></i>
    <span class="sched-dot"></span>
  `;
  btn.onclick = () => openSchedPanel();
  head.insertBefore(btn, head.firstChild);
}


// ── OPEN PANEL ────────────────────────────────────────
function openSchedPanel(defaultTab = 'list') {
  closeSchedPanel();

  // Reset compose state
  SCHED.selectedRecipients = [];

  const wrap = document.createElement('div');
  wrap.id = 'schedPanel';
  wrap.onclick = e => { if (e.target === wrap) closeSchedPanel(); };

  wrap.innerHTML = `
    <div class="sp-card">
      <div class="sp-head">
        <div class="sp-title">
          <div class="sp-title-icon">
            <i class="fa-solid fa-clock"></i>
          </div>
          Scheduled Messages
        </div>
        <button class="ib" onclick="closeSchedPanel()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="sp-tabs">
        <button class="sp-tab ${defaultTab==='list'?'active':''}" id="spTabList" onclick="schedSwitchTab('list')">
          <i class="fa-solid fa-list"></i> Scheduled
        </button>
        <button class="sp-tab ${defaultTab==='compose'?'active':''}" id="spTabCompose" onclick="schedSwitchTab('compose')">
          <i class="fa-solid fa-plus"></i> Schedule New
        </button>
      </div>

      <div class="sp-body" id="spBody">
        <div class="list-spin"><div class="spin"></div></div>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);
  schedSwitchTab(defaultTab);
  schedLoadList();   // pre-load list in background
}

function closeSchedPanel() {
  const el = document.getElementById('schedPanel');
  if (el) el.remove();
  SCHED.countdownTimers.forEach(clearInterval);
  SCHED.countdownTimers = [];
}


// ── TAB SWITCHER ──────────────────────────────────────
function schedSwitchTab(tab) {
  document.getElementById('spTabList')?.classList.toggle('active',    tab === 'list');
  document.getElementById('spTabCompose')?.classList.toggle('active', tab === 'compose');

  if (tab === 'list')    schedRenderList();
  if (tab === 'compose') schedRenderCompose();
}


// ── LOAD FROM API ─────────────────────────────────────
async function schedLoadList() {
  const r = await API.getScheduledMessages();
  if (r.ok) {
    SCHED.items = r.data.messages || r.data || [];
    // update dot badge
    const btn = document.getElementById('schedBtn');
    if (btn) btn.classList.toggle('has-pending', SCHED.items.length > 0);
  }
  // re-render if list tab is visible
  const listTab = document.getElementById('spTabList');
  if (listTab?.classList.contains('active')) schedRenderList();
}


// ── RENDER LIST ───────────────────────────────────────
function schedRenderList() {
  const body = document.getElementById('spBody');
  if (!body) return;

  // clear old countdown timers
  SCHED.countdownTimers.forEach(clearInterval);
  SCHED.countdownTimers = [];

  if (!SCHED.items.length) {
    body.innerHTML = `
      <div class="sched-empty">
        <div class="sched-empty-icon">
          <i class="fa-regular fa-clock"></i>
        </div>
        <div style="font-weight:600;margin-bottom:4px">No scheduled messages</div>
        <div style="font-size:12px;color:var(--txt3)">Tap "Schedule New" to create one</div>
      </div>`;
    return;
  }

  body.innerHTML = SCHED.items.map(msg => {
    const chatName = msg.chat?.name || 'Unknown chat';
    const recipientsHtml = (msg.scheduledFor?.length)
      ? `<div class="sched-recipients">
           <span style="font-size:10px;color:var(--txt3)">Also to:</span>
           ${msg.scheduledFor.map(u => `
             <span class="sched-recipient-pill">
               <i class="fa-solid fa-user"></i>
               ${esc(u.name || u.username || 'User')}
             </span>`).join('')}
         </div>`
      : '';

    return `
      <div class="sched-item" id="sitem_${msg._id}">
        <div class="sched-item-top">
          <div class="sched-content">${esc(msg.content || '')}</div>
          <button class="sched-cancel-btn" onclick="schedCancelMsg('${msg._id}')">
            <i class="fa-solid fa-xmark"></i> Cancel
          </button>
        </div>
        <div class="sched-meta">
          <span class="sched-meta-chip">
            <i class="fa-regular fa-comment"></i> ${esc(chatName)}
          </span>
          <span class="sched-meta-chip">
            <i class="fa-regular fa-calendar"></i> ${schedFormatAbsolute(msg.scheduledAt)}
          </span>
          <span class="sched-countdown" id="scd_${msg._id}">
            <i class="fa-regular fa-hourglass"></i>
            ${schedFormatRelative(msg.scheduledAt)}
          </span>
        </div>
        ${recipientsHtml}
      </div>`;
  }).join('');

  // Live countdowns — tick every 30s
  SCHED.items.forEach(msg => {
    const el = document.getElementById(`scd_${msg._id}`);
    if (!el) return;
    const tid = setInterval(() => {
      if (!document.getElementById(`scd_${msg._id}`)) { clearInterval(tid); return; }
      // Keep the icon, update only the text node
      el.innerHTML = `<i class="fa-regular fa-hourglass"></i> ${schedFormatRelative(msg.scheduledAt)}`;
    }, 30000);
    SCHED.countdownTimers.push(tid);
  });
}


// ── CANCEL ────────────────────────────────────────────
async function schedCancelMsg(id) {
  const itemEl = document.getElementById(`sitem_${id}`);
  if (itemEl) itemEl.classList.add('cancelling');

  const r = await API.cancelScheduledMsg(id);
  if (r.ok) {
    SCHED.items = SCHED.items.filter(m => m._id !== id);
    const btn = document.getElementById('schedBtn');
    if (btn) btn.classList.toggle('has-pending', SCHED.items.length > 0);
    toast('Scheduled message cancelled', 'ok');
    setTimeout(schedRenderList, 350);
  } else {
    if (itemEl) itemEl.classList.remove('cancelling');
    toast(r.data?.message || 'Failed to cancel', 'err');
  }
}


// ── RENDER COMPOSE ────────────────────────────────────
function schedRenderCompose() {
  const body = document.getElementById('spBody');
  if (!body) return;

  // Default time = now + 1 hour
  const defaultTime = schedLocalInputValue(new Date(Date.now() + 3600000));

  // Build chat options
  const chatOptions = APP.chats.map(c => {
    const name = (typeof chatName === 'function') ? chatName(c) : (c.name || 'Chat');
    return `<option value="${c._id}">${esc(name)}</option>`;
  }).join('');

  body.innerHTML = `
    <!-- Message -->
    <div class="sp-field">
      <label class="sp-label">
        <i class="fa-regular fa-message" style="margin-right:4px"></i> Message
      </label>
      <textarea class="sp-textarea" id="spContent" placeholder="What do you want to say?"></textarea>
    </div>

    <!-- Chat -->
    <div class="sp-field">
      <label class="sp-label">
        <i class="fa-regular fa-comment-dots" style="margin-right:4px"></i> Send to Chat
      </label>
      <select class="sp-select" id="spChatId">
        <option value="">— Select a chat —</option>
        ${chatOptions}
      </select>
    </div>

    <!-- Time -->
    <div class="sp-field">
      <label class="sp-label">
        <i class="fa-regular fa-clock" style="margin-right:4px"></i> Send At
      </label>
      <input
        type="datetime-local"
        class="sp-input"
        id="spTime"
        value="${defaultTime}"
        min="${schedLocalInputValue(new Date())}"
      />
    </div>

    <!-- Extra recipients -->
    <div class="sp-field">
      <label class="sp-label">
        <i class="fa-solid fa-user-plus" style="margin-right:4px"></i> Also notify (optional)
      </label>
      <div class="finput" style="margin-bottom:6px;border-radius:10px">
        <i class="fa-solid fa-magnifying-glass fi-icon" style="font-size:13px"></i>
        <input
          type="text"
          class="sp-input"
          id="spRecipSearch"
          placeholder="Search friends…"
          autocomplete="off"
          oninput="schedFilterRecipients()"
          style="border:none;background:transparent;padding-left:0;box-shadow:none"
        />
      </div>
      <div class="sp-contact-list" id="spContactList">
        ${schedBuildContactList(APP.friends)}
      </div>
      <div class="sp-pills" id="spPills"></div>
    </div>

    <button class="sp-submit" id="spSubmitBtn" onclick="schedSubmit()">
      <i class="fa-solid fa-paper-plane"></i> Schedule Message
    </button>
  `;
}

function schedBuildContactList(friends, query = '') {
  const q = query.toLowerCase();
  const filtered = friends.filter(f => {
    const u = f.user || f;
    const name = (u.name || u.username || '').toLowerCase();
    return !q || name.includes(q);
  });

  if (!filtered.length) return `<div style="padding:10px 12px;font-size:12px;color:var(--txt3)">No results</div>`;

  return filtered.map(f => {
    const u = f.user || f;
    const name = u.name || u.username || 'User';
    const isSelected = SCHED.selectedRecipients.some(r => r._id === u._id);
    return `
      <div
        class="sp-contact-row ${isSelected ? 'selected' : ''}"
        onclick="schedToggleRecipient('${u._id}','${esc(name)}')"
      >
        ${makeAv(u, 'xs', false)}
        <div class="sp-contact-info">
          <div class="sp-contact-name">${esc(name)}</div>
          <div class="sp-contact-user">@${esc(u.username || '')}</div>
        </div>
        <div class="sp-check ${isSelected ? 'on' : ''}" id="spchk_${u._id}">
          ${isSelected ? `<i class="fa-solid fa-check"></i>` : ''}
        </div>
      </div>`;
  }).join('');
}

function schedFilterRecipients() {
  const q = document.getElementById('spRecipSearch')?.value || '';
  const list = document.getElementById('spContactList');
  if (list) list.innerHTML = schedBuildContactList(APP.friends, q);
}

function schedToggleRecipient(id, name) {
  const idx = SCHED.selectedRecipients.findIndex(r => r._id === id);
  if (idx >= 0) {
    SCHED.selectedRecipients.splice(idx, 1);
  } else {
    SCHED.selectedRecipients.push({ _id: id, name });
  }
  // Refresh contact list (keep search query)
  const q = document.getElementById('spRecipSearch')?.value || '';
  const list = document.getElementById('spContactList');
  if (list) list.innerHTML = schedBuildContactList(APP.friends, q);
  schedRenderPills();
}

function schedRenderPills() {
  const container = document.getElementById('spPills');
  if (!container) return;
  container.innerHTML = SCHED.selectedRecipients.map(r => `
    <span class="sp-pill">
      <i class="fa-solid fa-user"></i>
      ${esc(r.name)}
      <span class="sp-pill-x" onclick="schedToggleRecipient('${r._id}','${esc(r.name)}')">
        <i class="fa-solid fa-xmark"></i>
      </span>
    </span>
  `).join('');
}


// ── SUBMIT ────────────────────────────────────────────
async function schedSubmit() {
  const content   = document.getElementById('spContent')?.value.trim();
  const chatId    = document.getElementById('spChatId')?.value;
  const timeVal   = document.getElementById('spTime')?.value;
  const submitBtn = document.getElementById('spSubmitBtn');

  if (!content)  return toast('Message cannot be empty', 'err');
  if (!chatId)   return toast('Please select a chat', 'err');
  if (!timeVal)  return toast('Please pick a time', 'err');

  const scheduledAt = new Date(timeVal);
  if (scheduledAt <= new Date()) return toast('Please pick a future time', 'err');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Scheduling…`;
  }

  const body = {
    chatId,
    content,
    type: 'text',
    scheduledAt: scheduledAt.toISOString(),
    recipientIds: SCHED.selectedRecipients.map(r => r._id),
  };

  const r = await API.scheduleMessage(body);

  if (r.ok) {
    // Add to local list
    const newMsg = r.data.message || r.data;
    SCHED.items.unshift(newMsg);
    const btn = document.getElementById('schedBtn');
    if (btn) btn.classList.add('has-pending');

    toast('Message scheduled ✓', 'ok');
    SCHED.selectedRecipients = [];
    schedSwitchTab('list');
  } else {
    toast(r.data?.message || 'Failed to schedule message', 'err');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Schedule Message`;
    }
  }
}


// ── WEBSOCKET HOOK — handle scheduled message fired ──
// Patch into handleWSMessage after it's defined
const _origHandleWSMessage = typeof handleWSMessage === 'function' ? handleWSMessage : null;

function handleScheduledWSEvents(data) {
  if (data.type === 'scheduled_message_sent') {
    // Remove from local pending list and refresh badge
    SCHED.items = SCHED.items.filter(m => m._id !== data.messageId);
    const btn = document.getElementById('schedBtn');
    if (btn) btn.classList.toggle('has-pending', SCHED.items.length > 0);
    schedRenderList(); // update panel if open
  }
}


// ── INJECT CLOCK BUTTON WHEN CHAT OPENS ───────────────
// Patch openChat to also inject the button and load pending count
(function patchOpenChat() {
  const original = window.openChat;
  if (!original) return;
  window.openChat = function(id, name, type) {
    original.call(this, id, name, type);
    // Small delay so the header DOM is rendered
    setTimeout(() => {
      injectSchedButton();
      schedLoadList();
    }, 80);
  };
})();


// ── KEYBOARD SHORTCUT: Ctrl+Shift+S = open schedule ──
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.key === 'S' && APP.currentChatId) {
    e.preventDefault();
    openSchedPanel('compose');
  }
});


// ── Expose globals ────────────────────────────────────
window.openSchedPanel        = openSchedPanel;
window.closeSchedPanel       = closeSchedPanel;
window.schedSwitchTab        = schedSwitchTab;
window.schedCancelMsg        = schedCancelMsg;
window.schedFilterRecipients = schedFilterRecipients;
window.schedToggleRecipient  = schedToggleRecipient;
window.schedSubmit           = schedSubmit;