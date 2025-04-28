const db = require("../db");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

exports.fetchuserdata = (req, res) => {
  const { userEmail } = req.body;

  const SelectQuery = "SELECT * FROM `user` WHERE `email` = ?";

  db.query(SelectQuery, [userEmail], function (error, result) {
    if (error) {
      return console.log(error);
    }
    res.status(200).json({ status: 1, data: result });
  });
};

exports.fetchFriendData = (req, res) => {
  const { userEmail, lat, long } = req.body;
  const SelectQuery =
    "SELECT `id`, `name`, `email`, `image`, `location`, `lat`, `long`, `last_login`, ST_Distance_Sphere( point(`long`, `lat`), point(76.3484463, 32.1930719)) / 1000 AS distance_km FROM `user` WHERE `email` != ? ORDER BY distance_km ASC;";

  db.query(
    SelectQuery,
    [userEmail, lat, long, userEmail],
    function (error, result) {
      if (error) {
        return console.log(error);
      }
      res.status(200).json({ status: 1, data: result });
    }
  );
};

exports.updatelocation = (req, res) => {
  const { userEmail, lat, lon, addressParts } = req.body;
  const SelectQuery =
    "UPDATE `user` SET `location`= ?,`lat`= ?,`long`= ? WHERE `email` = ?";

  db.query(
    SelectQuery,
    [addressParts, lat, lon, userEmail],
    function (error, result) {
      if (error) {
        return console.log(error);
      }
      res.status(200).json({ status: 1, data: result });
    }
  );
};

exports.savePeerid = (req, res) => {
  const { value, userEmail } = req.body;
  const SelectQuery = "UPDATE `user` SET `peer_ID`= ? WHERE `email` = ?";

  db.query(SelectQuery, [value, userEmail], function (error, result) {
    if (error) {
      return console.log(error);
    }
    res.status(200).json({ status: 1, data: result });
  });
};

exports.getfriendchat = (req, res) => {
  const { id } = req.body;
  const SelectQuery = "SELECT * FROM `user` WHERE `id` = ?";

  db.query(SelectQuery, [id], function (error, result) {
    if (error) {
      return console.log(error);
    }
    res.status(200).json({ data: result[0] });
  });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { sender_id, reciver_id } = req.body;

    if (!sender_id || !reciver_id) {
      return cb(new Error("Sender or receiver ID is missing"), null);
    }

    let folderPath = `uploads/messages/${sender_id}/${reciver_id}`;

    // Create folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    cb(null, folderPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});

const upload = multer({ storage });

exports.sendMessage = (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      console.error("Multer Error:", err);
      return res.status(400).json({ status: 0, error: "File upload failed" });
    }

    const { sender_id, reciver_id, message, status } = req.body;
    let file_url = req.file ? req.file.path.replace(/\\/g, "/") : null;
    let file_type = req.file ? req.file.mimetype : "text"; // Fix: Extract MIME type

    if (!sender_id || !reciver_id) {
      return res
        .status(400)
        .json({ status: 0, error: "Sender or receiver ID is missing" });
    }

    if (!message && !file_url) {
      return res
        .status(400)
        .json({ status: 0, error: "Message or file is required" });
    }

    // Save to database
    const sql = `INSERT INTO message (sender_id, reciver_id, message, file_url, file_type, time, status) 
                 VALUES (?, ?, ?, ?, ?, NOW(), ?)`;

    db.query(
      sql,
      [
        sender_id,
        reciver_id,
        message || "",
        file_url || "",
        file_type || "",
        status || "sent",
      ],
      (err, result) => {
        if (err) {
          console.error("Database Error:", err);
          return res.status(500).json({ status: 0, error: "Database error" });
        }

        res.status(200).json({
          status: 1,
          message: "Message sent successfully",
          sender_id,
          reciver_id,
          data: result.insertId,
        });
      }
    );
  });
};

exports.getUserChat = (req, res) => {
  const { sender_id, reciver_id } = req.body;

  const SelectQuery = `
    SELECT * FROM message 
    WHERE 
      (sender_id = ? AND reciver_id = ?) 
      OR 
      (sender_id = ? AND reciver_id = ?) 
    ORDER BY time ASC
  `;

  db.query(
    SelectQuery,
    [sender_id, reciver_id, reciver_id, sender_id],
    function (error, result) {
      if (error) {
        console.error("Database Error:", error);
        return res.status(500).json({ status: 0, error: "Database error" });
      }
      res.status(200).json({ status: 1, data: result });
    }
  );
};

exports.handledeleteMessage = (req, res) => {
  const { id, type, file_url } = req.body;

  console.log(type);

  if (type === "text") {
    try {
      const deleteQuery = "DELETE FROM `message` WHERE `id` = ?";
      db.query(deleteQuery, [id], function (error, result) {
        if (error) {
          return console.log(error);
        }
        res.status(200).json({ status: 1, message: "Message deleted successfully." });
      });
    } catch (error) {
      return console.log(error);
    }
  } else {
    try {

      const filePath = path.join(__dirname, "..", file_url);

      fs.unlink(filePath, (err) => {
        if (err) {
          console.log('Error deleting file:', err);
          return res.status(500).json({ status: 0, message: "Error deleting the file." });
        }

        const deleteQuery = "DELETE FROM `message` WHERE `id` = ?";
        db.query(deleteQuery, [id], function (error, result) {
          if (error) {
            console.log(error);
            return res.status(500).json({ status: 0, message: "Error deleting message from database." });
          }

          res.status(200).json({ status: 1, message: "Message and associated file deleted successfully." });
        });
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ status: 0, message: "Error processing request." });
    }
  }
};
