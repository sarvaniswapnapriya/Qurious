const express = require('express');
const cors = require('cors');
const firebaseAdmin = require('firebase-admin');
const path = require('path');


// Initialize Firebase Admin SDK using accountKey.json
// Note: Make sure this file is in your project root and has correct permissions
console.log(process.env.ACCOUNT_KEY_JSON);
const credentials = JSON.parse(process.env.ACCOUNT_KEY_JSON);
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(credentials),
  databaseURL: `https://${credentials.project_id}.firebaseio.com`
});


// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert(credentials),
//   });
// }
// const serviceAccount = require('./accountKey.json'); 
// console.log(serviceAccount)
// firebaseAdmin.initializeApp({
//   credential: firebaseAdmin.credential.cert(serviceAccount),
//   databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
// });
  

const db = firebaseAdmin.firestore();
const app = express();

app.use(cors());

// If you want to handle preflight requests explicitly:
app.options('*', cors());


app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to generate room code
function generateRoomCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

// Routes
app.post('/api/rooms', async (req, res) => {
  try {
    const { username } = req.body;

    // Ensure username is provided
    if (!username) return res.status(400).json({ error: 'Username required' });

    let roomCode = generateRoomCode();
    let roomRef = db.collection('rooms').doc(roomCode);
    let roomDoc = await roomRef.get();

    // Make sure we generate a unique room code
    while (roomDoc.exists) {
      roomCode = generateRoomCode();
      roomRef = db.collection('rooms').doc(roomCode);
      roomDoc = await roomRef.get();
    }

    // Set the initial room data
    await roomRef.set({
      owner: username,
      players: [username],
      status: 'waiting',
      currentQuestion: null,
      currentAsker: null,
      turnIndex: 0, // 0 = first player's turn
      playersData: {
        [username]: { answer: '', hasAnswered: false }
      },
      createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
    });

    // Send the room code back in the response
    res.status(201).json({ roomCode });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Route to join an existing room - FIXED (only one implementation)
app.post('/api/rooms/:roomCode/join', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { username } = req.body;
    
    if (!username) return res.status(400).json({ error: 'Username required' });

    const roomRef = db.collection('rooms').doc(roomCode);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) return res.status(404).json({ error: 'Room not found' });
    if (roomDoc.data().players.length >= 2) return res.status(400).json({ error: 'Room full' });

    const roomData = roomDoc.data();
    
    await roomRef.update({
      players: firebaseAdmin.firestore.FieldValue.arrayUnion(username),
      status: 'started',
      playersData: {
        ...roomData.playersData,
        [username]: { answer: '', hasAnswered: false }
      }
    });

    res.json({ 
      success: true,
      roomOwner: roomData.owner
    });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Route to get room details
app.get('/api/rooms/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;

    const roomRef = db.collection('rooms').doc(roomCode);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(roomDoc.data());
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to get room details' });
  }
});

// Route to submit a question
app.post('/api/rooms/:roomCode/question', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { question, asker } = req.body;

    if (!question || !asker) {
      return res.status(400).json({ error: 'Question and asker are required' });
    }

    const roomRef = db.collection('rooms').doc(roomCode);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const roomData = roomDoc.data();
    
    // Reset all answers when a new question is asked
    const resetPlayersData = {};
    roomData.players.forEach(player => {
      resetPlayersData[player] = { answer: '', hasAnswered: false };
    });

    await roomRef.update({
      currentQuestion: question,
      currentAsker: asker,
      playersData: resetPlayersData
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Submit question error:', error);
    res.status(500).json({ error: 'Failed to submit question' });
  }
});

// Route to submit an answer
app.post('/api/rooms/:roomCode/answer', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { answer, username } = req.body;

    if (!answer || !username) {
      return res.status(400).json({ error: 'Answer and username are required' });
    }

    const roomRef = db.collection('rooms').doc(roomCode);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const roomData = roomDoc.data();
    
    // Make sure user is in the room
    if (!roomData.players.includes(username)) {
      return res.status(400).json({ error: 'User not in room' });
    }
    
    // Update the player's answer
    await roomRef.update({
      [`playersData.${username}`]: {
        answer: answer,
        hasAnswered: true
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

// Route to switch turns
app.post('/api/rooms/:roomCode/switch-turn', async (req, res) => {
  try {
    const { roomCode } = req.params;

    const roomRef = db.collection('rooms').doc(roomCode);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const roomData = roomDoc.data();
    
    // Switch turns (0 -> 1 or 1 -> 0)
    const newTurnIndex = roomData.turnIndex === 0 ? 1 : 0;
    
    // Reset all answers when switching turns
    const resetPlayersData = {};
    roomData.players.forEach(player => {
      resetPlayersData[player] = { answer: '', hasAnswered: false };
    });
    
    await roomRef.update({
      turnIndex: newTurnIndex,
      currentQuestion: null,
      currentAsker: null,
      playersData: resetPlayersData
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Switch turn error:', error);
    res.status(500).json({ error: 'Failed to switch turns' });
  }
});

// Serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
const port = process.env.PORT || 3000;


module.exports = app;
