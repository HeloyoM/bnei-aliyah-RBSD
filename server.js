const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
// const LogRocket = require('@sentry/node')
require("dotenv").config();
// const http = require('http')

const { router: authRoutes, verifyToken } = require("./routes/auth");
const userRoutes = require("./routes/user");
const campaignRoutes = require("./routes/campaign");
const { router: messageRoutes/*, initializeSocketIO*/ } = require("./routes/message");
const adminRoutes = require("./routes/admin");
const scheduleRoutes = require("./routes/schedule");
const lessonRoutes = require("./routes/lesson");
const paymentsRoutes = require("./routes/payments");
const eventsRoutes = require("./routes/events");
// const { trackVisitor } = require("./middlewares/trackVisitor");


const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// const server = http.createServer(app);

// initializeSocketIO(server);

// app.use(trackVisitor);

// app.use((err, req, res, next) => {
//   LogRocket.captureException(err);
//   res.status(500).json({ message: 'Something went wrong' });
// });

app.use('/api/auth', authRoutes);
app.use('/api/user', verifyToken, userRoutes);
app.use('/api/campaign', verifyToken, campaignRoutes);
app.use('/api/messages', messageRoutes); // doesn't use verifyToken, for guests!
app.use('/api/admin', verifyToken, adminRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/lesson', verifyToken, lessonRoutes);
app.use('/api/payments', verifyToken, paymentsRoutes);
app.use('/api/events', verifyToken, eventsRoutes)

app.listen(port, () => {
  console.log(`Server running on port: ${port}`);
}); 
