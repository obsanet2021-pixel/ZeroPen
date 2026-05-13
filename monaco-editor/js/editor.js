// === Persistent Virtual File System using localStorage ===
const STORAGE_KEY = 'zeropen_files';
const DEMO_FILES = {
  'index.html': '<h1>Hello ZeroPen!</h1>\n<p>Edit me</p>',
  'style.css': 'body { background: #f0f0f0; }',
  'script.js': 'console.log("Hello");',
  'readme.md': '# ZeroPen\nA vscode.dev style editor with DeepSeek.'
};
function loadFileSystem() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch (e) {}
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_FILES));
  return { ...DEMO_FILES };
}
function saveFileSystem() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vfs));
}
const vfs = loadFileSystem();
let openTabs = new Map();
let activeTab = null;
let monacoEditor = null;
let contextMenuTarget = null;
require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
  initEditor();
  renderFileTree();
  setupTabs();
  setupSidebarToggle();
  setupDeepSeekPlaceholder();
  setupContextMenu();
  const lastOpen = localStorage.getItem('zeropen_last_file') || 'index.html';
  if (vfs[lastOpen]) {
    openFile(lastOpen);
  } else {
    openFile(Object.keys(vfs)[0]);
  }
  // Expose for theme.js
  window.monacoEditor = monacoEditor;
});
function initEditor() {
  const currentTheme = window.getCurrentTheme ? window.getCurrentTheme() : 'dark';
  const theme = currentTheme === 'light' ? 'vs' : 'vs-dark';
  monacoEditor = monaco.editor.create(document.getElementById('editor-container'), {
    value: '',
    language: 'plaintext',
    theme: theme,
    automaticLayout: true,
    fontSize: 14,
    minimap: { enabled: false }
  });
  monacoEditor.onDidChangeModelContent(() => {
    const model = monacoEditor.getModel();
    if (model && model._associatedFileName) {
      vfs[model._associatedFileName] = model.getValue();
      saveFileSystem();
    }
  });
}
function getLanguageFromFileName(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    'html': 'html', 'css': 'css', 'js': 'javascript',
    'md': 'markdown', 'py': 'python', 'rb': 'ruby',
    'json': 'json', 'ts': 'typescript', 'txt': 'plaintext'
  };
  return map[ext] || 'plaintext';
}
function createNewFile() {
  const filename = prompt('Enter file name (e.g., app.py, style.css):');
  if (!filename) return;
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safeName) return alert('Invalid file name.');
  if (vfs[safeName]) return alert(`File "${safeName}" already exists.`);
  vfs[safeName] = '';
  saveFileSystem();
  renderFileTree();
  openFile(safeName);
}
function renameFile(oldName) {
  const newName = prompt(`Rename "${oldName}" to:`, oldName);
  if (!newName || newName === oldName) return;
  const safeName = newName.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safeName) return alert('Invalid file name.');
  if (vfs[safeName]) return alert(`File "${safeName}" already exists.`);
  vfs[safeName] = vfs[oldName];
  delete vfs[oldName];
  saveFileSystem();
  if (openTabs.has(oldName)) {
    const model = openTabs.get(oldName);
    model._associatedFileName = safeName;
    openTabs.delete(oldName);
    openTabs.set(safeName, model);
    const tab = document.querySelector(`.tab[data-file="${oldName}"]`);
    if (tab) {
      tab.dataset.file = safeName;
      tab.querySelector('.tab-label').textContent = safeName;
    }
    if (activeTab === oldName) {
      activeTab = safeName;
      document.getElementById('current-file').textContent = safeName;
      localStorage.setItem('zeropen_last_file', safeName);
    }
  }
  renderFileTree();
}
function deleteFile(filename) {
  if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
  if (openTabs.has(filename)) closeFile(filename);
  delete vfs[filename];
  saveFileSystem();
  renderFileTree();
}
function renderFileTree() {
  const tree = document.getElementById('file-tree');
  tree.innerHTML = '';
  const newBtn = document.createElement('button');
  newBtn.textContent = '+ New File';
  newBtn.className = 'new-file-btn';
  newBtn.addEventListener('click', createNewFile);
  tree.appendChild(newBtn);
  Object.keys(vfs).sort().forEach(filename => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `<span class="file-icon">📄</span><span>${filename}</span>`;
    item.addEventListener('click', () => openFile(filename));
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextMenuTarget = filename;
      showContextMenu(e.clientX, e.clientY);
    });
    tree.appendChild(item);
  });
}
function setupContextMenu() {
  document.addEventListener('click', () => {
    const menu = document.getElementById('context-menu');
    if (menu) menu.remove();
  });
}
function showContextMenu(x, y) {
  const existing = document.getElementById('context-menu');
  if (existing) existing.remove();
  const menu = document.createElement('div');
  menu.id = 'context-menu';
  menu.className = 'context-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.innerHTML = `
    <div class="context-item" data-action="rename">✏️ Rename</div>
    <div class="context-item delete" data-action="delete">🗑️ Delete</div>
  `;
  menu.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (action === 'rename') renameFile(contextMenuTarget);
    if (action === 'delete') deleteFile(contextMenuTarget);
    menu.remove();
  });
  setTimeout(() => document.body.appendChild(menu), 0);
}
function openFile(filename) {
  if (!vfs[filename]) return;
  if (openTabs.has(filename)) { switchToTab(filename); return; }
  const content = vfs[filename];
  const lang = getLanguageFromFileName(filename);
  const model = monaco.editor.createModel(content, lang);
  model._associatedFileName = filename;
  openTabs.set(filename, model);
  addTab(filename, true);
  switchToTab(filename);
  localStorage.setItem('zeropen_last_file', filename);
}
function switchToTab(filename) {
  if (activeTab === filename) return;
  activeTab = filename;
  monacoEditor.setModel(openTabs.get(filename));
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.file === filename);
  });
  document.getElementById('current-file').textContent = filename;
  localStorage.setItem('zeropen_last_file', filename);
}
function addTab(filename, focus = false) {
  const tabBar = document.getElementById('tab-bar');
  const existing = document.querySelector(`.tab[data-file="${filename}"]`);
  if (existing) return;
  const tab = document.createElement('div');
  tab.className = 'tab' + (focus ? ' active' : '');
  tab.dataset.file = filename;
  tab.innerHTML = `<span class="tab-label">${filename}</span><span class="close-tab" data-file="${filename}">&times;</span>`;
  tab.addEventListener('click', (e) => {
    if (e.target.classList.contains('close-tab')) closeFile(filename);
    else switchToTab(filename);
  });
  tabBar.appendChild(tab);
  if (focus) switchToTab(filename);
}
function closeFile(filename) {
  if (openTabs.has(filename)) { openTabs.get(filename).dispose(); openTabs.delete(filename); }
  const tab = document.querySelector(`.tab[data-file="${filename}"]`);
  if (tab) tab.remove();
  if (activeTab === filename) {
    if (openTabs.size > 0) {
      switchToTab(openTabs.keys().next().value);
    } else {
      monacoEditor.setModel(null);
      activeTab = null;
      document.getElementById('current-file').textContent = 'No file open';
    }
  }
}
function setupTabs() {}
function setupSidebarToggle() {
  document.querySelectorAll('.activity-icon[data-sidebar]').forEach(icon => {
    icon.addEventListener('click', () => {
      document.querySelectorAll('.activity-icon[data-sidebar]').forEach(i => i.classList.remove('active'));
      icon.classList.add('active');
      const panel = icon.dataset.sidebar;
      document.querySelectorAll('.sidebar-content').forEach(c => c.classList.remove('active'));
      document.getElementById(panel + '-content').classList.add('active');
    });
  });
}
// DeepSeek Chat
function addChatMessage(text, sender) {
  const c = document.getElementById('chat-messages');
  if (!c) return;
  const d = document.createElement('div');
  d.className = `message ${sender}`;
  d.textContent = text;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
}
function getCurrentFileContext() {
  if (!monacoEditor) return null;
  const m = monacoEditor.getModel();
  return m ? { fileName: m._associatedFileName || 'unknown', content: m.getValue() } : null;
}
function setupDeepSeekPlaceholder() {
  const sendBtn = document.getElementById('send-btn');
  const input = document.getElementById('chat-input');
  const mc = document.getElementById('chat-messages');
  if (!sendBtn || !input || !mc) return;
  let history = [];
  async function send(userMessage, ctx) {
    let msgs = [...history];
    if (ctx) msgs.push({ role: "system", content: `File "${ctx.fileName}":\n\`\`\`\n${ctx.content}\n\`\`\`` });
    msgs.push({ role: "user", content: userMessage });
    try {
      const res = await fetch('http://localhost:3000/api/deepseek-proxy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'deepseek-chat', messages: msgs, stream: false }),
      });
      const data = await res.json();
      if (data.choices?.length) {
        const ai = data.choices[0].message.content;
        history.push({ role: 'user', content: userMessage }, { role: 'assistant', content: ai });
        return ai;
      }
      return "Sorry, unexpected response.";
    } catch (e) { return "Sorry, couldn't connect."; }
  }
  sendBtn.addEventListener('click', async () => {
    const msg = input.value.trim(); if (!msg) return;
    addChatMessage(msg, 'user'); input.value = '';
    const t = document.createElement('div'); t.className = 'message assistant'; t.textContent = 'Thinking...'; mc.appendChild(t);
    const ai = await send(msg, getCurrentFileContext());
    mc.removeChild(t); addChatMessage(ai, 'assistant');
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); } });
}
