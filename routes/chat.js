const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");

router.post("/fetchuserdata", chatController.fetchuserdata);
router.post("/fetchFriendData", chatController.fetchFriendData);
router.post("/updatelocation", chatController.updatelocation);
router.post("/getfriendchat", chatController.getfriendchat);
router.post("/sendMessage", chatController.sendMessage);
router.post("/getUserChat", chatController.getUserChat);
router.post("/savePeerid", chatController.savePeerid);

module.exports = router;
