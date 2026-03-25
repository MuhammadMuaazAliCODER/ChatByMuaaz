/* ═══════════════════════════════════════════════════════
   markdown.js  —  Auto Markdown Renderer (Slack-style)
   Add AFTER app.js in your HTML:
     <script src="js/markdown.js"></script>
═══════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────
   1.  MARKDOWN → HTML RENDERER
───────────────────────────────────────────────────── */
const MD = (() => {
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function parseInline(s) {
    // Inline code — must come first so other rules don't touch content inside backticks
    s = s.replace(/`([^`]+)`/g, (_, c) => `<code class="md-code">${esc(c)}</code>`);
    // Bold
    s = s.replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a, b) => `<strong>${a || b}</strong>`);
    // Italic
    s = s.replace(/\*(.+?)\*|_([^_]+?)_/g, (_, a, b) => `<em>${a || b}</em>`);
    // Strikethrough
    s = s.replace(/~~(.+?)~~/g, (_, a) => `<del>${a}</del>`);
    // Named links  [label](url)
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
      (_, label, url) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`);
    // Auto-links
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

      // Fenced code block  ```lang
      if (/^```/.test(line)) {
        const lang = line.slice(3).trim();
        let code = '';
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) {
          code += esc(lines[i]) + '\n';
          i++;
        }
        html += `<pre class="md-pre"><code class="lang-${esc(lang)}">${code}</code></pre>`;
        i++;
        continue;
      }

      // Headings  # ## ###
      const hMatch = line.match(/^(#{1,3})\s+(.+)/);
      if (hMatch) {
        const lvl = hMatch[1].length;
        html += `<h${lvl} class="md-h">${parseInline(esc(hMatch[2]))}</h${lvl}>`;
        i++; continue;
      }

      // Blockquote  > text
      if (/^>\s?/.test(line)) {
        let bq = '';
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          bq += lines[i].replace(/^>\s?/, '') + '\n';
          i++;
        }
        html += `<blockquote class="md-bq">${render(bq.trim())}</blockquote>`;
        continue;
      }

      // Unordered list  - item  or  * item
      if (/^[-*]\s/.test(line)) {
        html += '<ul class="md-ul">';
        while (i < lines.length && /^[-*]\s/.test(lines[i])) {
          html += `<li>${parseInline(esc(lines[i].replace(/^[-*]\s/, '')))}</li>`;
          i++;
        }
        html += '</ul>';
        continue;
      }

      // Ordered list  1. item
      if (/^\d+\.\s/.test(line)) {
        html += '<ol class="md-ol">';
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          html += `<li>${parseInline(esc(lines[i].replace(/^\d+\.\s/, '')))}</li>`;
          i++;
        }
        html += '</ol>';
        continue;
      }

      // Blank line → break
      if (!line.trim()) {
        html += '<br>';
        i++; continue;
      }

      // Normal line
      html += `<span class="md-line">${parseInline(esc(line))}</span><br>`;
      i++;
    }

    return html;
  }

  function hasMarkdown(s) {
    return /\*\*|__|\*[^*\s]|_[^_\s]|`|^#{1,3}\s|^[-*]\s|^\d+\.\s|\[.+\]\(.+\)|^>|~~.+~~/m.test(s);
  }

  return { render, hasMarkdown, parseInline, esc };
})();


/* ─────────────────────────────────────────────────────
   2.  renderMsgContent  — called directly from app.js
   Plain text → safely escaped.
   Markdown   → rendered to HTML.
───────────────────────────────────────────────────── */
window.renderMsgContent = function(text) {
  if (!text) return '';
  if (MD.hasMarkdown(text)) {
    return `<div class="md-content">${MD.render(text)}</div>`;
  }
  // Plain text: escape + preserve newlines
  return MD.esc(text).replace(/\n/g, '<br>');
};


/* ─────────────────────────────────────────────────────
   3.  INJECT STYLES
───────────────────────────────────────────────────── */
(function injectMdStyles() {
  if (document.getElementById('mdStyles')) return;
  const s = document.createElement('style');
  s.id = 'mdStyles';
  s.textContent = `
    /* ── Bubble text wrapper ── */
    .msg-text { word-break: break-word; white-space: pre-wrap; }

    /* ── Markdown content ── */
    .md-content { display: inline-block; width: 100%; }
    .md-content strong { font-weight: 700; }
    .md-content em     { font-style: italic; }
    .md-content del    { text-decoration: line-through; opacity: .7; }

    .md-code {
      font-family: 'DM Mono', 'Fira Mono', monospace;
      font-size: 12px;
      background: rgba(0,0,0,.28);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 4px;
      padding: 1px 5px;
    }

    .md-pre {
      background: rgba(0,0,0,.35);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 8px;
      padding: 10px 12px;
      margin: 6px 0 2px;
      overflow-x: auto;
      font-size: 12px;
      font-family: 'DM Mono', 'Fira Mono', monospace;
      white-space: pre;
    }

    .md-bq {
      border-left: 3px solid var(--acc, #6366f1);
      margin: 4px 0;
      padding: 2px 0 2px 10px;
      color: var(--txt2, #aaa);
      font-style: italic;
    }

    .md-h { margin: 4px 0 2px; font-weight: 700; line-height: 1.3; }
    h1.md-h { font-size: 17px; }
    h2.md-h { font-size: 14px; }
    h3.md-h { font-size: 13px; }

    .md-ul, .md-ol { margin: 4px 0 4px 18px; padding: 0; }
    .md-ul li, .md-ol li { margin: 2px 0; }

    .md-content a {
      color: var(--acc, #6366f1);
      text-decoration: underline;
      word-break: break-all;
    }

    .md-line { display: inline; }

    /* ── Textarea glow when markdown detected ── */
    #msgTa.has-md {
      border-color: var(--acc, #6366f1) !important;
      box-shadow: 0 0 0 2px rgba(99,102,241,.15);
    }

    /* ── Hint below textarea ── */
    .md-hint {
      font-size: 10px;
      color: var(--txt3, #666);
      padding: 2px 14px 0;
      display: none;
      user-select: none;
      line-height: 1.4;
    }
    .md-hint.visible { display: block; }
  `;
  document.head.appendChild(s);
})();


/* ─────────────────────────────────────────────────────
   4.  LIVE HINT while typing
───────────────────────────────────────────────────── */
(function attachLiveHint() {
  const _init = () => {
    const ta = document.getElementById('msgTa');
    if (!ta) { setTimeout(_init, 300); return; }

    let hint = document.getElementById('mdHint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'mdHint';
      hint.className = 'md-hint';
      hint.textContent = '✦ Markdown detected — will render on send';
      ta.parentNode?.insertBefore(hint, ta.nextSibling);
    }

    ta.addEventListener('input', () => {
      const hasMd = MD.hasMarkdown(ta.value);
      hint.classList.toggle('visible', hasMd);
      ta.classList.toggle('has-md', hasMd);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();


/* ─────────────────────────────────────────────────────
   5.  MOBILE KEYBOARD FIX
───────────────────────────────────────────────────── */
(function initKeyboardFix() {
  if (typeof visualViewport === 'undefined') return;
  function onResize() {
    const vv = visualViewport;
    const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--keyboard-offset', keyboardHeight + 'px');
    const msgs = document.getElementById('msgs');
    if (msgs && keyboardHeight > 50) {
      setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 80);
    }
  }
  visualViewport.addEventListener('resize', onResize);
  visualViewport.addEventListener('scroll', onResize);
})();