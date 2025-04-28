const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const port = 3001;
const server = http.createServer(app);
app.use(cors());
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Length", "X-Content-Type-Options"],
    credentials: true,
  })
);

app.use(express.static(path.join(__dirname, "client", "build")));
app.use(
  "/profile",
  express.static(path.join(__dirname, "profile"), {
    setHeaders: (res, path) => {
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

app.use(
  "/uploads",
  express.static(path.join(__dirname, "Uploads"), {
    setHeaders: (res, path) => {
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    },
  })
);

app.use(helmet());
app.use(bodyParser.json());
app.use("/profile", express.static(path.join(__dirname, "profile")));

const onlineUsers = new Map();
const peerToSocketMap = new Map();

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.emit("socketId", socket.id);

  socket.on("userOnline", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("updateOnlineUsers", Array.from(onlineUsers.keys()));
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
    io.to(data.userToCall).emit("callIncoming", {
      signal: data.signalData,
      from: data.from,
    });
  });

  socket.on("answerCall", (data) => {
    io.to(data.to).emit("callAccepted", data.signal);
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

const loginRoutes = require("./routes/login");
const chatRoutes = require("./routes/chat");
app.use("/api", loginRoutes);
app.use("/api", chatRoutes);


server.listen(port, () => console.log(`Server running on port ${port}`));