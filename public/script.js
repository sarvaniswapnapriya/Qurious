// DOM elements
const createTabBtn = document.getElementById('create-tab-btn');
const joinTabBtn = document.getElementById('join-tab-btn');
const createTab = document.getElementById('create-tab');
const joinTab = document.getElementById('join-tab');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const usernameCreateInput = document.getElementById('username-create');
const usernameJoinInput = document.getElementById('username-join');
const roomCodeInput = document.getElementById('room-code-input');
const roomCodeDisplay = document.getElementById('room-code-display');
const homepage = document.getElementById('homepage');
const waitingRoom = document.getElementById('waiting-room');
const gameScreen = document.getElementById('game-screen');
const connectionStatus = document.getElementById('connection-status');
const questionInputSection = document.getElementById('question-input-section');
const questionInput = document.getElementById('question-input');
const submitQuestionBtn = document.getElementById('submit-question-btn');
const activeQuestion = document.getElementById('active-question');
const currentQuestion = document.getElementById('current-question');
const askerDisplay = document.getElementById('asker-display');
const addAnswerBtn = document.getElementById('add-answer-btn');
const answerModal = document.getElementById('answer-modal');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const answerInput = document.getElementById('answer-input');
const answersSection = document.getElementById('answers-section');
const friendNameElement = document.getElementById('friend-name');
const friendAnswerElement = document.getElementById('friend-answer');
const yourNameElement = document.getElementById('your-name');
const userAnswerElement = document.getElementById('user-answer');
const lockedAnswer = document.getElementById('locked-answer');
const myTurnBtn = document.getElementById('my-turn-btn');
const theirTurnBtn = document.getElementById('their-turn-btn');
const answerStatus = document.getElementById('answer-status');

// App state
let state = {
  username: '',
  roomCode: '',
  isTurnToAsk: false,
  currentQuestion: '',
  currentAsker: '',
  myAnswer: '',
  friendAnswer: '',
  friendName: '',
  friendHasAnswered: false,
  iHaveAnswered: false
};

// Tab switching
createTabBtn.addEventListener('click', () => {
  createTabBtn.classList.add('active');
  joinTabBtn.classList.remove('active');
  createTab.classList.add('active');
  joinTab.classList.remove('active');
});

joinTabBtn.addEventListener('click', () => {
  joinTabBtn.classList.add('active');
  createTabBtn.classList.remove('active');
  joinTab.classList.add('active');
  createTab.classList.remove('active');
});

// Create room
createRoomBtn.addEventListener('click', async () => {
  const username = usernameCreateInput.value.trim();
  if (!username) {
    alert('Please enter your name');
    return;
  }
  
  try {
    const response = await fetch('https://wesaid-backend.vercel.app/api/rooms/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username })
    });
    
    const data = await response.json();
    
    state.username = username;
    state.roomCode = data.roomCode;
    state.isTurnToAsk = true; // Creator gets first turn
    
    roomCodeDisplay.textContent = state.roomCode;
    homepage.style.display = 'none';
    waitingRoom.style.display = 'block';
    
    // Start polling for game updates
    checkForFriendJoining();
  } catch (error) {
    alert('Failed to create room');
    console.error(error);
  }
});

// Join room
joinRoomBtn.addEventListener('click', async () => {
  const username = usernameJoinInput.value.trim();
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  
  if (!username) {
    alert('Please enter your name');
    return;
  }
  if (roomCode.length !== 4) {
    alert('Please enter a valid 4-letter room code');
    return;
  }
  
  try {
    const response = await fetch(`/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username })
    });
    
    if (!response.ok) {
      const error = await response.json();
      alert(error.message || 'Failed to join room');
      return;
    }
    
    const data = await response.json();
    
    state.username = username;
    state.roomCode = roomCode;
    state.isTurnToAsk = data.isTurnToAsk;
    
    homepage.style.display = 'none';
    startGame();
  } catch (error) {
    alert('Failed to join room');
    console.error(error);
  }
});

// Check if friend joined
async function checkForFriendJoining() {
  const checkInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/rooms/${state.roomCode}`);
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.players.length > 1) {
        clearInterval(checkInterval);
        state.friendName = data.players.find(p => p !== state.username);
        startGame();
      }
    } catch (error) {
      console.error('Error checking for friend:', error);
    }
  }, 2000);
}

// Start game
async function startGame() {
  waitingRoom.style.display = 'none';
  gameScreen.style.display = 'block';
  
  // Load initial game state
  await loadGameState();
  
  // If it's your turn to ask, show question input immediately
  if (state.isTurnToAsk && !state.currentQuestion) {
    questionInputSection.style.display = 'block';
    answerStatus.textContent = "It's your turn to ask a question";
  } else if (!state.currentQuestion) {
    answerStatus.textContent = "Waiting for your friend to ask a question...";
  }
  
  updateGameUI();
  
  // Set up polling for game updates
  setInterval(async () => {
    if (await loadGameState()) {
      updateGameUI();
    }
  }, 2000);
}

// Load game state from server
async function loadGameState() {
  try {
    const response = await fetch(`/api/rooms/${state.roomCode}`);
    if (!response.ok) return false;
    
    const data = await response.json();
    
    // Figure out if you're player 0 or 1
    const isPlayer0 = data.players[0] === state.username;
    const playerIndex = isPlayer0 ? 0 : 1;
    const otherIndex = isPlayer0 ? 1 : 0;
    
    // Update state
    state.currentQuestion = data.currentQuestion || '';
    state.currentAsker = data.currentAsker || '';
    state.isTurnToAsk = data.turnIndex === playerIndex;
    state.friendName = data.players[otherIndex];
    
    // Get player data
    const myData = data.playersData[state.username] || { answer: '', hasAnswered: false };
    const friendData = data.playersData[data.players[otherIndex]] || { answer: '', hasAnswered: false };
    
    state.myAnswer = myData.answer;
    state.friendAnswer = friendData.answer;
    state.iHaveAnswered = myData.hasAnswered;
    state.friendHasAnswered = friendData.hasAnswered;
    
    return true;
  } catch (error) {
    console.error('Error loading game state:', error);
    return false;
  }
}

// Update game UI based on state
function updateGameUI() {
  // Update question section
  if (state.currentQuestion) {
    currentQuestion.textContent = state.currentQuestion;
    askerDisplay.textContent = `Asked by: ${state.currentAsker}`;
    activeQuestion.style.display = 'block';
    
    // Show/hide answer button based on whether user has answered
    addAnswerBtn.style.display = state.iHaveAnswered ? 'none' : 'flex';
    
    // Update locked answer status
    if (state.friendHasAnswered && !state.iHaveAnswered) {
      lockedAnswer.textContent = "Friend has answered! Your turn to answer.";
    } else if (!state.friendHasAnswered && state.iHaveAnswered) {
      lockedAnswer.textContent = "Waiting for friend to answer...";
    } else if (!state.friendHasAnswered && !state.iHaveAnswered) {
      lockedAnswer.textContent = "Friend's answer will appear here";
    }
    
    // If both have answered, show answers
    if (state.iHaveAnswered && state.friendHasAnswered) {
      showAnswers();
    }
  } else {
    activeQuestion.style.display = 'none';
  }
  
  // Show question input if it's user's turn to ask
  questionInputSection.style.display = state.isTurnToAsk && !state.currentQuestion ? 'block' : 'none';
  
  // Update waiting message if no question is active
  if (!state.currentQuestion) {
    if (state.isTurnToAsk) {
      answerStatus.textContent = "It's your turn to ask a question";
    } else {
      answerStatus.textContent = "Waiting for your friend to ask a question...";
    }
  } else if (!state.iHaveAnswered || !state.friendHasAnswered) {
    answerStatus.textContent = "Answers are revealed when you both answer";
  }
}

function showAnswers() {
  // Hide the question card
  activeQuestion.style.display = 'none';
  
  // Populate the question in the answers section
  document.getElementById('review-question').textContent = state.currentQuestion;
  document.getElementById('review-asker').textContent = `${state.currentAsker}`;
  
  // Populate answer bubbles
  friendNameElement.textContent = state.friendName;
  friendAnswerElement.textContent = state.friendAnswer;
  yourNameElement.textContent = state.username;
  userAnswerElement.textContent = state.myAnswer;
  
  // Show answers section
  answersSection.style.display = 'block';
}

// Submit question
submitQuestionBtn.addEventListener('click', async () => {
  const question = questionInput.value.trim();
  if (!question) {
    alert('Please enter a question');
    return;
  }
  
  try {
    const response = await fetch(`/api/rooms/${state.roomCode}/question`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        asker: state.username
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to submit question');
    }
    
    state.currentQuestion = question;
    state.currentAsker = state.username;
    state.iHaveAnswered = false;
    state.friendHasAnswered = false;
    state.myAnswer = '';
    state.friendAnswer = '';
    
    questionInput.value = '';
    updateGameUI();
  } catch (error) {
    alert('Failed to submit question');
    console.error(error);
  }
});

// Open answer modal
addAnswerBtn.addEventListener('click', () => {
  answerModal.style.display = 'flex';
  answerInput.focus();
});

// Submit answer
submitAnswerBtn.addEventListener('click', async () => {
  const answer = answerInput.value.trim();
  if (!answer) {
    alert('Please enter your answer');
    return;
  }
  
  try {
    const response = await fetch(`/api/rooms/${state.roomCode}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        answer,
        username: state.username
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to submit answer');
    }
    
    state.myAnswer = answer;
    state.iHaveAnswered = true;
    
    answerInput.value = '';
    answerModal.style.display = 'none';
    updateGameUI();
  } catch (error) {
    alert('Failed to submit answer');
    console.error(error);
  }
});

// My turn button
myTurnBtn.addEventListener('click', async () => {
  try {
    const response = await fetch(`/api/rooms/${state.roomCode}/switch-turn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to switch turns');
    }
    
    state.isTurnToAsk = true;
    state.currentQuestion = '';
    state.currentAsker = '';
    state.myAnswer = '';
    state.friendAnswer = '';
    state.iHaveAnswered = false;
    state.friendHasAnswered = false;
    
    answersSection.style.display = 'none';
    updateGameUI();
  } catch (error) {
    console.error('Error switching turns:', error);
  }
});

// Their turn button
theirTurnBtn.addEventListener('click', async () => {
  try {
    const response = await fetch(`/api/rooms/${state.roomCode}/switch-turn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to switch turns');
    }
    
    state.isTurnToAsk = false;
    state.currentQuestion = '';
    state.currentAsker = '';
    state.myAnswer = '';
    state.friendAnswer = '';
    state.iHaveAnswered = false;
    state.friendHasAnswered = false;
    
    answersSection.style.display = 'none';
    updateGameUI();
  } catch (error) {
    console.error('Error switching turns:', error);
  }
});

// Close modal if clicked outside
window.addEventListener('click', (event) => {
  if (event.target === answerModal) {
    answerModal.style.display = 'none';
  }
});

// Make room codes uppercase
roomCodeInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase();
});

// Handle Enter key in forms
questionInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    submitQuestionBtn.click();
  }
});

answerInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitAnswerBtn.click();
  }
});
