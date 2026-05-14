// === Persistent Virtual File System with Folder Support ===
const STORAGE_KEY = 'zeropen_files';
const DEMO_FILES = {
  'index.html': '<h1>Hello ZeroPen!</h1>\n<p>Edit me</p>',
  'css/style.css': 'body { background: #f0f0f0; }',
  'js/script.js': 'console.log("Hello");',
  'readme.md': '# ZeroPen\nA code editor with DeepSeek AI.'
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
let expandedFolders = new Set(JSON.parse(localStorage.getItem('zeropen_expanded_folders') || '[]'));
// Parse flat file paths into tree
function getFileTree() {
  const tree = {};
  Object.keys(vfs).sort().forEach(path => {
    const parts = path.split('/');
    let current = tree;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        current[part] = { type: 'file', path };
      } else {
        if (!current[part]) current[part] = { type: 'folder', children: {} };
        current = current[part].children;
      }
    });
  });
  return tree;
}
function renderFileTree() {
  const tree = document.getElementById('file-tree');
  tree.innerHTML = '';
  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'file-actions';
  actions.innerHTML = `
    <button class="new-file-btn" id="new-file-btn">+ New File</button>
    <button class="new-folder-btn" id="new-folder-btn">+ New Folder</button>
  `;
  tree.appendChild(actions);
  document.getElementById('new-file-btn').addEventListener('click', () => createNewItem('file'));
  document.getElementById('new-folder-btn').addEventListener('click', () => createNewItem('folder'));
  // Render tree
  const treeRoot = document.createElement('div');
  treeRoot.className = 'tree-root';
  renderTreeNode(treeRoot, getFileTree(), '');
  tree.appendChild(treeRoot);
}
function renderTreeNode(container, node, parentPath) {
  Object.entries(node).forEach(([name, info]) => {
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    const item = document.createElement('div');
    item.className = 'file-item';
    item.dataset.path = fullPath;
    if (info.type === 'folder') {
      const isExpanded = expandedFolders.has(fullPath);
      item.innerHTML = `
        <span class="folder-arrow">${isExpanded ? '▾' : '▸'}</span>
        <span class="file-icon">📁</span>
        <span>${name}</span>
      `;
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'folder-children';
      childrenContainer.style.display = isExpanded ? 'block' : 'none';
      childrenContainer.style.paddingLeft = '16px';
      if (isExpanded) {
        renderTreeNode(childrenContainer, info.children, fullPath);
      }
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (expandedFolders.has(fullPath)) {
          expandedFolders.delete(fullPath);
        } else {
          expandedFolders.add(fullPath);
        }
        localStorage.setItem('zeropen_expanded_folders', JSON.stringify([...expandedFolders]));
        renderFileTree();
      });
      container.appendChild(item);
      container.appendChild(childrenContainer);
    } else {
      item.innerHTML = `
        <span class="file-icon">📄</span>
        <span>${name}</span>
      `;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        openFile(fullPath);
      });
      container.appendChild(item);
    }
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      contextMenuTarget = fullPath;
      showContextMenu(e.clientX, e.clientY, info.type);
    });
  });
}
// Create new file or folder
function createNewItem(type) {
  const defaultPath = type === 'folder' ? 'new-folder' : 'new-file.txt';
  const promptMsg = type === 'folder' ? 'Enter folder name:' : 'Enter file path (e.g., css/style.css):';
  const path = prompt(promptMsg, defaultPath);
  if (!path) return;
  const safePath = path.replace(/[^a-zA-Z0-9._\-\/]/g, '');
  if (!safePath) return alert('Invalid name.');
  if (vfs[safePath]) return alert(`"${safePath}" already exists.`);
  if (type === 'folder') {
    // Create a placeholder file so the folder shows up
    vfs[safePath + '/.gitkeep'] = '';
    expandedFolders.add(safePath);
    localStorage.setItem('zeropen_expanded_folders', JSON.stringify([...expandedFolders]));
  } else {
    vfs[safePath] = '';
    openFile(safePath);
  }
  saveFileSystem();
  renderFileTree();
}
// Rename
function renameItem(oldPath) {
  const newPath = prompt(`Rename "${oldPath}" to:`, oldPath);
  if (!newPath || newPath === oldPath) return;
  const safePath = newPath.replace(/[^a-zA-Z0-9._\-\/]/g, '');
  if (!safePath) return alert('Invalid name.');
  if (vfs[safePath]) return alert(`"${safePath}" already exists.`);
  // Move all files under this path if it's a folder
  Object.keys(vfs).forEach(key => {
    if (key === oldPath || key.startsWith(oldPath + '/')) {
      const newKey = key.replace(oldPath, safePath);
      vfs[newKey] = vfs[key];
      delete vfs[key];
      // Update open tabs
      if (openTabs.has(key)) {
        const model = openTabs.get(key);
        model._associatedFileName = newKey;
        openTabs.delete(key);
        openTabs.set(newKey, model);
        const tab = document.querySelector(`.tab[data-file="${key}"]`);
        if (tab) {
          tab.dataset.file = newKey;
          tab.querySelector('.tab-label').textContent = newKey.split('/').pop();
        }
        if (activeTab === key) activeTab = newKey;
      }
    }
  });
  saveFileSystem();
  renderFileTree();
  document.getElementById('current-file').textContent = activeTab || 'No file open';
}
// Delete
function deleteItem(path) {
  if (!confirm(`Delete "${path}"? This cannot be undone.`)) return;
  const keysToDelete = [path];
  // If it's a folder, find all children
  Object.keys(vfs).forEach(key => {
    if (key.startsWith(path + '/')) keysToDelete.push(key);
  });
  keysToDelete.forEach(key => {
    if (openTabs.has(key)) closeFile(key);
    delete vfs[key];
  });
  expandedFolders.delete(path);
  localStorage.setItem('zeropen_expanded_folders', JSON.stringify([...expandedFolders]));
  saveFileSystem();
  renderFileTree();
}
// Context menu
function showContextMenu(x, y, type) {
  const existing = document.getElementById('context-menu');
  if (existing) existing.remove();
  const menu = document.createElement('div');
  menu.id = 'context-menu';
  menu.className = 'context-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  let items = `
    <div class="context-item" data-action="rename">✏️ Rename</div>
    <div class="context-item delete" data-action="delete">🗑️ Delete</div>
  `;
  if (type === 'folder') {
    items = `
      <div class="context-item" data-action="new-file-in-folder">📄 New File Here</div>
      <div class="context-item" data-action="new-folder-in-folder">📁 New Folder Here</div>
      <div class="context-separator"></div>
      ${items}
    `;
  }
  menu.innerHTML = items;
  menu.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (action === 'rename') renameItem(contextMenuTarget);
    if (action === 'delete') deleteItem(contextMenuTarget);
    if (action === 'new-file-in-folder') {
      contextMenuTarget = contextMenuTarget; // keep folder path
      createNewItemInFolder('file', contextMenuTarget);
    }
    if (action === 'new-folder-in-folder') {
      createNewItemInFolder('folder', contextMenuTarget);
    }
    menu.remove();
  });
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}
function createNewItemInFolder(type, folderPath) {
  const defaultPath = type === 'folder' ? `${folderPath}/new-folder` : `${folderPath}/new-file.txt`;
  const path = prompt(`Enter ${type} path:`, defaultPath);
  if (!path) return;
  const safePath = path.replace(/[^a-zA-Z0-9._\-\/]/g, '');
  if (!safePath) return alert('Invalid name.');
  if (vfs[safePath]) return alert('Already exists.');
  if (type === 'folder') {
    vfs[safePath + '/.gitkeep'] = '';
    expandedFolders.add(safePath);
    localStorage.setItem('zeropen_expanded_folders', JSON.stringify([...expandedFolders]));
  } else {
    vfs[safePath] = '';
    openFile(safePath);
  }
  saveFileSystem();
  renderFileTree();
}
// Monaco setup
require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
  initEditor();
  renderFileTree();
  setupSidebarToggle();
  setupDeepSeekPlaceholder();
  const lastOpen = localStorage.getItem('zeropen_last_file') || 'index.html';
  if (vfs[lastOpen]) {
    openFile(lastOpen);
  } else {
    const firstFile = Object.keys(vfs).find(k => !k.endsWith('/.gitkeep'));
    if (firstFile) openFile(firstFile);
  }
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
    minimap: { enabled: false },
    padding: { top: 8 }
  });
  monacoEditor.onDidChangeModelContent(() => {
    const model = monacoEditor.getModel();
    if (model && model._associatedFileName) {
      vfs[model._associatedFileName] = model.getValue();
      saveFileSystem();
      if (window.updateLivePreview) window.updateLivePreview();
    }
  });
}
function getLanguageFromFileName(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    'html': 'html', 'css': 'css', 'js': 'javascript',
    'md': 'markdown', 'py': 'python', 'rb': 'ruby',
    'json': 'json', 'ts': 'typescript', 'txt': 'plaintext',
    'xml': 'xml', 'svg': 'xml', 'sql': 'sql', 'sh': 'shell',
    'yml': 'yaml', 'yaml': 'yaml'
  };
  return map[ext] || 'plaintext';
}
function openFile(filename) {
  if (!vfs[filename] && vfs[filename] !== '') return;
  if (filename.endsWith('/.gitkeep')) return; // don't open placeholder files
  if (openTabs.has(filename)) { switchToTab(filename); return; }
  const content = vfs[filename] || '';
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
  const displayName = filename.split('/').pop();
  const tab = document.createElement('div');
  tab.className = 'tab' + (focus ? ' active' : '');
  tab.dataset.file = filename;
  tab.innerHTML = `<span class="tab-label">${displayName}</span><span class="close-tab">&times;</span>`;
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
      const res = await fetch('/api/deepseek-proxy', {
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
