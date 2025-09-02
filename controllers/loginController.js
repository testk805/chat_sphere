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
📧 support@chatsphere.com | 🌐http://localhost:5000/`,
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
📧 support@chatsphere.com | 🌐http://localhost:5000/
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
📧 support@chatsphere.com | 🌐http://localhost:5000/  
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

exports.Updatelastlogin = (req, res) => {
  const { userEmail } = req.body;
  try {
    const UpdateQuery =
      "UPDATE `user` SET `last_login` = CURRENT_TIMESTAMP() WHERE `email` = ?";
    db.query(UpdateQuery, [userEmail], function (error, result) {
      if (error) {
        console.log(error);
        return res.status(500).json({ status: 0, error: error.message });
      }
      res
        .status(200)
        .json({ status: 1, message: "Last login updated successfully." });
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ status: 0, error: error.message });
  }
};

async function generateScript(
  projectName,
  problem_statement,
  email,
  systems = []
) {
  const logDir = path.join(
    __dirname,
    "..",
    "ai2dev-folders",
    "projects",
    `${email}`,
    `${projectName}`,
    "logs"
  );

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFileName = `${new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace("T", "_")
    .slice(0, -1)}-${email}-${projectName}.log`;

  const logFilePath = path.join(logDir, logFileName);

  const logMessage = async (message) => {
    console.log(message);
    await fs.promises.appendFile(logFilePath, message + "\n", "utf8");
  };

  let feedData =
    problem_statement +
    " Use the following data for each resource creation and sample JSON for input-output mapping. " +
    " Any error should be logged and returned in a structured error format to the user. ";

  // Multi-DB config logic
  let configFeed = "";
  let envFeed = "";
  let dbTypes = []; 

  if (Array.isArray(systems) && systems.length > 0) {
    for (const sys of systems) {
      const dbName = sys.connectName.trim().toUpperCase();
      const dbType = sys.systemName.toLowerCase();
      const backendsystems = `${dbType}`;
      const systems = backendsystems
        .split(",")
        .map((s) => s.trim().replace(/\s+/g, "_").toLowerCase());
    }

    feedData += `\n======= MULTI-DB SUPPORT =======\n${configFeed}\nAdd to .env:\n${envFeed}\n==============================\n`;
  }

  const folderPath = path.join(
    __dirname,
    "../ai2dev-folders",
    "projects",
    email,
    projectName,
    "methods"
  );

  try {
    await logMessage(
      `🔹 Processing project: ${projectName} for user: ${email}`
    );

    const files = fs.readdirSync(folderPath);
    let content = "";
    let resources = "";

    for (const resource of files) {
      let folderPathConnection = path.join(folderPath, resource);

      if (fs.statSync(folderPathConnection).isFile()) {
        content = fs.readFileSync(folderPathConnection, "utf-8");

        await logMessage(`📄 Read connection file: ${resource}`);
        await logMessage(`📄 Content of ${resource}: \n${content}\n`);

        feedData += `File: ${resource}, Content: '${content}' `;
        content = "";
      }

      if (fs.statSync(folderPathConnection).isDirectory()) {
        resources = fs.readdirSync(folderPathConnection);
        feedData += ` For resource = /${resource}, use these data to create script: `;

        for (const method of resources) {
          let filePath = path.join(folderPathConnection, method);
          if (fs.statSync(filePath).isFile()) {
            content = fs.readFileSync(filePath, "utf-8");

            await logMessage(`📂 Read method file: ${method}`);
            await logMessage(`📂 Content of ${method}: \n${content}\n`);

            feedData += ` Method: ${method}, Sample input/output: '${content}' `;
          }
        }
      }
    }

    let routes = '"index.js": "", ';
    let controllers = "";
    let config = "";
    let connections = "";
    let connectionConfig = "";

    systems.forEach((system) => {
      routes += `"${system}": { "${system}Routes.js": "" }, `;
      controllers += `"${system}": { "${system}Controller.js": "" }, `;
      config += `"${system}": {}, `;
      connections += `"${system}.js": "", `;
      connectionConfig += `"${system}.js": "", `;
    });

    feedData +=
      "\n\n" +
      "Use the backend system names provided in the variable 'backendsystems' to name folders, files, and environment variable prefixes. " +
      "Return the scripts in a Node.js backend project with the following structure: " +
      "src/index.js, and other folders like src/routes, src/controllers, src/models, src/middleware, and src/config. " +
      "Ensure src/routes has an index.js that imports and combines all individual route files. " +
      "Ensure src/index.js uses require('./routes') which refers to routes/index.js. " +
      "For each backend system, create separate folders under src/controllers, src/config, and src/routes named after the system. " +
      "Each folder should contain system-specific files like Controller.js, Routes.js, and Config.js. " +
      "All environment variables must be prefixed with the backend system name in uppercase, replacing spaces with underscores. " +
      "All backend system configs should go inside connections/config/. Use one config file per system. " +
      "Create separate connection files like connections/.js that import the respective config files. " +
      "In each connection file, log whether the system is connected or failed. " +
      "Include all connection files in your app startup file (index.js). " +
      "Add all related variables in the .env file clearly grouped by backend system. " +
      "The package.json must include express, dotenv, and cors as dependencies and set ./src/index.js as the main entry point. " +
      "The final response must be a valid JSON object with this structure: { " +
      `"src": { "index.js": "", "routes": { ${routes} }, "controllers": { ${controllers} }, "models": {}, "middleware": {}, "config": { ${config} } }, ` +
      `"connections": { ${connections} "config": { ${connectionConfig} } }, ".env": "", "package.json": "" } ` +
      'The entire response must be raw JSON only, with double-quoted keys and values. Escape all characters properly for JSON (e.g. \\n, \\", \\\\). Do not return markdown, comments, or explanations.' +
      "Also setup CORS (all origins, all methods) in index.js.";

    await logMessage("✅ Feed data prepared for AI processing");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an API coding expert. Return ONLY a valid JSON object with no markdown formatting or extra text. The JSON should represent the entire Node.js project structure exactly as specified.",
        },
        { role: "user", content: feedData },
      ],
    });

    let rawJson = response.choices[0].message.content.trim();
    await logMessage(`🔍 AI Raw Response: \n${rawJson}`);

    rawJson = rawJson
      .replace(/^```json\s*/, "")
      .replace(/\s*```$/, "")
      .trim();

    if (!rawJson.startsWith("{") || !rawJson.endsWith("}")) {
      await logMessage(`⚠️ Invalid JSON format: ${rawJson}`);
      throw new Error("Invalid JSON format from AI response.");
    }

    const jsonData = JSON.parse(rawJson);
    await logMessage("✅ Successfully parsed JSON from AI response");

    const folderPathProject = path.join(
      __dirname,
      `../ai2dev-folders/projects/${email}/${projectName}/generatedRepos`
    );
    fs.mkdirSync(folderPathProject, { recursive: true });

    await logMessage(`📂 Created project directory: ${folderPathProject}`);
    createProjectStructure(jsonData, folderPathProject);

    await logMessage("🚀 Project structure created successfully!");
    return "SUCCESS";
  } catch (err) {
    await logMessage(`❌ Error: ${err.message}`);
    throw err;
  }
}
