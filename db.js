const mysql = require("mysql2");

let db;

function handleDisconnect() {
  db = mysql.createConnection({
    host: "bn4a7py0a8uurhaxofah-mysql.services.clever-cloud.com",
    user: "ujeqfubo3vwlaios",
    password: "QwWhQ3tysjHhbC9mn01k",
    database: "bn4a7py0a8uurhaxofah",
  });

  // db = mysql.createConnection({
  //   host: "localhost",
  //   user: "root",github
  //   password: "",
  //   database: "chat_sphere",
  // });

  db.connect((err) => {
    if (err) {
      console.error("Error connecting to DB, retrying in 5s:", err);
      setTimeout(handleDisconnect, 5000); // Retry after 5s
    } else {
      console.log("✅ MySQL Connected!");
    }
  });

  db.on("error", (err) => {
    console.error("MySQL error:", err);
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      console.log("🔁 Reconnecting to DB...");
      handleDisconnect();
    } else {
      throw err;
    }
  });
}

handleDisconnect();

module.exports = db;
