const express = require('express');
const path = require('path');
const http = require('http');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';

const users = [];
const requests = [];
const chatMessages = [];

const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change_this_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);
app.use(express.static(path.join(__dirname, 'public')));

function getUserFromSession(req) {
  if (!req.session || !req.session.userId) {
    return null;
  }
  return users.find((user) => user.id === req.session.userId) || null;
}

async function sendNotificationEmail(request) {
  const subject = `New middleman request from ${request.name}`;
  const text = `A new middleman request was submitted:\n\nName: ${request.name}\nEmail: ${request.email}\nFrom: ${request.from}\nTo: ${request.to}\nAmount: ${request.amount} ${request.currency}\nDetails: ${request.details || 'None'}\nSubmitted: ${request.createdAt}\n`;

  if (!transporter) {
    console.log('Email notification skipped: SMTP not configured.');
    console.log(text);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.ADMIN_EMAIL || ADMIN_EMAIL,
    subject,
    text,
  });
}

app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
  }

  if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ success: false, message: 'A user with that email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: `${Date.now()}`,
    name,
    email,
    passwordHash,
  };

  users.push(user);
  req.session.userId = user.id;

  res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const user = users.find((item) => item.email.toLowerCase() === email.toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  req.session.userId = user.id;
  res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  } else {
    res.json({ success: true });
  }
});

app.get('/api/current-user', (req, res) => {
  const user = getUserFromSession(req);
  if (!user) {
    return res.json({ success: true, user: null });
  }
  res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/request-middleman', async (req, res) => {
  const user = getUserFromSession(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'You must be logged in to submit a request.' });
  }

  const { from, to, amount, currency, details } = req.body;
  if (!from || !to || !amount || !currency) {
    return res.status(400).json({ success: false, message: 'Please complete all required fields.' });
  }

  const request = {
    id: `${Date.now()}`,
    createdAt: new Date().toISOString(),
    userId: user.id,
    name: user.name,
    email: user.email,
    from,
    to,
    amount,
    currency,
    details: details || '',
  };

  requests.push(request);

  try {
    await sendNotificationEmail(request);
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }

  return res.json({
    success: true,
    message: 'Your middleman request has been submitted. A member of our team will follow up shortly.',
    request,
  });
});

app.get('/api/requests', (req, res) => {
  return res.json({ success: true, requests });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  socket.emit('chat:init', chatMessages.slice(-50));

  socket.on('chat:message', (payload) => {
    if (!payload || !payload.name || !payload.message) {
      return;
    }

    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      name: payload.name,
      message: payload.message,
    };

    chatMessages.push(message);
    if (chatMessages.length > 200) {
      chatMessages.shift();
    }

    io.emit('chat:newMessage', message);
  });
});

server.listen(PORT, () => {
  console.log(`MiddlemanSafePlace.com running at http://localhost:${PORT}`);
});
