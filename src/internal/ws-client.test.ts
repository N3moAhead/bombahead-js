import test from "node:test";
import assert from "node:assert/strict";

import { WebSocketServer } from "ws";

import { Action } from "../enums.js";
import { WsClient } from "./ws-client.js";

test("WsClient.connect and sendAction send expected envelope", async () => {
  const wss = new WebSocketServer({ port: 0 });
  const address = wss.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to bind websocket server");
  }

  let receivedAuth = "";
  const messagePromise = new Promise<{ type: string; payload: unknown }>(
    (resolve) => {
      wss.on("connection", (socket, req) => {
        receivedAuth = req.headers.authorization ?? "";
        socket.on("message", (raw) => {
          resolve(
            JSON.parse(raw.toString()) as { type: string; payload: unknown },
          );
        });
      });
    },
  );

  const client = new WsClient({
    url: `ws://127.0.0.1:${address.port}`,
    token: "abc",
  });

  const connected = new Promise<void>((resolve) => {
    client.onConnect(() => resolve());
  });

  client.connect();
  await connected;

  client.sendAction(Action.MOVE_LEFT);

  const message = await messagePromise;
  assert.equal(receivedAuth, "Bearer abc");
  assert.deepEqual(message, {
    type: "classic_input",
    payload: { move: Action.MOVE_LEFT },
  });

  client.close();
  wss.close();
});

test("WsClient.onMessage and onDisconnect callbacks are called", async () => {
  const wss = new WebSocketServer({ port: 0 });
  const address = wss.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to bind websocket server");
  }

  const client = new WsClient({ url: `ws://127.0.0.1:${address.port}` });

  const onMessagePromise = new Promise<string>((resolve) => {
    client.onMessage((value) => resolve(value));
  });

  const onDisconnectPromise = new Promise<{ code: number; reason: string }>(
    (resolve) => {
      client.onDisconnect((payload) => resolve(payload));
    },
  );

  const connected = new Promise<void>((resolve) => {
    client.onConnect(() => resolve());
  });

  client.connect();
  await connected;

  for (const socket of wss.clients) {
    socket.send("server-msg");
    socket.close(4100, "bye");
  }

  const incoming = await onMessagePromise;
  assert.equal(incoming, "server-msg");

  const disconnected = await onDisconnectPromise;
  assert.equal(disconnected.code, 4100);
  assert.equal(disconnected.reason, "bye");

  wss.close();
});

test("WsClient.send is a no-op before connection", () => {
  const client = new WsClient({ url: "ws://127.0.0.1:1" });
  assert.doesNotThrow(() => client.send("x", { foo: "bar" }));
});

test("WsClient.connect reports invalid url through onError", async () => {
  const client = new WsClient({ url: "not a websocket url" });
  const errored = new Promise<Error>((resolve) => {
    client.onError((err) => resolve(err));
  });

  assert.doesNotThrow(() => client.connect());
  const err = await errored;
  assert.match(err.message, /URL|Invalid URL|invalid/i);
});

test("WsClient.send reports JSON serialization errors via onError", async () => {
  const wss = new WebSocketServer({ port: 0 });
  const address = wss.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to bind websocket server");
  }

  const client = new WsClient({ url: `ws://127.0.0.1:${address.port}` });
  const connected = new Promise<void>((resolve) => {
    client.onConnect(() => resolve());
  });
  const errored = new Promise<Error>((resolve) => {
    client.onError((err) => resolve(err));
  });

  client.connect();
  await connected;

  const circular: { self?: unknown } = {};
  circular.self = circular;

  client.send("circular", circular);
  const err = await errored;
  assert.match(err.message, /circular/i);

  client.close();
  wss.close();
});
