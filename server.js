const express = require("express");

const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to DB
const pool = mysql.createConnection({
    host: process.env.HOST || '',
    user: process.env.DATABASE_USER_NAME || '',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || '',
    port: 3307
}) 


const userRoutes = require("./routes/userRoutes");
const authRoutes = require('./routes/authRoutes');

app.use('/api/auth', authRoutes);
app.use("/api/users", userRoutes);

// Start server
app.listen(port, () => {
  console.log('Server running on port: port');
});