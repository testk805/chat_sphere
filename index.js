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
    origin: "*", // Allow all domains (change this for production security)
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // Allow cookies/auth headers
  },
});

// 🛠 CORS FIX
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
// 🛠 Serve Images Properly
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

const multer = require("multer");
const sharp = require("sharp");
const fac = require("fast-average-color-node");

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"), false);
    }
  },
});

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No file uploaded or invalid format" });
    }

    let { buffer } = req.file;

    // **Step 1: Get Image Metadata**
    let metadata = await sharp(buffer).metadata();
    console.log("Image Metadata:", metadata);

    // **Step 2: Extract Colors from Borders (Fixed Integer Issue)**
    const sampleSize = 10; // Border thickness for sampling
    const left = await sharp(buffer)
      .extract({
        left: 0,
        top: Math.floor(metadata.height / 2), // 🔥 Fixed: Ensuring integer values
        width: sampleSize,
        height: sampleSize,
      })
      .toBuffer();

    const right = await sharp(buffer)
      .extract({
        left: Math.floor(metadata.width - sampleSize), // 🔥 Fixed
        top: Math.floor(metadata.height / 2), // 🔥 Fixed
        width: sampleSize,
        height: sampleSize,
      })
      .toBuffer();

    const leftColor = await fac.getAverageColor(left);
    const rightColor = await fac.getAverageColor(right);

    // **Step 3: Take the Average of Left & Right Border Colors**
    const bgColor = {
      r: Math.round((leftColor.value[0] + rightColor.value[0]) / 2),
      g: Math.round((leftColor.value[1] + rightColor.value[1]) / 2),
      b: Math.round((leftColor.value[2] + rightColor.value[2]) / 2),
      alpha: 1,
    };
    console.log("Detected Background Color:", bgColor);

    // **Step 4: Resize Without Cropping**
    const maxSize = 600;
    const { width, height } = metadata;
    let newWidth, newHeight;

    if (width > height) {
      newWidth = maxSize;
      newHeight = Math.round((height / width) * maxSize);
    } else {
      newHeight = maxSize;
      newWidth = Math.round((width / height) * maxSize);
    }

    const resizedImage = await sharp(buffer)
      .resize(newWidth, newHeight)
      .toBuffer();

    // **Step 5: Create 600x600 Canvas with Auto Background Color**
    const finalImage = await sharp({
      create: {
        width: maxSize,
        height: maxSize,
        channels: 3,
        background: bgColor, // Auto Background from Image Borders
      },
    })
      .composite([{ input: resizedImage, gravity: "center" }])
      .toFormat("png")
      .toBuffer();

    res.set("Content-Type", "image/png");
    res.send(finalImage);
  } catch (error) {
    console.error("Image processing error:", error);
    res.status(500).json({ error: "Image processing failed" });
  }
});



// Start Server
server.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
