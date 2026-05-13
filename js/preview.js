// === Live Preview Logic ===
(function() {
  const PREVIEW_KEY = 'zeropen_preview_open';
  const PREVIEW_HEIGHT_KEY = 'zeropen_preview_height';
  const toggleBtn = document.getElementById('preview-toggle');
  const closeBtn = document.getElementById('close-preview-btn');
  const previewPanel = document.getElementById('preview-panel');
  const previewFrame = document.getElementById('preview-frame');
  const editorContainer = document.getElementById('editor-container');
  const previewHandle = document.getElementById('preview-handle');
  const splitContainer = document.getElementById('editor-preview-split');
  let previewOpen = localStorage.getItem(PREVIEW_KEY) === 'true';
  function updatePreview() {
    // Get content from the virtual file system
    const htmlContent = window.vfs ? (window.vfs['index.html'] || '') : '';
    const cssContent = window.vfs ? (window.vfs['style.css'] || '') : '';
    const jsContent = window.vfs ? (window.vfs['script.js'] || '') : '';
    const fullDoc = `
<!DOCTYPE html>
<html>
<head>
  <style>${cssContent}</style>
</head>
<body>
  ${htmlContent}
  <script>${jsContent}<\/script>
</body>
</html>`;
    const blob = new Blob([fullDoc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    // Revoke old URL to free memory
    if (previewFrame.dataset.blobUrl) {
      URL.revokeObjectURL(previewFrame.dataset.blobUrl);
    }
    previewFrame.src = url;
    previewFrame.dataset.blobUrl = url;
  }
  function openPreview() {
    previewOpen = true;
    previewPanel.style.display = 'flex';
    toggleBtn.classList.add('active');
    localStorage.setItem(PREVIEW_KEY, 'true');
    // Restore saved height
    const savedHeight = localStorage.getItem(PREVIEW_HEIGHT_KEY);
    if (savedHeight) {
      previewPanel.style.height = savedHeight + 'px';
      editorContainer.style.flex = 'none';
      editorContainer.style.height = `calc(100% - ${savedHeight}px - 4px)`;
    } else {
      previewPanel.style.height = '300px';
      editorContainer.style.flex = '1';
    }
    updatePreview();
  }
  function closePreview() {
    previewOpen = false;
    previewPanel.style.display = 'none';
    toggleBtn.classList.remove('active');
    localStorage.setItem(PREVIEW_KEY, 'false');
    editorContainer.style.flex = '1';
    editorContainer.style.height = '';
    previewPanel.style.height = '';
  }
  function togglePreview() {
    if (previewOpen) {
      closePreview();
    } else {
      openPreview();
    }
  }
  // Resize logic for preview handle
  let isDragging = false;
  let startY = 0;
  let startHeight = 0;
  previewHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    previewHandle.classList.add('active');
    startY = e.clientY;
    startHeight = previewPanel.offsetHeight;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  });
  function onMouseMove(e) {
    if (!isDragging) return;
    const dy = startY - e.clientY; // dragging up = increase preview
    let newHeight = startHeight + dy;
    // Clamp
    const maxHeight = splitContainer.offsetHeight - 120;
    newHeight = Math.max(80, Math.min(maxHeight, newHeight));
    previewPanel.style.height = newHeight + 'px';
    previewPanel.style.flex = 'none';
    editorContainer.style.flex = 'none';
    editorContainer.style.height = `calc(100% - ${newHeight}px - 4px)`;
    // Trigger Monaco resize
    if (window.monacoEditor) {
      window.monacoEditor.layout();
    }
  }
  function onMouseUp() {
    isDragging = false;
    previewHandle.classList.remove('active');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    // Save height
    localStorage.setItem(PREVIEW_HEIGHT_KEY, previewPanel.offsetHeight);
  }
  // Set up auto-refresh on file changes
  let refreshTimeout;
  window.addEventListener('fileChanged', () => {
    if (!previewOpen) return;
    clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(updatePreview, 500);
  });
  // Expose updatePreview globally so editor.js can call it
  window.updateLivePreview = function() {
    if (previewOpen) updatePreview();
  };
  // Listen for editor content changes
  const observer = new MutationObserver(() => {
    if (window.monacoEditor) {
      const model = window.monacoEditor.getModel();
      if (model && model._associatedFileName) {
        // Trigger preview update for web files
        const name = model._associatedFileName;
        if (name.endsWith('.html') || name.endsWith('.css') || name.endsWith('.js')) {
          window.updateLivePreview();
        }
      }
    }
  });
  // Buttons
  toggleBtn.addEventListener('click', togglePreview);
  closeBtn.addEventListener('click', closePreview);
  // Apply saved state on load
  if (previewOpen) {
    openPreview();
  }
})();
