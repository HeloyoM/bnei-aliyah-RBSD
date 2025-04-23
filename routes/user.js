const express = require("express");
const router = express.Router();
const { execute } = require('../connection-wrapper');
const { verifyToken } = require('./auth');

router.post('/update-profile', verifyToken, async (req, res) => {
    const { phone, address } = req.body;
    const userId = req.user.userId;

    if (!phone || !address) {
        return res.status(400).json({ message: 'Phone and address are required' });
    }

    try {
        // Update the user table
        const result = await execute(
            'UPDATE user SET phone = ?, address = ? WHERE id = ?',
            [phone, address, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' }); // Should not happen, but good to check
        }

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;