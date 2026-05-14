document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;
  addMessage(message, 'user');
  input.value = '';
  const thinkingId = addMessage('DeepSeek is thinking...', 'assistant');
  try {
    const response = await fetch('/api/deepseek-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are DeepSeek AI, integrated into ZeroPen. Help with coding questions. Be concise and helpful.' },
          { role: 'user', content: message }
        ],
        stream: false
      })
    });
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Sorry, no response received.';
    removeMessage(thinkingId);
    addMessage(reply, 'assistant');
  } catch (e) {
    removeMessage(thinkingId);
    addMessage('Sorry, could not connect to DeepSeek. Please try again.', 'assistant');
  }
}
function addMessage(text, sender) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  const id = 'msg-' + Date.now();
  div.id = id;
  div.className = 'message ' + sender;
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}
function removeMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}
