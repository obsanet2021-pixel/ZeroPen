// === Download Project as ZIP ===
(function() {
  const downloadBtn = document.getElementById('download-btn');
  downloadBtn.addEventListener('click', async () => {
    // Show a brief "downloading" state
    const originalTitle = downloadBtn.title;
    downloadBtn.title = 'Downloading...';
    downloadBtn.style.opacity = '0.6';
    try {
      const zip = new JSZip();
      // Get all files from the virtual file system
      const files = window.vfs || {};
      if (Object.keys(files).length === 0) {
        alert('No files to download. Create some files first!');
        return;
      }
      // Add each file to the ZIP
      Object.entries(files).forEach(([filename, content]) => {
        zip.file(filename, content);
      });
      // Generate the ZIP file
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      // Trigger download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'zeropen-project.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      // Brief success feedback
      downloadBtn.title = 'Downloaded!';
      setTimeout(() => {
        downloadBtn.title = originalTitle;
      }, 1500);
    } catch (error) {
      console.error('[ZeroPen] Download failed:', error);
      alert('Failed to generate ZIP. Please try again.');
    } finally {
      downloadBtn.style.opacity = '1';
      setTimeout(() => {
        downloadBtn.title = originalTitle;
      }, 2000);
    }
  });
})();
