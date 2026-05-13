@'
function createEditor(elementId, mode, initialContent) {
  const editor = ace.edit(elementId, {
    mode: mode,
    theme: "ace/theme/monokai",
    fontSize: "14px",
    showPrintMargin: false,
    wrap: true,
    useWorker: false
  });
  editor.setValue(initialContent, -1);
  editor.clearSelection();
  return editor;
}

const htmlContent = `<!-- Write your HTML here -->
<h1>Hello, ZeroPen!</h1>
<p>We built this together 🤝</p>`;

const cssContent = `/* Write your CSS here */
body {
  background: #f0f0f0;
  font-family: Arial, sans-serif;
  padding: 20px;
}
h1 {
  color: #e91e63;
}`;

const jsContent = `// Write your JavaScript here
document.querySelector('h1').addEventListener('click', () => {
  alert('You clicked the heading!');
});`;

const htmlEditor = createEditor("html-editor", "ace/mode/html", htmlContent);
const cssEditor  = createEditor("css-editor", "ace/mode/css", cssContent);
const jsEditor   = createEditor("js-editor", "ace/mode/javascript", jsContent);
const previewFrame = document.getElementById("preview-frame");

function updatePreview() {
  const html = htmlEditor.getValue();
  const css  = cssEditor.getValue();
  const js   = jsEditor.getValue();

  const fullDocument = `
<!DOCTYPE html>
<html>
<head>
  <style>${css}</style>
</head>
<body>
  ${html}
  <script>${js}<\/script>
</body>
</html>`;

  const blob = new Blob([fullDocument], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  previewFrame.src = url;
}

let timeout;
function onChange() {
  clearTimeout(timeout);
  timeout = setTimeout(updatePreview, 300);
}

htmlEditor.session.on('change', onChange);
cssEditor.session.on('change', onChange);
jsEditor.session.on('change', onChange);

updatePreview();
'@ | Out-File -FilePath js/editor.js -Encoding utf8