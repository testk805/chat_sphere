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
    origin:const express = require("express");
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
    origin: ["https://chat-sphere-liart.vercel.app", "http://localhost:3000"], // Allow all domains (change this for production security)
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // Allow cookies/auth headers
  },
});

// 🛠 CORS FIX
app.use(
  cors({
    origin: ["https://chat-sphere-liart.vercel.app", "http://localhost:3000"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Length", "X-Content-Type-Options"],
    credentials: true,
  })
);

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
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res, path) => {
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
      res.set("Access-Control-Allow-Origin", ["https://chat-sphere-liart.vercel.app", "http://localhost:3000"]); // Allow all origins
      res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    },
  })
);

app.use(helmet());
app.use(bodyParser.json());

app.use("/profile", express.static(path.join(__dirname, "profile")));

const onlineUsers = new Map();

io.on("connection", (socket) => {
  socket.on("userOnline", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("updateOnlineUsers", Array.from(onlineUsers.keys()));
  });
  socket.emit("socketId", socket.id);
  // 📩 Handle Messages
  socket.on("sendMessage", (message) => {
    io.emit("newMessage", message);
    io.emit("refreshData", {
      senderId: message.senderId,
      receiverId: message.receiverId,
    });
  });

  // ✍️ Handle Typing Status
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

  socket.on("disconnect", () => {
    let disconnectedUserId = [...onlineUsers.entries()].find(
      ([_, sid]) => sid === socket.id
    )?.[0];

    if (disconnectedUserId) {
      onlineUsers.delete(disconnectedUserId);
      io.emit("updateOnlineUsers", Array.from(onlineUsers.keys()));
    }
  });
});

// Routes
const loginRoutes = require("./routes/login");
const chatRoutes = require("./routes/chat");
app.use("/api", loginRoutes);
app.use("/api", chatRoutes);



app.get("/", (req, res) => {
  res.send("🎉 ChatSphere backend is live!");
});

// 🔊 Start Server
server.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});, // Allow all domains (change this for production security)
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // Allow cookies/auth headers
  },
});

// 🛠 CORS FIX
app.use(
  cors({
    origin: ["https://chat-sphere-liart.vercel.app", "http://localhost:3000"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Length", "X-Content-Type-Options"],
    credentials: true,
  })
);

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
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res, path) => {
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
      res.set("Access-Control-Allow-Origin", "*"); // Allow all origins
      res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    },
  })
);

app.use(helmet());
app.use(bodyParser.json());

app.use("/profile", express.static(path.join(__dirname, "profile")));

const onlineUsers = new Map();

io.on("connection", (socket) => {
  socket.on("userOnline", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("updateOnlineUsers", Array.from(onlineUsers.keys()));
  });
  socket.emit("socketId", socket.id);
  // 📩 Handle Messages
  socket.on("sendMessage", (message) => {
    io.emit("newMessage", message);
    io.emit("refreshData", {
      senderId: message.senderId,
      receiverId: message.receiverId,
    });
  });

  // ✍️ Handle Typing Status
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

  socket.on("disconnect", () => {
    let disconnectedUserId = [...onlineUsers.entries()].find(
      ([_, sid]) => sid === socket.id
    )?.[0];

    if (disconnectedUserId) {
      onlineUsers.delete(disconnectedUserId);
      io.emit("updateOnlineUsers", Array.from(onlineUsers.keys()));
    }
  });
});

// Routes
const loginRoutes = require("./routes/login");
const chatRoutes = require("./routes/chat");
app.use("/api", loginRoutes);
app.use("/api", chatRoutes);



app.get("/", (req, res) => {
  res.send("🎉 ChatSphere backend is live!");
});

// 🔊 Start Server
server.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
