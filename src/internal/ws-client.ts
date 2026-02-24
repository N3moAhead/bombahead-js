import WebSocket from "ws";
import { Action } from "../enums.js";

type Listener<T = void> = (payload: T) => void;

interface Envelope<T = unknown> {
  type: string;
  payload: T;
}

export interface WsClientOptions {
  url: string;
  token?: string;
}

export class WsClient {
  private socket: WebSocket | null = null;

  private onConnectListener?: Listener;
  private onMessageListener?: Listener<string>;
  private onErrorListener?: Listener<Error>;
  private onDisconnectListener?: Listener<{ code: number; reason: string }>;

  constructor(private readonly options: WsClientOptions) {}

  connect(): void {
    const headers: Record<string, string> = {};
    if (this.options.token) {
      headers.Authorization = `Bearer ${this.options.token}`;
    }

    try {
      this.socket = new WebSocket(this.options.url, { headers });
    } catch (error) {
      this.onErrorListener?.(error as Error);
      return;
    }

    this.socket.on("open", () => {
      this.onConnectListener?.();
    });

    this.socket.on("message", (data) => {
      this.onMessageListener?.(data.toString());
    });

    this.socket.on("error", (err) => {
      this.onErrorListener?.(err as Error);
    });

    this.socket.on("close", (code, reason) => {
      this.onDisconnectListener?.({ code, reason: reason.toString() });
    });
  }

  close(): void {
    this.socket?.close();
  }

  onConnect(cb: Listener): void {
    this.onConnectListener = cb;
  }

  onMessage(cb: Listener<string>): void {
    this.onMessageListener = cb;
  }

  onError(cb: Listener<Error>): void {
    this.onErrorListener = cb;
  }

  onDisconnect(cb: Listener<{ code: number; reason: string }>): void {
    this.onDisconnectListener = cb;
  }

  /** Sends the bot action in the server envelope format. */
  sendAction(action: Action): void {
    const move = isAction(action) ? action : Action.DO_NOTHING;
    this.send("classic_input", { move });
  }

  /** Sends a custom envelope to the game server. */
  send<TPayload>(type: string, payload: TPayload): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const msg: Envelope<TPayload> = { type, payload };
      this.socket.send(JSON.stringify(msg));
    } catch (error) {
      this.onErrorListener?.(error as Error);
    }
  }
}

function isAction(value: unknown): value is Action {
  return (
    value === Action.MOVE_UP ||
    value === Action.MOVE_DOWN ||
    value === Action.MOVE_LEFT ||
    value === Action.MOVE_RIGHT ||
    value === Action.PLACE_BOMB ||
    value === Action.DO_NOTHING
  );
}
