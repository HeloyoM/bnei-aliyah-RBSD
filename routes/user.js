const express = require("express");
const router = express.Router();
const { execute } = require('../connection-wrapper');
const { verifyToken } = require('./auth');
const { authenticate } = require("../middlewares/auth-resources");

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


router.get('/all', authenticate, async (req, res) => {
    try {
        const sql = `SELECT u.id, u.active, u.email, u.phone, u.address, up.first_name, up.last_name, up.birthday, r.name AS role_name, r.level
             FROM user u
             JOIN user_info up ON u.id = up.id
             JOIN role r ON u.role_id = r.level`
        const result = await execute(sql, []);

        if (result) {
            res.json({ message: 'Login successful', users: result });
        } else {
            console.error('Update profile error:', error);
            res.status(200).json({ message: 'Unable to fetch users' });
        }
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


router.post('/user-actions', async (req, res) => {
    const userId = req.user.userId;
    const { actionType } = req.body;

    if (!actionType) {
        return res.status(400).json({ error: 'Missing userId or actionType' });
    }

    try {
        const result = await execute(`
        INSERT INTO user_actions (user_id, action_type)
        VALUES (?, ?)
    `, [userId, actionType]);

        if (result.affectedRows > 0) {
            res.status(200).json({ message: 'Action recorded' });
        }
    } catch (err) {
        console.error('Error logging user action:', err);
        res.status(500).json({ error: 'Failed to log user action' });
    }
});

module.exports = router;