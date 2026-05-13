// === Persistent Virtual File System using localStorage ===
const STORAGE_KEY = 'zeropen_files';
const DEMO_FILES = {
  'index.html': '<h1>Hello ZeroPen!</h1>\n<p>Edit me</p>',
  'style.css': 'body { background: #f0f0f0; }',
  'script.js': 'console.log("Hello");',
  'readme.md': '# ZeroPen\nA vscode.dev style editor with DeepSeek.'
};
// Load files from localStorage or use demo files
function loadFileSystem() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('[ZeroPen] Failed to parse stored files, using defaults');
    }
  }
  // First time: save demo files to localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_FILES));
  return { ...DEMO_FILES };
}
// Save entire file system to localStorage
function saveFileSystem() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vfs));
}
// Initialize vfs
const vfs = loadFileSystem();
// Current state
let openTabs = new Map();
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
  // Open the first file or restore last session
  const lastOpen = localStorage.getItem('zeropen_last_file') || 'index.html';
  if (vfs[lastOpen]) {
    openFile(lastOpen);
  } else {
    openFile(Object.keys(vfs)[0]);
  }
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
  // Auto-save on changes
  monacoEditor.onDidChangeModelContent(() => {
    const model = monacoEditor.getModel();
    if (model && model._associatedFileName) {
      vfs[model._associatedFileName] = model.getValue();
      saveFileSystem();  // ← PERSIST
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
  if (!vfs[filename]) return;
  if (openTabs.has(filename)) {
    switchToTab(filename);
    return;
  }
  const content = vfs[filename];
  const lang = getLanguageFromFileName(filename);
  const model = monaco.editor.createModel(content, lang);
  model._associatedFileName = filename;
  openTabs.set(filename, model);
  addTab(filename, true);
  switchToTab(filename);
  // Remember last opened file
  localStorage.setItem('zeropen_last_file', filename);
}
function switchToTab(filename) {
  if (activeTab === filename) return;
  activeTab = filename;
  const model = openTabs.get(filename);
  monacoEditor.setModel(model);
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
  if (focus) switchToTab(filename);
}
function closeFile(filename) {
  if (openTabs.has(filename)) {
    const model = openTabs.get(filename);
    model.dispose();
    openTabs.delete(filename);
  }
  const tab = document.querySelector(`.tab[data-file="${filename}"]`);
  if (tab) tab.remove();
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
function setupTabs() {}
function setupSidebarToggle() {
  const icons = document.querySelectorAll('.activity-icon');
  icons.forEach(icon => {
    icon.addEventListener('click', () => {
      icons.forEach(i => i.classList.remove('active'));
      icon.classList.add('active');
      const panel = icon.dataset.sidebar;
      document.querySelectorAll('.sidebar-content').forEach(c => c.classList.remove('active'));
      document.getElementById(panel + '-content').classList.add('active');
    });
  });
}
// === DeepSeek Chat (preserved) ===
function addChatMessage(text, sender) {
  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;
  messageDiv.textContent = text;
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
function getCurrentFileContext() {
  if (!monacoEditor) return null;
  const model = monacoEditor.getModel();
  if (!model) return null;
  return {
    fileName: model._associatedFileName || 'unknown',
    content: model.getValue()
  };
}
function setupDeepSeekPlaceholder() {
  const sendBtn = document.getElementById('send-btn');
  const input = document.getElementById('chat-input');
  const messagesContainer = document.getElementById('chat-messages');
  if (!sendBtn || !input || !messagesContainer) {
    console.error('[ZeroPen] Chat UI elements not found.');
    return;
  }
  let conversationHistory = [];
  async function sendMessageToDeepSeek(userMessage, fileContext) {
    const proxyUrl = 'http://localhost:3000/api/deepseek-proxy';
    let messages = [...conversationHistory];
    if (fileContext) {
      messages.push({ 
        role: "system", 
        content: `The user is currently working on "${fileContext.fileName}". Content:\n\`\`\`\n${fileContext.content}\n\`\`\`` 
      });
    }
    messages.push({ role: "user", content: userMessage });
    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'deepseek-chat', messages: messages, stream: false }),
      });
      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        const aiMessage = data.choices[0].message.content;
        conversationHistory.push({ role: 'user', content: userMessage });
        conversationHistory.push({ role: 'assistant', content: aiMessage });
        return aiMessage;
      } else {
        console.error('[ZeroPen] Unexpected response:', data);
        return "Sorry, I received an unexpected response.";
      }
    } catch (error) {
      console.error('[ZeroPen] Network error:', error);
      return "Sorry, couldn't connect to the AI.";
    }
  }
  sendBtn.addEventListener('click', async () => {
    const userMessage = input.value.trim();
    if (!userMessage) return;
    addChatMessage(userMessage, 'user');
    input.value = '';
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'message assistant';
    thinkingDiv.textContent = 'DeepSeek is thinking...';
    messagesContainer.appendChild(thinkingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    const fileContext = getCurrentFileContext();
    const aiResponse = await sendMessageToDeepSeek(userMessage, fileContext);
    messagesContainer.removeChild(thinkingDiv);
    addChatMessage(aiResponse, 'assistant');
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });
  console.log('[ZeroPen] DeepSeek ready.');
}
