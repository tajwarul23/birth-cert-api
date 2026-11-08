import express, { Request, Response } from "express";
import { errorHandler, notFound } from "./middlewares/errorHandler";
import cookieParser from "cookie-parser";
import routes from "./routes";
import helmet from "helmet";
import { apiLimiter } from "./middlewares/rateLimit";


const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({limit:"100kb"}));
app.use(cookieParser());

app.get("/api/health", (req: Request, res: Response) => {
  res.json({ success: true, message: "Server is running" });
});

app.use("/api", apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);
export default app;
