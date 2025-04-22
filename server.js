const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

require("dotenv").config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

const authRoutes = require("./routes/auth");

app.use('/api/auth', authRoutes);
// app.use("/api/users", userRoutes);

// Start server
app.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});