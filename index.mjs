import cors from 'cors';
import express from 'express';
import { createServer } from 'http'; // Import the HTTP module
import { Server } from 'socket.io'; // Import socket.io
import router from './router.mjs';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create an HTTP server and hook the Express app to it
const httpServer = createServer(app);

// Initialize socket.io instance
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Be sure to restrict the origin in production
    methods: ["GET", "POST"]
  }
});

// WebSocket connection handler
io.on('connection', (socket) => {
  console.log('A user connected with id:', socket.id);

  // Example: Listen for a custom event
  socket.on('my event', (data) => {
    console.log(data);
    // You can emit back to the client, broadcast, etc.
    io.emit('my response', { message: 'Hello to all connected clients!' });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User ${socket.id} disconnected`);
  });
});

app.use(cors());
app.use(router);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/assets/index.html'));
});

const PORT = process.env.PORT || 8888;
// Use httpServer.listen instead of app.listen
httpServer.listen(PORT, () => {
  console.log(`Upload service running on port ${PORT}`);
});
