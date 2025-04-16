const db = require("../db");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "testk805@gmail.com",
    pass: "hqkuxxhgfyeipuxv",
  },
});

exports.create = (req, res) => {
  const { name, email, pass, city, lat, long, otp } = req.body;

  const slectQuery = "SELECT * FROM `user` WHERE `email` = ? AND `status` = ''";

  db.query(slectQuery, [email], function (error, result) {
    if (error) {
      return console.log(error);
    }
    if (result) {
      const insertQuery =
        "UPDATE `user` SET `name`=?,`password`= ?,`location`=?,`lat`=?,`long`=?,`status`=?,`last_login`= Now() WHERE email = ?";
      db.query(
        insertQuery,
        [name, pass, city, lat, long, "verify", email],
        function (error, result) {
          if (error) {
            return console.log(error);
          }
          return res
            .status(200)
            .json({ status: 1, message: "Account Created Sucessfully" });
        }
      );
    } else {
      return res
        .status(200)
        .json({ status: 2, message: "Email Already Exists" });
    }
  });
};

exports.google = async (req, res) => {
  const { name, image, email, city, lat, long } = req.body;

  const profileDir = path.join(__dirname, "../profile");

  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  const imageResponse = await axios.get(image, { responseType: "arraybuffer" });
  const imageExtension = path.extname(new URL(image).pathname) || ".jpg"; // Default to .jpg
  const imageName = `${email.replace(/[^a-zA-Z0-9]/g, "_")}${imageExtension}`;
  const imagePath = path.join(profileDir, imageName);

  fs.writeFileSync(imagePath, imageResponse.data);

  const mainimg = `/profile/${imageName}`;

  const slectQuery = "SELECT * FROM `user` WHERE `email` = ?";

  db.query(slectQuery, [email], function (error, result) {
    if (error) {
      return console.log(error);
    }
    if (result.length === 0) {
      const insertQuery =
        "INSERT INTO `user`(`name`,`image`, `email`,`location`,`lat`,`long`,`status`) VALUES (?,?,?,?,?,?,?)";
      db.query(
        insertQuery,
        [name, mainimg, email, city, lat, long, "verify"],
        function (error, result) {
          if (error) {
            return console.log(error);
          }
          return res
            .status(200)
            .json({ status: 1, message: "Login Successfully." });
        }
      );
    } else {
      const insertQuery =
        "UPDATE `user` SET `image`= ?,`location`= ?,`lat`= ?,`long`= ? ,`last_login`=Now() WHERE `email` = ?";
      db.query(
        insertQuery,
        [mainimg, city, lat, long, email],
        function (error, result) {
          if (error) {
            return console.log(error);
          }
          return res
            .status(200)
            .json({ status: 1, message: "Login Successfully." });
        }
      );
    }
  });
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000);

exports.loginwithotp = async (req, res) => {
  const { user_email } = req.body;

  const otp = generateOTP();

  // Email options
  const mailOptions = {
    from: "testk805@gmail.com",
    to: user_email,
    subject: "Your OTP Code",
    text: `Dear ${user_email},

Your One-Time Password (OTP) for login to Chat Sphere is:

📌 ${otp}

This OTP is valid for 5 minutes. Please do not share this code with anyone. If you did not request this, please ignore this email.
For any assistance, feel free to contact our support team.

Best regards,
Chat Sphere Team
📧 support@chatsphere.com | 🌐  http://localhost:3001/`,
  };

  try {
    // Check if user exists
    const selectQuery = "SELECT * FROM `user` WHERE `email` = ?";
    db.query(selectQuery, [user_email], (error, result) => {
      if (error) {
        console.error("Database Error:", error);
        return res
          .status(500)
          .json({ success: false, message: "Database error" });
      }

      if (result.length === 0) {
        return res.status(200).json({
          success: false,
          message: "⚠️ Account not found. Please sign up first.",
        });
      }
      console.log(result.length);

      const updateQuery = "UPDATE `user` SET `otp`= ? WHERE `email` = ?";
      db.query(updateQuery, [otp, user_email], async (error) => {
        if (error) {
          console.error("OTP Update Error:", error);
          return res
            .status(500)
            .json({ success: false, message: "Failed to update OTP" });
        }

        try {
          await transporter.sendMail(mailOptions);
          return res.json({
            success: true,
            message: "OTP sent successfully!",
          });
        } catch (mailError) {
          console.error("Email Error:", mailError);
          return res
            .status(500)
            .json({ success: false, message: "Error sending OTP" });
        }
      });
    });
  } catch (err) {
    console.error("Server Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

exports.otpauthicate = async (req, res) => {
  const { storedEmail, otp } = req.body;

  if (!storedEmail || !otp) {
    return res
      .status(200)
      .json({ success: false, message: "Missing email or OTP" });
  }

  const selectQuery = "SELECT * FROM `user` WHERE `email` = ? AND `otp` = ?";

  db.query(selectQuery, [storedEmail, otp], (error, result) => {
    if (error) {
      console.error("Database Error:", error);
      return res
        .status(200)
        .json({ success: false, message: "Database error" });
    }

    if (result.length > 0) {
      return res.json({
        success: true,
        message: "OTP authentication successful!",
      });
    } else {
      return res.json({
        success: false,
        message: "Invalid OTP, please try again!",
      });
    }
  });
};

exports.forgotpassword = async (req, res) => {
  const { user_email } = req.body;

  if (!user_email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required." });
  }

  const otp = generateOTP();

  // Email options
  const mailOptions = {
    from: "testk805@gmail.com",
    to: user_email,
    subject: "Reset Your Password - Chat Sphere",
    text: `Dear User,

We received a request to reset your password for your Chat Sphere account.

🔑 Your OTP Code:
📌 ${otp}

This OTP is valid for 5 minutes. If you didn't request this, ignore the email.
To reset your password, enter the OTP on the reset page.

Need help? Contact our support team.

Best regards,
Chat Sphere Team
📧 support@chatsphere.com | 🌐  http://localhost:3001/
`,
  };

  try {
    // Check if user exists
    const selectQuery = "SELECT * FROM `user` WHERE `email` = ?";
    db.query(selectQuery, [user_email], (error, result) => {
      if (error) {
        console.error("Database Error:", error);
        return res
          .status(500)
          .json({ success: false, message: "Database error" });
      }

      if (result.length === 0) {
        return res.status(200).json({
          success: false,
          message: "⚠️ Account not found. Please sign up first.",
        });
      }
      console.log(result.length);

      const updateQuery = "UPDATE `user` SET `otp`= ? WHERE `email` = ?";
      db.query(updateQuery, [otp, user_email], async (error) => {
        if (error) {
          console.error("OTP Update Error:", error);
          return res
            .status(500)
            .json({ success: false, message: "Failed to update OTP" });
        }

        try {
          await transporter.sendMail(mailOptions);
          return res.json({
            success: true,
            message: "OTP sent successfully!",
          });
        } catch (mailError) {
          console.error("Email Error:", mailError);
          return res
            .status(500)
            .json({ success: false, message: "Error sending OTP" });
        }
      });
    });
  } catch (err) {
    console.error("Server Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

exports.forgotPasswordOtp = async (req, res) => {
  const { new_pass, new_confirm, storedEmail } = req.body;

  const updateQuery = "UPDATE `user` SET `password`= ? WHERE `email`= ?";
  db.query(updateQuery, [new_pass, storedEmail], function (error, result) {
    if (error) {
      return console.log(error);
    }
    res.status(200).json({ message: "Password Updated Successfully." });
  });
};

exports.UserLogin = async (req, res) => {
  const { user_email, user_password } = req.body;
  console.log(user_email, user_password);
  const selectQuery =
    "SELECT * FROM `user` WHERE `email` = ? AND `password` = ?";

  db.query(selectQuery, [user_email, user_password], function (error, result) {
    if (error) {
      return console.log(error);
    }
    if (result.length > 0) {
      res.status(200).json({
        status: 1,
        message: "Login successful. Welcome back!",
      });
    } else {
      res.status(200).json({
        status: 0,
        message: "⚠️ Invalid credentials. ",
      });
    }
  });
};

exports.verifyEmail = async (req, res) => {
  const { user_email, city, lat, long } = req.body;
  const otp = generateOTP();

  const mailOptions = {
    from: "testk805@gmail.com",
    to: user_email,
    subject: "Your OTP Code",
    text: `Dear ${user_email},

Welcome to Chat Sphere! 🎉  
Your One-Time Password (OTP) for creating your account is:  

📌 ${otp}  

This OTP is valid for 5 minutes. Please do not share this code with anyone. If you did not request this, please ignore this email.  
Once your account is successfully created, you'll be able to explore all the features of Chat Sphere.  
For any assistance, feel free to contact our support team.  

Best regards,  
Chat Sphere Team  
📧 support@chatsphere.com | 🌐  http://localhost:3001/  
`,
  };

  try {
    // Check if user exists and their status
    const selectQuery = "SELECT * FROM `user` WHERE `email` = ?";
    db.query(selectQuery, [user_email], async (error, result) => {
      if (error) {
        console.error("Database Error:", error);
        return res
          .status(500)
          .json({ success: false, message: "Database error" });
      }
      console.log(result[0]);
      if (result.length > 0) {
        const user = result[0];

        // If email exists and status is 'verify', return message
        if (user.status === "verify") {
          return res.json({ success: false, message: "Email already exists." });
        }

        // If email exists and status is '', update OTP
        if (user.status === "") {
          const updateQuery = "UPDATE `user` SET `otp` = ? WHERE `email` = ?";
          db.query(updateQuery, [otp, user_email], async (error) => {
            if (error) {
              console.error("OTP Update Error:", error);
              return res
                .status(500)
                .json({ success: false, message: "Failed to update OTP" });
            }

            try {
              await transporter.sendMail(mailOptions);
              return res.json({
                success: true,
                message: "OTP sent successfully!",
              });
            } catch (mailError) {
              console.error("Email Error:", mailError);
              return res
                .status(500)
                .json({ success: false, message: "Error sending OTP" });
            }
          });
          return;
        }
      }

      // If email does not exist, insert new user
      const insertQuery =
        "INSERT INTO `user`(`email`, `otp`, `location`, `lat`, `long`) VALUES (?, ?, ?, ?, ?)";
      db.query(
        insertQuery,
        [user_email, otp, city, lat, long],
        async (error) => {
          if (error) {
            console.error("User Insert Error:", error);
            return res
              .status(500)
              .json({ success: false, message: "Failed to create user" });
          }

          try {
            await transporter.sendMail(mailOptions);
            return res.json({
              success: true,
              message: "OTP sent successfully!",
            });
          } catch (mailError) {
            console.error("Email Error:", mailError);
            return res
              .status(500)
              .json({ success: false, message: "Error sending OTP" });
          }
        }
      );
    });
  } catch (err) {
    console.error("Server Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

exports.realveriftotp = async (req, res) => {
  const { user_email, userOTP } = req.body;
  console.log(req.body);
  try {
    const selectQuery = "SELECT * FROM `user` WHERE `email` = ? AND `otp` = ?";

    db.query(selectQuery, [user_email, userOTP], function (error, result) {
      if (error) {
        return console.log(error);
      }
      if (result.length === 1) {
        res
          .status(200)
          .json({ success: 1, message: "OTP authentication successful!" });
      } else {
        res.status(200).json({
          success: 2,
          message: "Invalid OTP. Please check and try again.",
        });
      }
    });
  } catch (error) {
    res.status(200).json({ message: "Error when Verify OTP." });
  }
};
