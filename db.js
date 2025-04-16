var mysql = require("mysql2");

var db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "chat_sphere",
});

db.connect(function (error) {
  if (error) {
    console.log("Error connecting to database: ", error);
    process.exit(1);
  }
  console.log("Connected to the database!");
});

module.exports = db;
