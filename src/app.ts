import express, { Request, Response } from "express";
import { errorHandler, notFound } from "./middlewares/errorHandler";
import cookieParser from "cookie-parser";
import routes from "./routes";


const app = express();
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (req: Request, res: Response) => {
  res.json({ success: true, message: "Server is running" });
});

app.use("/api", routes)

app.use(notFound);
app.use(errorHandler);
export default app;
