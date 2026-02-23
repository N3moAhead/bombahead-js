import WebSocket from "ws";
import { Action } from "../enums";

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

    this.socket = new WebSocket(this.options.url, { headers });

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
    this.send("classic_input", { move: action });
  }

  /** Sends a custom envelope to the game server. */
  send<TPayload>(type: string, payload: TPayload): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const msg: Envelope<TPayload> = { type, payload };
    this.socket.send(JSON.stringify(msg));
  }
}
