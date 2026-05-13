// Virtual File System (in-memory, later localStorage)
const vfs = {
  'index.html': '<h1>Hello ZeroPen!</h1>\n<p>Edit me</p>',
  'style.css': 'body { background: #f0f0f0; }',
  'script.js': 'console.log("Hello");',
  'readme.md': '# ZeroPen\nA vscode.dev style editor with DeepSeek.'
};
const fileTreeState = {
  expanded: true  // we'll keep it simple, always expanded
};
// Current state
let openTabs = new Map(); // filename -> editor model
let activeTab = null;
let monacoEditor = null;
// Wait for Monaco to load
require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
  initEditor();
  renderFileTree();
  setupTabs();
  setupSidebarToggle();
  setupDeepSeekPlaceholder();
  // Open a default file
  openFile('index.html');
});
function initEditor() {
  monacoEditor = monaco.editor.create(document.getElementById('editor-container'), {
    value: '',
    language: 'plaintext',
    theme: 'vs-dark',
    automaticLayout: true,
    fontSize: 14,
    minimap: { enabled: false }
  });
  // Listen for model changes to update status bar (optional)
  monacoEditor.onDidChangeModelContent(() => {
    // Could auto-save to vfs
    const model = monacoEditor.getModel();
    if (model && model._associatedFileName) {
      vfs[model._associatedFileName] = model.getValue();
    }
  });
}
function getLanguageFromFileName(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    'html': 'html',
    'css': 'css',
    'js': 'javascript',
    'md': 'markdown',
    'py': 'python',
    'rb': 'ruby',
    'json': 'json',
    'ts': 'typescript'
  };
  return map[ext] || 'plaintext';
}
function openFile(filename) {
  // If already open, just switch
  if (openTabs.has(filename)) {
    switchToTab(filename);
    return;
  }
  // Create a new model
  const content = vfs[filename] || '';
  const lang = getLanguageFromFileName(filename);
  const model = monaco.editor.createModel(content, lang);
  // Store filename reference (not a standard property, but works)
  model._associatedFileName = filename;
  openTabs.set(filename, model);
  // Add a tab
  addTab(filename, true);
  switchToTab(filename);
}
function switchToTab(filename) {
  if (activeTab === filename) return;
  activeTab = filename;
  const model = openTabs.get(filename);
  monacoEditor.setModel(model);
  // Update tab styles
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.file === filename);
  });
  // Update status bar
  document.getElementById('current-file').textContent = filename;
}
function addTab(filename, focus = false) {
  const tabBar = document.getElementById('tab-bar');
  const existing = document.querySelector(`.tab[data-file="${filename}"]`);
  if (existing) return;
  const tab = document.createElement('div');
  tab.className = 'tab' + (focus ? ' active' : '');
  tab.dataset.file = filename;
  tab.innerHTML = `
    <span class="tab-label">${filename}</span>
    <span class="close-tab" data-file="${filename}">&times;</span>
  `;
  tab.addEventListener('click', (e) => {
    if (e.target.classList.contains('close-tab')) {
      closeFile(filename);
    } else {
      switchToTab(filename);
    }
  });
  tabBar.appendChild(tab);
  if (focus) {
    switchToTab(filename);
  }
}
function closeFile(filename) {
  if (openTabs.has(filename)) {
    const model = openTabs.get(filename);
    model.dispose();
    openTabs.delete(filename);
  }
  // Remove tab
  const tab = document.querySelector(`.tab[data-file="${filename}"]`);
  if (tab) tab.remove();
  // If closed the active file, switch to another
  if (activeTab === filename) {
    if (openTabs.size > 0) {
      const nextFile = openTabs.keys().next().value;
      switchToTab(nextFile);
    } else {
      monacoEditor.setModel(null);
      activeTab = null;
      document.getElementById('current-file').textContent = 'No file open';
    }
  }
}
function renderFileTree() {
  const tree = document.getElementById('file-tree');
  tree.innerHTML = '';
  Object.keys(vfs).forEach(filename => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <span class="file-icon">📄</span>
      <span>${filename}</span>
    `;
    item.addEventListener('click', () => openFile(filename));
    tree.appendChild(item);
  });
}
function setupTabs() {
  // Only needed if we want to open the first file on load
}
function setupSidebarToggle() {
  const icons = document.querySelectorAll('.activity-icon');
  icons.forEach(icon => {
    icon.addEventListener('click', () => {
      // Deactivate all
      icons.forEach(i => i.classList.remove('active'));
      // Activate this
      icon.classList.add('active');
      const panel = icon.dataset.sidebar;
      document.querySelectorAll('.sidebar-content').forEach(c => c.classList.remove('active'));
      document.getElementById(panel + '-content').classList.add('active');
    });
  });
}
function setupDeepSeekPlaceholder() {
  const sendBtn = document.getElementById('send-btn');
  const input = document.getElementById('chat-input');
  const messages = document.getElementById('chat-messages');
  sendBtn.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) return;
    // Add user message
    addChatMessage(text, 'user');
    input.value = '';
    // Simulate DeepSeek response (replace with real API later)
    setTimeout(() => {
      addChatMessage("DeepSeek: I'm your AI agent. (API integration coming soon!)", 'assistant');
    }, 500);
  });
  // Allow Enter to send (Shift+Enter for new line)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });
}
function addChatMessage(text, sender) {
  const messages = document.getElementById('chat-messages');
  const msg = document.createElement('div');
  msg.className = 'message ' + sender;
  msg.textContent = text;
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
}
