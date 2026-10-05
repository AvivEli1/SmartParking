// Minimal Web Serial API typings (not yet part of TypeScript's lib.dom).
interface SerialOptions {
  baudRate: number;
}

interface SerialPort extends EventTarget {
  readonly readable: ReadableStream<Uint8Array> | null;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
}

interface Serial extends EventTarget {
  requestPort(): Promise<SerialPort>;
}

interface Navigator {
  readonly serial?: Serial;
}
