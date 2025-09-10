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

exports.seenallmessage = async (req, res) => {
  const { fid, uid } = req.body;
  console.log(fid, uid);
  try {
    const UpdateQuery =
      "UPDATE `message` SET `status`='seen' WHERE `sender_id` = ? AND `reciver_id` = ?";
    db.query(UpdateQuery, [fid, uid], function (error, result) {
      if (error) {
        return console.log(error);
      }
      const SelectQuery =
        "SELECT `status` FROM `message` WHERE `sender_id` = ? AND `reciver_id` = ?";
      db.query(SelectQuery, [fid, uid], function (error, result) {
        if (error) {
          return console.log(error);
        }
        return res
          .status(200)
          .json({ status: 1, data: result[0], message: "Seen all message" });
      });
    });
  } catch (error) {
    return console.log(error);
  }
};

exports.fetchFriendData = (req, res) => {
  const { userEmail, lat, long } = req.body;

  if (!userEmail) {
    return res.status(400).json({ status: 0, message: "userEmail required" });
  }

  // Step 1: Get userId from email
  const getUserIdQuery = "SELECT id FROM user WHERE email = ? LIMIT 1";

  db.query(getUserIdQuery, [userEmail], function (err, userResult) {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ status: 0, message: "DB error" });
    }

    if (userResult.length === 0) {
      return res.status(404).json({ status: 0, message: "User not found" });
    }

    const userId = userResult[0].id;

    // Step 2: Friends + unread count
    const SelectQuery = `
      SELECT 
        u.id, u.name, u.email, u.image, u.location, u.lat, u.long, u.last_login,
        ST_Distance_Sphere(point(u.\`long\`, u.\`lat\`), point(?, ?)) / 1000 AS distance_km,
        (
          SELECT COUNT(*) 
          FROM message m 
          WHERE m.sender_id = u.id 
            AND m.reciver_id = ? 
            AND m.status = 'sent'
        ) AS unread_count
      FROM user u
      WHERE u.email != ?
      ORDER BY distance_km ASC;
    `;

    db.query(
      SelectQuery,
      [long, lat, userId, userEmail],
      function (error, result) {
        if (error) {
          console.error("DB Error:", error);
          return res.status(500).json({ status: 0, message: "DB error" });
        }
        res.status(200).json({ status: 1, data: result });
      }
    );
  });
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
    console.log(sender_id, reciver_id, message, status);
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
        "sent",
      ],
      (err, result) => {
        if (err) {
          console.error("Database Error:", err);
          return res.status(500).json({ status: 0, error: "Database error" });
        }

        const userSql = `
          SELECT id, name 
          FROM user 
          WHERE id IN (?, ?)
        `;
        db.query(userSql, [sender_id, reciver_id], (err, users) => {
          if (err) {
            console.error("User fetch error:", err);
            return res
              .status(500)
              .json({ status: 0, error: "User fetch error" });
          }

          const sender = users.find((u) => u.id == sender_id);
          const receiver = users.find((u) => u.id == reciver_id);

          res.status(200).json({
            status: 1,
            message: message,
            sender_id,
            reciver_id,
            sender,
            receiver,
            data: result.insertId,
          });
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
        res
          .status(200)
          .json({ status: 1, message: "Message deleted successfully." });
      });
    } catch (error) {
      return console.log(error);
    }
  } else {
    try {
      const filePath = path.join(__dirname, "..", file_url);

      fs.unlink(filePath, (err) => {
        if (err) {
          console.log("Error deleting file:", err);
          return res
            .status(500)
            .json({ status: 0, message: "Error deleting the file." });
        }

        const deleteQuery = "DELETE FROM `message` WHERE `id` = ?";
        db.query(deleteQuery, [id], function (error, result) {
          if (error) {
            console.log(error);
            return res.status(500).json({
              status: 0,
              message: "Error deleting message from database.",
            });
          }

          res.status(200).json({
            status: 1,
            message: "Message and associated file deleted successfully.",
          });
        });
      });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ status: 0, message: "Error processing request." });
    }
  }
};
