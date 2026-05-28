import express from 'express';
import routes from "./src/routes/index.js";
import cors         from "cors";
import morgan       from "morgan";
import helmet       from "helmet";

const app = express();

app.use(helmet());
app.use(morgan("combined"));

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",   // vite dev
  "http://localhost:4200",   // angular dev
  process.env.FRONTEND_URL,  // production frontend
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // allow postman & server-to-server (no origin)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods:            ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders:     ["Content-Type", "Authorization"],
  credentials:        true,
  optionsSuccessStatus: 200,
}));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
  app.use("/api",routes)
// Error handler


export default app;