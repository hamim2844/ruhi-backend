const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
 // 👈 this JSON file should be downloaded from Firebase project settings

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

app.post('/api/ask', async (req, res) => {
  const { messages, uid } = req.body;
  if (!messages || !uid) {
    return res.status(400).json({ error: 'messages and uid required' });
  }

  try {
    // Store user's message in Firestore
    const userRef = db.collection('users').doc(uid).collection('chatHistory');
    await userRef.add({
      role: 'user',
      content: messages[messages.length - 1]?.content || '',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // Send message to OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat-v3-0324:free',
        messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const data = await response.json();

    // Store assistant's reply in Firestore
    await userRef.add({
      role: 'assistant',
      content: data.choices?.[0]?.message?.content || '',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to process request', details: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
