# LM Studio Integration Setup

This question paper generator now supports local LLM integration via LM Studio!

## Quick Setup Guide

### 1. Prerequisites
- Install [LM Studio](https://lmstudio.ai/) on your Mac
- Download a language model (recommended: 4B-13B parameter models)
  - Example: `nvidia/nemotron-3-nano-4b`

### 2. Configure LM Studio

1. **Open LM Studio** on your Mac
2. **Load your model** from the model library (e.g., nvidia/nemotron-3-nano-4b)
3. **Start the local server**:
   - Go to the **"Developer"** or **"Server"** tab in LM Studio
   - Click **"Start Server"** to start the local API server
   - **⚠️ CRITICAL**: Find and check the **"Enable CORS"** or **"CORS Enabled"** checkbox
     - This is absolutely required for the web app to connect
     - Without CORS enabled, you'll get "Failed to fetch" errors
   - Note the server URL displayed (usually `http://localhost:1234`)
   - The port is usually 1234, but verify what LM Studio shows

### 3. Configure the App

1. Click **"LM Studio Settings"** button in the top right of the app
2. Enter your configuration:
   - **API URL**: `http://localhost:1234/v1` (OpenAI-compatible endpoint)
   - **API Token**: Leave empty (not required for most LM Studio setups)
   - **Model Name**: `nvidia/nemotron-3-nano-4b` (or your loaded model name)
3. Click **"Test Connection"** to verify everything works
4. **Enable** the checkbox at the top
5. Click **"Save Settings"**

### 4. Generate Papers

Once configured, the app will automatically use your local LLM to:
- Analyze the entire PDF textbook content
- Extract key concepts, definitions, and facts
- Generate contextually relevant questions based on actual content
- Create questions that test deep understanding, not just memorization

You'll see a **"LM Studio Active"** badge during generation when the local AI is being used.

## Benefits

- ✅ **Privacy**: All processing happens locally on your Mac
- ✅ **Quality**: AI-generated questions based on actual PDF content
- ✅ **Contextual**: Questions use real terminology and concepts from your textbook
- ✅ **Free**: No API costs or usage limits
- ✅ **Offline**: Works without internet connection

## Troubleshooting

### Connection Test Fails ("Failed to fetch" or TypeError)

**This is almost always a CORS issue!** CORS (Cross-Origin Resource Sharing) must be enabled in LM Studio for the web app to connect.

### How to Enable CORS in LM Studio:

**Step-by-step to enable CORS:**

1. Open **LM Studio** application
2. Click on the **"Developer"** or **"Server"** tab (top navigation)
3. Look for the **server settings panel** (usually on the right side)
4. Find the checkbox labeled:
   - **"Enable CORS"** or
   - **"CORS Enabled"** or  
   - **"Allow Cross-Origin Requests"**
5. **Check the box** to enable it
6. If the server is already running, click **"Stop Server"** then **"Start Server"** again
7. You should see the server status as "Running" with the URL shown

2. **Check the server is running**:
   - You should see a green indicator in LM Studio's server tab
   - The server URL should be displayed (e.g., `http://localhost:1234`)

3. **Verify the URL**:
   - Make sure you're using: `http://localhost:1234/v1` (OpenAI-compatible endpoint)
   - Don't use `https://` (use `http://`)
   - Include `/v1` at the end for the OpenAI-compatible API
   - Check the port number matches what LM Studio shows (usually 1234)

4. **Test from Terminal First** (to verify LM Studio is working):
   ```bash
   curl http://localhost:1234/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "nvidia/nemotron-3-nano-4b",
       "messages": [
         {"role": "system", "content": "You are helpful."},
         {"role": "user", "content": "Say hi"}
       ],
       "temperature": 0.7,
       "max_tokens": 50
     }'
   ```
   - If this works, LM Studio is running correctly and returns a response
   - If this fails, check that LM Studio server is started and the model is loaded

5. **Check Browser Console**:
   - Open your browser's developer tools (F12)
   - Look at the Console tab for detailed error messages
   - Look for errors mentioning "CORS", "fetch", or "Access-Control-Allow-Origin"
   - Check the Network tab to see if the request is being sent

### Questions Not Generated
- Check the browser console for error messages
- Verify the model is loaded in LM Studio
- Try with a smaller PDF first
- The app will automatically fall back to template-based generation if LLM fails

### Slow Generation
- Use a smaller model (4B parameters recommended)
- Reduce the number of questions per section
- This is normal for local AI - it's processing on your CPU/GPU

## Example Configuration

```
API URL:    http://localhost:1234/v1
API Token:  (leave empty)
Model:      nvidia/nemotron-3-nano-4b
```

**Important Notes**:
- Use `http://localhost:1234/v1` for the OpenAI-compatible endpoint
- The app uses the standard OpenAI chat completions format
- The API token shown in LM Studio is typically not needed for local connections
- Make sure the port number (1234) matches what's shown in LM Studio's server tab

## Notes

- Keep LM Studio running in the background while generating papers
- The first question in each section may take longer as the model processes the content
- Larger models (7B-13B parameters) produce better questions but are slower
- The app sends only the PDF content to the local LLM - no data leaves your machine
