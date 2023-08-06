import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";
import requestLogger from "./src/middlewares/logger.js";
import errorHandler from "./src/middlewares/error.handler.js";

// @config dotenv
dotenv.config();

// @create express app
const app = express();

// @use body-parser
app.use(bodyParser.json())
app.use(cors({ exposedHeaders : "Authorization" }))
app.use(requestLogger)

// @expose public folder
// app.use("/public", express.static("public"))

// @root route
app.get("/", (req, res) => {
    res.status(200).send("<h1>Welcome to my REST API.</h1>")
})

// @use router
import AuthRouters from "./src/controllers/authentication/routers.js"
import BlogRouters from "./src/controllers/blogs/routers.js"

app.use("/api/auth", AuthRouters)
app.use("/api/blog", BlogRouters)

// @error handler
app.use(errorHandler)

// @listen to port
const PORT = process.env.PORT
app.listen(PORT, () => console.log(`Hello, server running on port ${PORT}`));