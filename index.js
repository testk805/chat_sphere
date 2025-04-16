const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const sharp = require("sharp");
const fac = require("fast-average-color-node");

const app = express();
const port = process.env.PORT || 3001;
const server = http.createServer(app);

// 🔒 Middleware
app.use(cors({
  origin: "*", // Change for production
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
app.use(helmet());
app.use(bodyParser.json());

// 🖼️ Serve static files
app.use(express.static(path.join(__dirname, "client", "build")));

app.use("/profile", express.static(path.join(__dirname, "profile"), {
  setHeaders: (res) => {
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
  },
}));

app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  setHeaders: (res) => {
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  },
}));

// 💬 Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

const onlineUsers = new Map();

io.on("connection", (socket) => {
  socket.emit("socketId", socket.id);

  socket.on("userOnline", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("updateOnlineUsers", Array.from(onlineUsers.keys()));
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

  socket.on("disconnect", () => {
    let disconnectedUserId = [...onlineUsers.entries()].find(([_, sid]) => sid === socket.id)?.[0];
    if (disconnectedUserId) {
      onlineUsers.delete(disconnectedUserId);
      io.emit("updateOnlineUsers", Array.from(onlineUsers.keys()));
    }
  });
});

// 🔐 API Routes
const loginRoutes = require("./routes/login");
const chatRoutes = require("./routes/chat");
app.use("/api", loginRoutes);
app.use("/api", chatRoutes);

// 🎨 Upload & Auto-Background Processing
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded or invalid format" });

    const { buffer } = req.file;
    const metadata = await sharp(buffer).metadata();

    const sampleSize = 10;
    const left = await sharp(buffer).extract({
      left: 0,
      top: Math.floor(metadata.height / 2),
      width: sampleSize,
      height: sampleSize,
    }).toBuffer();

    const right = await sharp(buffer).extract({
      left: Math.floor(metadata.width - sampleSize),
      top: Math.floor(metadata.height / 2),
      width: sampleSize,
      height: sampleSize,
    }).toBuffer();

    const leftColor = await fac.getAverageColor(left);
    const rightColor = await fac.getAverageColor(right);

    const bgColor = {
      r: Math.round((leftColor.value[0] + rightColor.value[0]) / 2),
      g: Math.round((leftColor.value[1] + rightColor.value[1]) / 2),
      b: Math.round((leftColor.value[2] + rightColor.value[2]) / 2),
      alpha: 1,
    };

    const maxSize = 600;
    const { width, height } = metadata;
    const newWidth = width > height ? maxSize : Math.round((width / height) * maxSize);
    const newHeight = width > height ? Math.round((height / width) * maxSize) : maxSize;

    const resized = await sharp(buffer).resize(newWidth, newHeight).toBuffer();

    const finalImage = await sharp({
      create: {
        width: maxSize,
        height: maxSize,
        channels: 3,
        background: bgColor,
      },
    }).composite([{ input: resized, gravity: "center" }]).toFormat("png").toBuffer();

    res.set("Content-Type", "image/png").send(finalImage);
  } catch (error) {
    console.error("Image processing error:", error);
    res.status(500).json({ error: "Image processing failed" });
  }
});

// 🔁 Root Route (Fix 404)
app.get("/", (req, res) => {
  res.send("🎉 ChatSphere backend is live!");
});

// 🔊 Start Server
server.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
