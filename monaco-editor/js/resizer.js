// === Resizable Panels Logic ===
(function() {
  const activityBar = document.getElementById('activity-bar');
  const sidebar = document.getElementById('sidebar');
  const mainArea = document.getElementById('main-area');
  const activityBarHandle = document.getElementById('activity-bar-handle');
  const sidebarHandle = document.getElementById('sidebar-handle');
  let currentHandle = null;
  let startX = 0;
  let startWidth = 0;
  // Load saved sizes from localStorage
  function loadSizes() {
    const saved = localStorage.getItem('zeropen_panel_sizes');
    if (saved) {
      try {
        const sizes = JSON.parse(saved);
        if (sizes.activityBar) activityBar.style.width = sizes.activityBar + 'px';
        if (sizes.sidebar) sidebar.style.width = sizes.sidebar + 'px';
      } catch (e) {}
    }
  }
  // Save sizes to localStorage
  function saveSizes() {
    const sizes = {
      activityBar: activityBar.offsetWidth,
      sidebar: sidebar.offsetWidth
    };
    localStorage.setItem('zeropen_panel_sizes', JSON.stringify(sizes));
  }
  // Mouse down on a handle
  function onMouseDown(e) {
    currentHandle = e.target;
    currentHandle.classList.add('active');
    if (currentHandle === activityBarHandle) {
      startWidth = activityBar.offsetWidth;
    } else if (currentHandle === sidebarHandle) {
      startWidth = sidebar.offsetWidth;
    }
    startX = e.clientX;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    // Prevent text selection while dragging
    e.preventDefault();
  }
  // Mouse move while dragging
  function onMouseMove(e) {
    if (!currentHandle) return;
    const dx = e.clientX - startX;
    let newWidth = startWidth + dx;
    // Clamp minimum and maximum widths
    if (currentHandle === activityBarHandle) {
      newWidth = Math.max(40, Math.min(80, newWidth));
      activityBar.style.width = newWidth + 'px';
    } else if (currentHandle === sidebarHandle) {
      newWidth = Math.max(120, Math.min(500, newWidth));
      sidebar.style.width = newWidth + 'px';
    }
  }
  // Mouse up – stop dragging
  function onMouseUp() {
    if (currentHandle) {
      currentHandle.classList.remove('active');
      currentHandle = null;
      saveSizes();
    }
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
  // Attach listeners
  activityBarHandle.addEventListener('mousedown', onMouseDown);
  sidebarHandle.addEventListener('mousedown', onMouseDown);
  // Load saved sizes on startup
  loadSizes();
})();
