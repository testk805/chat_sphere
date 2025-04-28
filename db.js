var mysql = require("mysql2");

var db = mysql.createConnection({
  host: "bn4a7py0a8uurhaxofah-mysql.services.clever-cloud.com",
  user: "ujeqfubo3vwlaios",
  password: "QwWhQ3tysjHhbC9mn01k",
  database: "bn4a7py0a8uurhaxofah",
});

db.connect(function (error) {
  if (error) {
    console.log("Error connecting to database: ", error);
    process.exit(1);
  }
  console.log("Connected to the database!");
});

// Make sure to reconnect if connection is closed
db.on("error", (err) => {
  console.log("Database connection lost. Attempting to reconnect...", err);
  if (err.code === "PROTOCOL_CONNECTION_LOST") {
    db.connect();
  } else {
    console.error("Unexpected database error:", err);
  }
});

module.exports = db;
