// Minimal type shim for socket.io so tsc compiles without the package in node_modules.
// The real socket.io is declared in package.json and installed during Docker build.
declare module 'socket.io' {
  import { Server as HttpServer } from 'http';

  interface DefaultEventsMap {
    [event: string]: (...args: any[]) => void;
  }

  interface SocketData {
    userId: string;
    role: string;
    email: string;
    [key: string]: any;
  }

  class Socket {
    id: string;
    data: SocketData;
    handshake: {
      auth: Record<string, any>;
      headers: Record<string, string | undefined>;
    };
    join(room: string): void;
    leave(room: string): void;
    emit(event: string, ...args: any[]): boolean;
    to(room: string): { emit(event: string, ...args: any[]): boolean };
    on(event: string, listener: (...args: any[]) => void): this;
  }

  class Server {
    constructor(server?: HttpServer, opts?: Record<string, any>);
    use(fn: (socket: Socket, next: (err?: Error) => void) => void): this;
    on(event: 'connection', listener: (socket: Socket) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
    to(room: string): { emit(event: string, ...args: any[]): boolean };
    emit(event: string, ...args: any[]): boolean;
  }

  export { Server, Socket };
}
