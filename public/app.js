const authCard = document.getElementById('auth-card');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showLoginBtn = document.getElementById('show-login-btn');
const showSignupBtn = document.getElementById('show-signup-btn');
const authMessageNode = document.getElementById('auth-message');
const userCard = document.getElementById('user-card');
const userNameNode = document.getElementById('user-name');
const logoutButton = document.getElementById('logout-button');
const requestCard = document.getElementById('request-card');
const requestForm = document.getElementById('middleman-request-form');
const requestMessageNode = document.getElementById('form-message');
const chatCard = document.getElementById('chat-card');
const chatWindow = document.getElementById('chat-window');
const chatForm = document.getElementById('chat-form');
const chatStatus = document.getElementById('chat-status');
const chatMessage = document.getElementById('chat-message');

const socket = io();

function showElement(element) {
  element.classList.remove('hidden');
}

function hideElement(element) {
  element.classList.add('hidden');
}

function setActiveToggle(loginActive) {
  if (loginActive) {
    showLoginBtn.classList.add('active');
    showSignupBtn.classList.remove('active');
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
  } else {
    showLoginBtn.classList.remove('active');
    showSignupBtn.classList.add('active');
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
  }
}

function renderChatMessage(message) {
  const item = document.createElement('div');
  item.className = 'chat-entry';
  item.innerHTML = `<span class="chat-author">${message.name}</span><span class="chat-time">${new Date(message.createdAt).toLocaleTimeString()}</span><p>${message.message}</p>`;
  chatWindow.appendChild(item);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

socket.on('connect', () => {
  chatStatus.textContent = 'Live chat connected.';
  chatStatus.className = 'message success';
});

socket.on('disconnect', () => {
  chatStatus.textContent = 'Live chat disconnected. Reconnecting...';
  chatStatus.className = 'message error';
});

socket.on('chat:init', (messages) => {
  chatWindow.innerHTML = '';
  messages.forEach(renderChatMessage);
});

socket.on('chat:newMessage', (message) => {
  renderChatMessage(message);
});

function updateUI(user) {
  if (user) {
    userNameNode.textContent = user.name;
    showElement(userCard);
    showElement(requestCard);
    showElement(chatCard);
    hideElement(authCard);
    authMessageNode.textContent = '';
    requestMessageNode.textContent = '';
  } else {
    hideElement(userCard);
    hideElement(requestCard);
    hideElement(chatCard);
    showElement(authCard);
    requestForm.reset();
    chatWindow.innerHTML = '';
    setActiveToggle(true);
  }
}

async function fetchCurrentUser() {
  try {
    const response = await fetch('/api/current-user');
    const result = await response.json();
    updateUI(result.user || null);
  } catch (error) {
    console.error('Failed to check current user', error);
    updateUI(null);
  }
}

showLoginBtn.addEventListener('click', () => setActiveToggle(true));
showSignupBtn.addEventListener('click', () => setActiveToggle(false));

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  authMessageNode.textContent = '';
  authMessageNode.className = 'message';

  const formData = new FormData(loginForm);
  const payload = {
    email: formData.get('email'),
    password: formData.get('password'),
  };

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Unable to log in.');
    }
    updateUI(result.user);
  } catch (error) {
    authMessageNode.textContent = error.message;
    authMessageNode.classList.add('error');
  }
});

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  authMessageNode.textContent = '';
  authMessageNode.className = 'message';

  const formData = new FormData(signupForm);
  const payload = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  };

  try {
    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Unable to create account.');
    }
    updateUI(result.user);
  } catch (error) {
    authMessageNode.textContent = error.message;
    authMessageNode.classList.add('error');
  }
});

logoutButton.addEventListener('click', async () => {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch (error) {
    console.error('Logout failed', error);
  }
  updateUI(null);
});

requestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  requestMessageNode.textContent = '';
  requestMessageNode.className = 'message';

  const formData = new FormData(requestForm);
  const payload = {
    from: formData.get('from'),
    to: formData.get('to'),
    amount: formData.get('amount'),
    currency: formData.get('currency'),
    details: formData.get('details'),
  };

  try {
    const response = await fetch('/api/request-middleman', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Unable to submit request.');
    }

    requestMessageNode.textContent = result.message;
    requestMessageNode.classList.add('success');
    requestForm.reset();
  } catch (error) {
    requestMessageNode.textContent = error.message;
    requestMessageNode.classList.add('error');
  }
});

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  chatStatus.textContent = '';
  chatStatus.className = 'message';

  const message = chatMessage.value.trim();
  const name = userNameNode.textContent || 'Guest';

  if (!message) {
    chatStatus.textContent = 'Please enter a message.';
    chatStatus.classList.add('error');
    return;
  }

  socket.emit('chat:message', { name, message });
  chatMessage.value = '';
});

fetchCurrentUser();
