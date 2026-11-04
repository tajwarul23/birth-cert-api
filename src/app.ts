import express, { Request, Response } from "express";


const app = express();
app.use(express.json());

app.get("/api/health", (req: Request, res: Response) => {
  res.json({ success: true, message: "Server is running" });
});

export default app;
