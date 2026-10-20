const { Readable } = require("node:stream");

const PREFIX = "/__pearl_api";
const ALLOWED_PATH = /^(?:\/api\/(?:auth\/sign-in\/email\/?$|chats(?:\/|$)|issues\/?$|attachments\/?$)|\/eve\/v1\/(?:session(?:\/|$)|health\/?$|info\/?$))/;

// Used only by the local Expo dev server. Production auth does not allow
// arbitrary browser origins, so same-origin browser requests are forwarded
// server-side instead of changing the production CORS/CSRF policy.
function withWebDevProxy(middleware, upstreamHost) {
  const upstreamOrigin = new URL(upstreamHost).origin;

  return (req, res, next) => {
    const host = req.headers.host ?? "";
    const url = req.url ?? "";
    if (!url.startsWith(`${PREFIX}/`)) return middleware(req, res, next);

    // Never expose this credential-bearing proxy on the LAN or to another
    // browser origin. Expo can still serve its normal app assets over LAN.
    if (!/^(?:localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host)) {
      res.writeHead(403).end();
      return;
    }

    const requestUrl = new URL(url, `http://${host}`);
    const path = requestUrl.pathname.slice(PREFIX.length);
    if (!ALLOWED_PATH.test(path) || !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      res.writeHead(404).end();
      return;
    }
    const browserOrigin = `http://${host}`;
    if (req.headers.origin && req.headers.origin !== browserOrigin) {
      res.writeHead(403).end();
      return;
    }
    if (req.method !== "GET" && !req.headers.origin) {
      res.writeHead(403).end();
      return;
    }

    const target = new URL(upstreamOrigin);
    target.pathname = path;
    target.search = requestUrl.search;
    const headers = {
      origin: upstreamOrigin,
      ...(req.headers.accept ? { accept: req.headers.accept } : {}),
      ...(req.headers["content-type"] ? { "content-type": req.headers["content-type"] } : {}),
      ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
    };

    void fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" ? undefined : req,
      duplex: "half",
      redirect: "manual",
    }).then((response) => {
      res.statusCode = response.status;
      res.setHeader("cache-control", "no-store");
      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("content-type", contentType);
      if (response.body) {
        Readable.fromWeb(response.body).on("error", () => res.destroy()).pipe(res);
      } else {
        res.end();
      }
    }).catch(() => {
      if (!res.headersSent) res.writeHead(502).end("Agent is unavailable.");
      else res.destroy();
    });
  };
}

module.exports = { withWebDevProxy };
