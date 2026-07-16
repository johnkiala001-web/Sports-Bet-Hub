import type { Request, Response, NextFunction } from "express";

export interface RawBodyRequest extends Request {
  rawBody?: string;
}

export function captureRawBody(req: RawBodyRequest, _res: Response, next: NextFunction): void {
  let data = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => { data += chunk; });
  req.on("end", () => { req.rawBody = data; next(); });
}
