/**
 * CRA dev proxy — forwards /api/* and /ws/* to the Spring Boot backend.
 * This file is automatically picked up by react-scripts; no import needed.
 * WebSocket (SockJS) needs the ws path proxied with ws:true.
 */
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  // REST API
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:8080",
      changeOrigin: true,
    })
  );

  // WebSocket (SockJS + STOMP)
  app.use(
    "/ws",
    createProxyMiddleware({
      target: "http://localhost:8080",
      changeOrigin: true,
      ws: true,           // ← proxies WebSocket upgrade requests
    })
  );
};
