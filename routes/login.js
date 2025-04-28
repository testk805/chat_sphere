const express = require("express");
const router = express.Router();
const loginController = require("../controllers/loginController");

router.post("/create", loginController.create);
router.post("/google", loginController.google);
router.post("/loginwithotp", loginController.loginwithotp);
router.post("/otpauthicate", loginController.otpauthicate);
router.post("/forgotpassword", loginController.forgotpassword);
router.post("/forgotPasswordOtp", loginController.forgotPasswordOtp);
router.post("/UserLogin", loginController.UserLogin);
router.post("/verifyEmail", loginController.verifyEmail);
router.post("/realveriftotp", loginController.realveriftotp);
router.post("/Updatelastlogin", loginController.Updatelastlogin);

module.exports = router;
