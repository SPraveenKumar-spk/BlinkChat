const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "https://letsblinkchat.vercel.app", // Adjust this to your frontend URL
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const corsOptions = {
  origin: "https://letsblinkchat.vercel.app", // Replace with your client URL
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // Allowed HTTP methods
  allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
  credentials: true, // Allow cookies to be sent in cross-origin requests
};

// Use CORS with the specified options
app.use(cors(corsOptions));

let waitingQueue = [];
const activeConnections = {}; // Stores socket IDs mapped to rooms

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  // Check if the user is already connected to a chat
  if (activeConnections[socket.id]) {
    console.log("User already connected to a chat:", socket.id);
    socket.disconnect();
    return;
  }

  // Add user to waiting queue if not connected to a chat
  waitingQueue.push(socket);

  // Try to randomly pair users
  if (waitingQueue.length >= 2) {
    // Shuffle waitingQueue for random pairing
    waitingQueue = shuffleArray(waitingQueue);

    // Extract two users from the queue
    const [user1, user2] = waitingQueue.splice(0, 2);
    const chatRoom = `room-${user1.id}-${user2.id}`;

    // Join both users into the chat room
    user1.join(chatRoom);
    user2.join(chatRoom);

    // Save active connections
    activeConnections[user1.id] = chatRoom;
    activeConnections[user2.id] = chatRoom;

    // Notify both users they are connected to a chat
    io.to(chatRoom).emit("connectedToChat", chatRoom);
    console.log(`Users ${user1.id} and ${user2.id} connected in ${chatRoom}`);

    // Handle messages between the users
    user1.on("message", ({ room, text }) => {
      console.log(`Message from ${user1.id}: ${text}`);
      io.to(room).emit("message", { id: user1.id, text });
    });

    user2.on("message", ({ room, text }) => {
      console.log(`Message from ${user2.id}: ${text}`);
      io.to(room).emit("message", { id: user2.id, text });
    });
  }

  // Handle WebRTC offer, answer, and ICE candidates for users in a room
  socket.on("offer", (data) => {
    const room = activeConnections[socket.id]; // Get the user's room
    if (room) {
      console.log("Sending offer to the room", room);
      socket.to(room).emit("offer", data); // Send offer to the other user in the same room
    }
  });

  socket.on("answer", (data) => {
    const room = activeConnections[socket.id];
    if (room) {
      console.log("Sending answer to the room", room);
      socket.to(room).emit("answer", data); // Send answer to the other user in the same room
    }
  });

  socket.on("ice-candidate", (data) => {
    const room = activeConnections[socket.id]; // Get the user's room
    if (room) {
      console.log("Sending ICE candidate to the room", room);
      socket.to(room).emit("ice-candidate", data); // Send ICE candidate to the other user in the same room
    }
  });

  // Handle user disconnection
  // Handle user disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    const room = activeConnections[socket.id];

    // If the user was in a room, notify the other user and clean up
    if (room) {
      // Notify the other user in the room that the stranger has disconnected
      io.to(room).emit("message", {
        id: "system",
        text: "Stranger has been disconnected.",
      });

      // Emit 'peer-disconnected' to stop the remote video for the remaining user
      socket.to(room).emit("peer-disconnected");

      console.log(`Room ${room} will be cleared`);

      // Get both user IDs from the room
      const [user1Id, user2Id] = Object.keys(activeConnections).filter(
        (id) => activeConnections[id] === room
      );

      // Disconnect the other user if they're still connected
      const otherUserId = user1Id === socket.id ? user2Id : user1Id;
      const otherSocket = io.sockets.sockets.get(otherUserId);

      if (otherSocket) {
        otherSocket.leave(room); // Make the other user leave the room
        delete activeConnections[otherUserId]; // Remove the other user from active connections
      }

      // Remove both users from active connections
      delete activeConnections[user1Id];
      delete activeConnections[user2Id];
    }
  });
});

// Shuffle array to randomize user pairing
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
