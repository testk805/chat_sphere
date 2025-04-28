const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3001;
const server = http.createServer(app);

// CORS configuration for Vercel frontend
app.use(
  cors({
    origin: ["https://chat-sphere-liart.vercel.app", "http://localhost:3000"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Serve profile images
app.use(
  "/profile",
  express.static(path.join(__dirname, "profile"), {
    setHeaders: (res) => {
      res.set({
        "Access-Control-Allow-Origin": "https://chat-sphere-liart.vercel.app",
        "Cross-Origin-Resource-Policy": "cross-origin",
      });
    },
  })
);

// Serve uploaded files
app.use(
  "/uploads",
  express.static(path.join(__dirname, "Uploads"), {
    setHeaders: (res) => {
      res.set({
        "Access-Control-Allow-Origin": "https://chat-sphere-liart.vercel.app",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      });
    },
  })
);

app.use(helmet());
app.use(bodyParser.json());

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: "https://chat-sphere-liart.vercel.app",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

const onlineUsers = new Map();
const peerToSocketMap = new Map();

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.emit("socketId", socket.id);

  socket.on("userOnline", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("updateOnlineUsers", Array.from(onlineUsers.keys()));
    console.log(`User ${userId} is online, socket ID: ${socket.id}`);
  });

  socket.on("setPeerId", (peerId) => {
    peerToSocketMap.set(peerId, socket.id);
    console.log("Mapped peer ID:", peerId, "to socket ID:", socket.id);
  });

  socket.on("sendMessage", (message) => {
    io.emit("newMessage", message);
    io.emit("refreshData", {
      senderId: message.senderId,
      receiverId: message.receiverId,
    });
  });

  socket.on("typing", ({ senderId, receiverId }) => {
    io.emit("typing", { senderId, receiverId });
  });

  socket.on("stopTyping", ({ senderId, receiverId }) => {
    io.emit("stopTyping", { senderId, receiverId });
  });

  socket.on("callUser", (data) => {
    console.log(`Call initiated from ${data.from} to ${data.userToCall}`);
    const socketId = peerToSocketMap.get(data.userToCall);
    if (socketId) {
      io.to(socketId).emit("callIncoming", {
        signal: data.signalData,
        from: data.from,
      });
      console.log(`Emitted callIncoming to socket ID: ${socketId}`);
    } else {
      console.log(`No socket found for peer ID: ${data.userToCall}`);
    }
  });

  socket.on("answerCall", (data) => {
    console.log(`Call answered, sending to ${data.to}`);
    const socketId = peerToSocketMap.get(data.to);
    if (socketId) {
      io.to(socketId).emit("callAccepted", data.signal);
      console.log(`Emitted callAccepted to socket ID: ${socketId}`);
    } else {
      console.log(`No socket found for peer ID: ${data.to}`);
    }
  });

  socket.on("rejectCall", (data) => {
    const socketId = peerToSocketMap.get(data.to);
    console.log("Received rejectCall for peer ID:", data.to, "mapped to socket ID:", socketId);
    if (socketId) {
      io.to(socketId).emit("callRejected");
      console.log("Emitted callRejected to:", socketId);
    } else {
      console.log("No socket found for peer ID:", data.to);
    }
  });

  socket.on("cancelCall", (data) => {
    const socketId = peerToSocketMap.get(data.to);
    console.log("Received cancelCall for peer ID:", data.to, "mapped to socket ID:", socketId);
    if (socketId) {
      io.to(socketId).emit("callCancelled");
      console.log("Emitted callCancelled to:", socketId);
    } else {
      console.log("No socket found for peer ID:", data.to);
    }
  });

  socket.on("endCall", (data) => {
    const socketId = peerToSocketMap.get(data.to);
    console.log("Received endCall for peer ID:", data.to, "mapped to socket ID:", socketId);
    if (socketId) {
      io.to(socketId).emit("endCall");
      console.log("Emitted endCall to:", socketId);
    } else {
      console.log("No socket found for peer ID:", data.to);
    }
  });

  socket.on("disconnect", () => {
    let disconnectedUserId = [...onlineUsers.entries()].find(
      ([_, sid]) => sid === socket.id
    )?.[0];

    if (disconnectedUserId) {
      onlineUsers.delete(disconnectedUserId);
    }

    for (let [peerId, socketId] of peerToSocketMap.entries()) {
      if (socketId === socket.id) {
        peerToSocketMap.delete(peerId);
      }
    }

    io.emit("updateOnlineUsers", Array.from(onlineUsers.keys()));
    console.log("Client disconnected:", socket.id);
  });
});

// Routes
const loginRoutes = require("./routes/login");
const chatRoutes = require("./routes/chat");
app.use("/api", loginRoutes);
app.use("/api", chatRoutes);

// Debug endpoint to list files
app.get("/api/list-files", (req, res) => {
  const uploadPath = path.join(__dirname, "Uploads");
  fs.readdir(uploadPath, { recursive: true }, (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Failed to list files", details: err.message });
    }
    res.json({ files });
  });
});

// Root route
app.get("/", (req, res) => {
  res.send("🎉 ChatSphere backend is live!");
});

server.listen(port, () => console.log(`Server running on port ${port}`));
