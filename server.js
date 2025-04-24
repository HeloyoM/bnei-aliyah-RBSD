const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

require("dotenv").config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

const { router: authRoutes } = require("./routes/auth");
const userRoutes = require("./routes/user");
const campaignRoutes = require("./routes/campaign");

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/campaign', campaignRoutes);

// Start server
app.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});