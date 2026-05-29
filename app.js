import "dotenv/config";
import express      from "express";
import cors         from "cors";
import morgan       from "morgan";
import helmet       from "helmet";
import routes       from "./src/routes/index.js";
import { stripeWebhook } from "./src/module/user/deposite/deposite.webhook.js";

const app = express();

 // ✅ MUST be FIRST — before any middleware
app.post(
  "/api/webhook/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

// ✅ STEP 2 — then other middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(helmet());
app.use(morgan("combined"));

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:4200",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods:              ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders:       ["Content-Type", "Authorization"],
  credentials:          true,
  optionsSuccessStatus: 200,
}));

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

app.use("/api", routes);

export default app;