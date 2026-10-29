import type { ErrorRequestHandler, RequestHandler } from "express";

export const notFound: RequestHandler = (_req, res) => {
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Route not found." } });
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const type =
    typeof error === "object" && error !== null && "type" in error
      ? error.type
      : undefined;
  if (type === "entity.parse.failed") {
    res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON.",
      },
    });
    return;
  }
  if (type === "entity.too.large") {
    res.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body exceeds the 16 KiB limit.",
      },
    });
    return;
  }
  if (type === "charset.unsupported" || type === "encoding.unsupported") {
    res.status(415).json({
      error: {
        code: "UNSUPPORTED_ENCODING",
        message: "Request encoding is not supported.",
      },
    });
    return;
  }
  // Do not log request bodies, credentials or arbitrary exception messages.
  console.error("Unhandled request error.");
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    },
  });
};
