const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();
const http = require('http')

const { router: authRoutes } = require("./routes/auth");
const userRoutes = require("./routes/user");
const campaignRoutes = require("./routes/campaign");
const { router: messageRoutes , initializeSocketIO} = require("./routes/message");
const  adminRoutes =  require("./routes/admin");
const  scheduleRoutes =  require("./routes/schedule");
const  lessonRoutes =  require("./routes/lesson");


const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

const server = http.createServer(app);

initializeSocketIO(server);


app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/campaign', campaignRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/lesson', lessonRoutes);


// Start server
app.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});