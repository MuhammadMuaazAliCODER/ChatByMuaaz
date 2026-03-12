/* ═══════════════════════════════════════════════════════
   markdown.js  —  Lightweight Markdown Renderer + Toolbar
   Drop this file in js/markdown.js and add:
     <script src="js/markdown.js"></script>
   before </body> in index.html (after app.js)
═══════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────
   1.  MARKDOWN → HTML RENDERER
   Supports: bold, italic, inline code, code blocks,
   unordered/ordered lists, blockquotes, links, hr, headings.
───────────────────────────────────────────────────── */
const MD = (() => {
  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function parseInline(s) {
    // Inline code  `code`
    s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${esc(c)}</code>`);
    // Bold  **text** or __text__
    s = s.replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a, b) => `<strong>${a||b}</strong>`);
    // Italic  *text* or _text_
    s = s.replace(/\*(.+?)\*|_([^_]+?)_/g, (_, a, b) => `<em>${a||b}</em>`);
    // Links  [label](url)
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
      (_, label, url) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`);
    // Auto-link bare URLs
    s = s.replace(/(^|[\s,;])(https?:\/\/[^\s<]+)/g,
      (_, pre, url) => `${pre}<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>`);
    return s;
  }

  function render(raw) {
    if (!raw || !raw.trim()) return '';

    const lines = raw.split('\n');
    let html = '';
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // ── Fenced code block ```lang\n...\n```
      if (/^```/.test(line)) {
        const lang = line.slice(3).trim();
        let code = '';
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) {
          code += esc(lines[i]) + '\n';
          i++;
        }
        html += `<pre><code class="lang-${esc(lang)}">${code}</code></pre>`;
        i++;
        continue;
      }

      // ── Headings  # ## ###
      const hMatch = line.match(/^(#{1,3})\s+(.+)/);
      if (hMatch) {
        const lvl = hMatch[1].length;
        html += `<h${lvl}>${parseInline(esc(hMatch[2]))}</h${lvl}>`;
        i++; continue;
      }

      // ── Horizontal rule  --- or ***
      if (/^[-*]{3,}$/.test(line.trim())) {
        html += '<hr>';
        i++; continue;
      }

      // ── Blockquote  > text
      if (/^>\s?/.test(line)) {
        let bq = '';
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          bq += lines[i].replace(/^>\s?/, '') + '\n';
          i++;
        }
        html += `<blockquote>${render(bq.trim())}</blockquote>`;
        continue;
      }

      // ── Unordered list  - item or * item
      if (/^[-*]\s/.test(line)) {
        html += '<ul>';
        while (i < lines.length && /^[-*]\s/.test(lines[i])) {
          html += `<li>${parseInline(esc(lines[i].replace(/^[-*]\s/, '')))}</li>`;
          i++;
        }
        html += '</ul>';
        continue;
      }

      // ── Ordered list  1. item
      if (/^\d+\.\s/.test(line)) {
        html += '<ol>';
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          html += `<li>${parseInline(esc(lines[i].replace(/^\d+\.\s/, '')))}</li>`;
          i++;
        }
        html += '</ol>';
        continue;
      }

      // ── Blank line → paragraph break
      if (!line.trim()) {
        html += '<br>';
        i++; continue;
      }

      // ── Normal paragraph
      html += `<p>${parseInline(esc(line))}</p>`;
      i++;
    }

    return `<div class="md-content">${html}</div>`;
  }

  // Returns true when the string contains any markdown syntax
  function hasMarkdown(s) {
    return /\*\*|__|\*[^*]|`|^#{1,3}\s|^[-*]\s|\[.+\]\(.+\)|^>|^[-*]{3}/m.test(s);
  }

  return { render, hasMarkdown, parseInline, esc };
})();


/* ─────────────────────────────────────────────────────
   2.  FORMATTING TOOLBAR  (injected into the DOM)
───────────────────────────────────────────────────── */
const FmtToolbar = (() => {
  let ta = null;          // textarea element
  let previewEl = null;   // preview div
  let previewVisible = false;
  const MAX_CHARS = 4000;

  const tools = [
    { label: 'B',      title: 'Bold (Ctrl+B)',        wrap: ['**','**'],    key: 'b' },
    { label: 'I',      title: 'Italic (Ctrl+I)',       wrap: ['*','*'],      key: 'i' },
    { label: '</>',    title: 'Inline Code (Ctrl+`)',  wrap: ['`','`'],      key: '`' },
    { sep: true },
    { label: '```',    title: 'Code Block',            block: '```\n', blockEnd: '\n```' },
    { label: '" "',    title: 'Blockquote',            prefix: '> ' },
    { sep: true },
    { label: '— H1',  title: 'Heading 1',             prefix: '# ' },
    { label: '— H2',  title: 'Heading 2',             prefix: '## ' },
    { sep: true },
    { label: '• List', title: 'Bullet List',           prefix: '- ' },
    { label: '1. List',title: 'Numbered List',         prefix: '1. ' },
    { sep: true },
    { label: '🔗',     title: 'Link',                  linkDialog: true },
  ];

  function wrapSelection(before, after) {
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const sel   = ta.value.slice(start, end);
    const replacement = before + (sel || 'text') + after;
    ta.setRangeText(replacement, start, end, 'select');
    ta.focus();
    updatePreview();
    updateCounter();
    // fix selection to just the inner text if nothing was selected
    if (!sel) {
      ta.setSelectionRange(start + before.length, start + before.length + 4);
    }
  }

  function prefixLines(prefix) {
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const before = ta.value.slice(0, start);
    const selected = ta.value.slice(start, end) || 'item';
    const after  = ta.value.slice(end);
    // prefix every selected line
    const prefixed = selected.split('\n').map(l => prefix + l).join('\n');
    ta.value = before + prefixed + after;
    ta.setSelectionRange(start, start + prefixed.length);
    ta.focus();
    updatePreview();
    updateCounter();
  }

  function insertCodeBlock() {
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const sel   = ta.value.slice(start, end);
    const block = '```\n' + (sel || 'code here') + '\n```';
    ta.setRangeText(block, start, end, 'end');
    ta.focus();
    updatePreview();
    updateCounter();
  }

  function insertLink() {
    const url   = prompt('Enter URL:', 'https://');
    if (!url) return;
    const label = prompt('Enter link text:', 'link') || url;
    const md    = `[${label}](${url})`;
    const pos   = ta.selectionStart;
    ta.setRangeText(md, pos, ta.selectionEnd, 'end');
    ta.focus();
    updatePreview();
    updateCounter();
  }

  function updatePreview() {
    if (!previewVisible || !previewEl) return;
    const rendered = MD.render(ta.value);
    previewEl.innerHTML = rendered || '<span style="color:var(--txt3);font-size:12px">Preview will appear here…</span>';
  }

  function updateCounter() {
    const counter = document.getElementById('fmtCounter');
    if (!counter) return;
    const len = ta.value.length;
    counter.textContent = len > 0 ? `${len}/${MAX_CHARS}` : '';
    counter.className = 'char-counter' + (len > MAX_CHARS ? ' over' : len > MAX_CHARS * 0.85 ? ' warn' : '');
  }

  function togglePreview() {
    previewVisible = !previewVisible;
    const btn = document.getElementById('fmtPreviewBtn');
    if (previewEl) {
      previewEl.classList.toggle('visible', previewVisible);
    }
    if (btn) btn.classList.toggle('active', previewVisible);
    if (previewVisible) {
      updatePreview();
      ta.style.display = 'none';
      previewEl.style.display = 'block';
    } else {
      ta.style.display = '';
      previewEl.style.display = 'none';
      ta.focus();
    }
  }

  function handleKeyboardShortcut(e) {
    if (!e.ctrlKey && !e.metaKey) return;
    switch (e.key.toLowerCase()) {
      case 'b': e.preventDefault(); wrapSelection('**','**'); break;
      case 'i': e.preventDefault(); wrapSelection('*','*'); break;
      case '`': e.preventDefault(); wrapSelection('`','`'); break;
    }
  }

  function build() {
    ta = document.getElementById('msgTa');
    if (!ta) return;

    // ── Wrap input-bar and emoji-bar in a container ──
    const inputBar  = document.getElementById('inputBar');
    const emojiBar  = document.getElementById('emojiBar');
    const recBar    = document.getElementById('recBar');
    const cwin      = document.getElementById('cwin');
    if (!inputBar || !cwin) return;

    // Create wrapper
    const wrap = document.createElement('div');
    wrap.className = 'input-area-wrap';
    wrap.id = 'inputAreaWrap';

    // Insert wrapper before inputBar
    cwin.insertBefore(wrap, emojiBar || inputBar);

    // Move emoji, toolbar, inputBar into wrapper
    if (emojiBar) wrap.appendChild(emojiBar);

    // ── Build toolbar ──
    const toolbar = document.createElement('div');
    toolbar.className = 'fmt-toolbar';
    toolbar.id = 'fmtToolbar';

    tools.forEach(t => {
      if (t.sep) {
        const sep = document.createElement('div');
        sep.className = 'fmt-sep';
        toolbar.appendChild(sep);
        return;
      }
      const btn = document.createElement('button');
      btn.className = 'fmt-btn';
      btn.title = t.title || '';
      btn.textContent = t.label;
      btn.type = 'button';
      btn.addEventListener('mousedown', e => {
        e.preventDefault(); // don't blur textarea
        if (t.linkDialog) { insertLink(); return; }
        if (t.block !== undefined) { insertCodeBlock(); return; }
        if (t.prefix) { prefixLines(t.prefix); return; }
        if (t.wrap) { wrapSelection(t.wrap[0], t.wrap[1]); }
      });
      toolbar.appendChild(btn);
    });

    // separator
    const sep2 = document.createElement('div');
    sep2.className = 'fmt-sep';
    toolbar.appendChild(sep2);

    // Preview toggle
    const previewBtn = document.createElement('button');
    previewBtn.className = 'fmt-btn fmt-preview-btn';
    previewBtn.id = 'fmtPreviewBtn';
    previewBtn.title = 'Toggle preview';
    previewBtn.textContent = '👁 Preview';
    previewBtn.type = 'button';
    previewBtn.addEventListener('mousedown', e => { e.preventDefault(); togglePreview(); });
    toolbar.appendChild(previewBtn);

    // Char counter
    const counter = document.createElement('span');
    counter.className = 'char-counter';
    counter.id = 'fmtCounter';
    toolbar.appendChild(counter);

    wrap.appendChild(toolbar);

    // Preview element (shown instead of textarea)
    previewEl = document.createElement('div');
    previewEl.className = 'msg-preview';
    previewEl.id = 'msgPreview';
    // insert preview inside ib-field
    const ibField = inputBar.querySelector('.ib-field');
    if (ibField) ibField.appendChild(previewEl);

    wrap.appendChild(inputBar);
    if (recBar) wrap.appendChild(recBar);

    // ── Event listeners on textarea ──
    ta.addEventListener('keydown', handleKeyboardShortcut);
    ta.addEventListener('input', () => {
      updatePreview();
      updateCounter();
    });
  }

  return { build, updatePreview, updateCounter };
})();


/* ─────────────────────────────────────────────────────
   3.  MOBILE KEYBOARD FIX  (Visual Viewport API)
───────────────────────────────────────────────────── */
const KeyboardFix = (() => {
  function init() {
    if (typeof visualViewport === 'undefined') return;

    function onResize() {
      const vv = visualViewport;
      const windowHeight = window.innerHeight;
      const viewportHeight = vv.height;
      // Gap = amount keyboard is covering
      const keyboardHeight = Math.max(0, windowHeight - viewportHeight - vv.offsetTop);
      document.documentElement.style.setProperty('--keyboard-offset', keyboardHeight + 'px');

      // Also scroll msgs to bottom when keyboard opens
      const msgs = document.getElementById('msgs');
      if (msgs && keyboardHeight > 50) {
        setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 80);
      }
    }

    visualViewport.addEventListener('resize', onResize);
    visualViewport.addEventListener('scroll', onResize);
  }

  return { init };
})();


/* ─────────────────────────────────────────────────────
   4.  OVERRIDE sendTextMsg to render markdown
   Patches the existing function so outgoing messages
   are rendered with markdown when the text contains
   markdown syntax.
───────────────────────────────────────────────────── */
function patchSendForMarkdown() {
  // We hook into the message rendering in app.js by
  // monkey-patching the message bubble builder if available,
  // or providing a helper renderMsgContent() that app.js can call.

  // renderMsgContent(text) → safe HTML string
  window.renderMsgContent = function(text) {
    if (!text) return '';
    if (MD.hasMarkdown(text)) {
      return MD.render(text);
    }
    // Plain text: just escape + convert newlines
    return '<p>' + MD.esc(text).replace(/\n/g, '<br>') + '</p>';
  };
}


/* ─────────────────────────────────────────────────────
   5.  INIT  — runs after DOM is ready
───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  FmtToolbar.build();
  KeyboardFix.init();
  patchSendForMarkdown();
});