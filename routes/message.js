
const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');
const { execute } = require('../connection-wrapper');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const socketIO = require('socket.io');

let io; // Declare a global variable to hold the Socket.IO server instance  

// Function to initialize Socket.IO
function initializeSocketIO(server) {
    io = new socketIO.Server(server);

    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);
    });
}

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
        const { description, isPublic = 0 } = req.body;
        const senderId = req.user.userId;

        const is_public = isPublic ? 1 : 0;
        // 3. Database Interaction
        try {
            const messageId = uuidv4();
            // Insert the new message into the messages table
            const result = await execute(
                'INSERT INTO messages (id, description, sender_id, is_public) VALUES (?, ?, ?, ?)', // add description
                [messageId, description, senderId, is_public]
            );

            if (result.affectedRows === 1) {
                // Fetch the newly inserted message
                const newMessageResult = await execute(
                    `SELECT m.id AS message_id, m.sender_id, m.is_public, u.email AS sender_email,
                     m.created_at, m.description
                     FROM messages m
                     JOIN user u ON m.sender_id = u.id
                     WHERE m.id = ?`,
                    [messageId]
                );

                if (newMessageResult.length > 0) {
                    const newMessage = newMessageResult[0];
                    res.status(201).json({ message: 'Message sent successfully', messageId, newMessage });
                    io.emit('newMessage', newMessage); // Emit after successful DB insertion
                } else {
                    res.status(500).json({ message: 'Failed to retrieve new message' });
                }
            } else {
                res.status(500).json({ message: 'Failed to send message' });
            }
        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }
);


// 2. Route to get all messages (for a user) and their replies
router.get('/', verifyToken, async (req, res) => {
    try {
        // Fetch all messages and their replies
        const messages = await execute(
            `SELECT
                m.id AS message_id,
                m.sender_id AS sender_id,
                m.description,
                m.created_at AS created_at,
                m.is_public,
                r.id AS reply_id,
                r.replier_id,
                r.description AS reply_description,
                r.created_at AS reply_created_at,
                u_sender.email AS sender_email,
                r_sender.name AS sender_role,
                r_reply_sender.name AS reply_sender_role,
                u_reply_sender.email AS reply_sender_email
            FROM messages m
            JOIN user u_sender ON m.sender_id = u_sender.id
            JOIN role r_sender ON u_sender.role_id = r_sender.level
            LEFT JOIN replies r ON m.id = r.message_id
            LEFT JOIN user u_reply_sender ON r.replier_id = u_reply_sender.id
            LEFT JOIN role r_reply_sender ON u_reply_sender.role_id = r_reply_sender.level
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
                    sender_role: row.sender_role,
                    sender_email: row.sender_email,
                    description: row.description,
                    sender_role: row.sender_role,
                    created_at: row.created_at,
                    is_public: row.is_public,
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
                    reply_sender_role: row.reply_sender_role
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
                // Fetch the newly inserted reply
                const newReplyResult = await execute(
                    `SELECT r.id AS reply_id, r.sender_id AS reply_sender_id, u.email AS reply_sender_email,
                     r.text AS reply_text, r.created_at AS reply_created_at
                     FROM replies r
                     JOIN user u ON r.sender_id = u.id
                     WHERE r.id = ?`,
                    [replyId]
                );

                if (newReplyResult.length > 0) {
                    const newReply = newReplyResult[0];
                    res.status(201).json({ message: 'Reply sent successfully', replyId });
                    io.emit('newReply', { messageId, reply: newReply }); // Emit after successful DB insertion
                } else {
                    res.status(500).json({ message: 'Failed to retrieve new reply' });
                }
            } else {
                res.status(500).json({ message: 'Failed to send reply' });
            }
        } catch (error) {
            console.error('Error sending reply:', error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }
);


router.post('/guest',
    [
        body('name').notEmpty().withMessage('Campaign name is required'),
        body('email').notEmpty().isEmail().withMessage('Email is required'),
        body('description').notEmpty().withMessage('Message description is required'),
    ],
    async (req, res) => {
        // 1. Input Validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // 2. Extract data from the request body and user ID from JWT
        const { description, name, email } = req.body;

        // 3. Database Interaction
        try {
            const messageId = uuidv4();
            // Insert the new message into the messages table
            const result = await execute(
                'INSERT INTO messages (id, description, guest_name, guest_email) VALUES (?, ?, ?, ?)',
                [messageId, description, name, email]
            );

            if (result.affectedRows === 1) {
                res.status(201).json({ message: 'your message received, we will connect you soon!' })
            }
        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }
);


// 2. Route to get all guests messages
router.get('/guest', verifyToken, async (req, res) => {
    try {
        // Fetch all guests messages 
        const messages = await execute(
            `SELECT * FROM beni.messages WHERE sender_id is null ORDER BY created_at DESC`
        );

        res.status(200).json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});
module.exports = { router, initializeSocketIO };