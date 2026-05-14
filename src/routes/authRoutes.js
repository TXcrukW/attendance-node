const express = require('express');
const router = express.Router();
const { login } = require('../common/controllers/authController');

router.post('/login', login);

module.exports = router;
