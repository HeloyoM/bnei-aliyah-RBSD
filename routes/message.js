
const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { execute } = require('../connection-wrapper');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

// 1. Route to create a new message (sent to all users)
router.post('/', verifyToken,
    [
        // Input validation using express-validator
        body('description').notEmpty().withMessage('Message description is required'),
    ],
    async (req, res) => {
        // 1. Input Validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // 2. Extract data from the request body and user ID from JWT
        const { description } = req.body;
        const senderId = req.user.userId;

        // 3. Database Interaction
        try {
            const messageId = uuidv4();
            // Insert the new message into the messages table
            const result = await execute(
                'INSERT INTO messages (id, description, sender_id) VALUES (?, ?, ?)', // add description
                [messageId, description, senderId]
            );

            if (result.affectedRows === 1) {
                // 4. Send a success response
                res.status(201).json({ message: 'Message sent successfully', messageId });
            } else {
                res.status(500).json({ message: 'Failed to send message' });
            }
        } catch (error) {
            // 5. Handle errors
            console.error('Error sending message:', error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }
);


// 2. Route to get all messages (for a user) and their replies
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Fetch all messages and their replies
        const messages = await execute(
            `SELECT
                m.id AS message_id,
                m.sender_id AS sender_id,
                u_sender.email AS sender_email,
                m.description,
                m.created_at AS created_at,
                r.id AS reply_id,
                r.replier_id,
                u_reply_sender.email AS reply_sender_email,
                r.description AS reply_description,
                r.created_at AS reply_created_at
            FROM messages m
            JOIN user u_sender ON m.sender_id = u_sender.id
            LEFT JOIN replies r ON m.id = r.message_id
            LEFT JOIN user u_reply_sender ON r.replier_id = u_reply_sender.id
            ORDER BY m.created_at DESC, r.created_at ASC
            `
        );

        // Organize the data into a nested structure
        const formattedMessages = [];
        const messageMap = new Map();

        messages.forEach(row => {
            if (!messageMap.has(row.message_id)) {
                messageMap.set(row.message_id, {
                    message_id: row.message_id,
                    sender_id: row.sender_id,
                    sender_email: row.sender_email,
                    description: row.description,
                    created_at: row.created_at,
                    replies: [],
                });
                formattedMessages.push(messageMap.get(row.message_id));
            }

            if (row.reply_id) {
                messageMap.get(row.message_id).replies.push({
                    reply_id: row.reply_id,
                    replier_id: row.replier_id,
                    reply_sender_email: row.reply_sender_email,
                    reply_description: row.reply_description,
                    reply_created_at: row.reply_created_at,
                });
            }
        });

        res.status(200).json(formattedMessages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});


// 3. Route to reply to a message
router.post('/:messageId/replies', verifyToken,
    [
        body('description').notEmpty().withMessage('Reply description is required'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { description } = req.body;
        const { messageId } = req.params;
        const replierId = req.user.userId;

        try {
            const replyId = uuidv4();
            const result = await execute(
                'INSERT INTO replies (id, message_id, replier_id, description) VALUES (?, ?, ?, ? )',
                [replyId, messageId, replierId, description]
            );

            if (result.affectedRows === 1) {
                res.status(201).json({ message: 'Reply sent successfully', replyId });
            } else {
                res.status(500).json({ message: 'Failed to send reply' });
            }
        } catch (error) {
            console.error('Error sending reply:', error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }
);

module.exports = router;