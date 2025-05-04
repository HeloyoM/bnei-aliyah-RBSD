const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { execute } = require('../connection-wrapper'); // Import your database execute function
const { v4: uuidv4 } = require('uuid');

// Validation middleware for lesson data
const lessonValidationRules = [
    body('greg_date').notEmpty().isDate().withMessage('Gregorian date is required and must be a valid date'),
    body('start_time').notEmpty().matches(/^([0-9]{2}:[0-9]{2})$/).withMessage('Start time is required and must be in HH:MM format'),
    body('end_time').notEmpty().matches(/^([0-9]{2}:[0-9]{2})$/).withMessage('End time is required and must be in HH:MM format'),
    body('topic').notEmpty().isString().withMessage('Topic is required and must be a string'),
    body('description').optional().isString().withMessage('Description must be a string'),
    body('teacher').optional().isString().withMessage('Teacher must be a string'),
    // Custom validation to ensure end_time is after start_time
    body('end_time').custom((value, { req }) => {
        if (req.body.start_time && value <= req.body.start_time) {
            throw new Error('End time must be after start time');
        }
        return true;
    })
];

router.post('/', lessonValidationRules, async (req, res) => {
    // Check for validation errors.
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { greg_date, hebrew_date, start_time, end_time, topic, description, teacher } = req.body;
    try {
        const lessonId = uuidv4();
        const sql = `
            INSERT INTO lessons (id,greg_date, hebrew_date, start_time, end_time, topic, description, teacher)
            VALUES (?,?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [lessonId, greg_date, hebrew_date, start_time, end_time, topic, description, teacher];
        const result = await execute(sql, values);
        res.status(201).json({ message: 'Lesson created successfully', insertId: result.insertId });
    } catch (error) {
        console.error('Error creating lesson:', error);
        res.status(500).json({ error: 'Failed to create lesson: ' + error.message });
    }
});

router.get('/', async (req, res) => {
    try {
        let sql = 'SELECT * FROM lessons ORDER BY greg_date DESC';
        const values = [];

        const results = await execute(sql, values);
        res.status(200).json(results);
    } catch (error) {
        console.error('Error fetching lessons:', error);
        res.status(500).json({ error: 'Failed to fetch lessons: ' + error.message });
    }
})


router.put('/lessons/:id', lessonValidationRules, async (req, res) => {
    // Check for validation errors.
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { greg_date, hebrew_date, start_time, end_time, topic, description, teacher } = req.body;

    try {
        const sql = `
            UPDATE lessons
            SET greg_date = ?, hebrew_date = ?, start_time = ?, end_time = ?, topic = ?, description = ?, teacher = ?
            WHERE id = ?
        `;
        const values = [greg_date, hebrew_date, start_time, end_time, topic, description, teacher, id];
        const result = await execute(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Lesson not found' });
        }
        res.json({ message: 'Lesson updated successfully' });
    } catch (error) {
        console.error('Error updating lesson:', error);
        res.status(500).json({ error: 'Failed to update lesson: ' + error.message });
    }
});

router.delete('/lessons/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const sql = 'DELETE FROM lessons WHERE id = ?';
        const values = [id];
        const result = await execute(sql, values);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Lesson not found' });
        }
        res.json({ message: 'Lesson deleted successfully' });
    } catch (error) {
        console.error('Error deleting lesson:', error);
        res.status(500).json({ error: 'Failed to delete lesson: ' + error.message });
    }
});
module.exports = router;