const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Specific routes first to avoid conflicts
router.get('/maintenance/upcoming', verifyToken, itemController.getUpcomingMaintenance);
router.get('/maintenance/needed', verifyToken, itemController.getItemsNeedingMaintenance);
router.get('/qr/:code', verifyToken, itemController.getItemByQRCode);
router.get('/export', verifyToken, itemController.exportItems);

// General routes
router.get('/', verifyToken, itemController.getAllItems);
router.get('/:id', verifyToken, itemController.getItemById);
router.post('/', verifyToken, itemController.createItem);
router.put('/:id', verifyToken, itemController.updateItem);
router.delete('/:id', verifyToken, isAdmin, itemController.deleteItem);

module.exports = router; 