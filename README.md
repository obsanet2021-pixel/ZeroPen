# ZeroPen

A code editor with DeepSeek AI integration.

## Setup

1. Get a DeepSeek API key from https://platform.deepseek.com/
2. Create a `.env` file in the project root with your API key:
   ```
   DEEPSEEK_API_KEY=your-api-key-here
   ```
   (You can copy `.env.example` as a template)
3. Run the server:
   ```bash
   node server.js
   ```
4. Open http://localhost:3000 in your browser

## Features

- Monaco Editor integration
- Virtual file system with folder support
- DeepSeek AI chat assistant
- Live preview for HTML files
