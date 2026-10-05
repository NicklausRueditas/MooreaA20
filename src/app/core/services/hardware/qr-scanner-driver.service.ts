import { Injectable, signal } from '@angular/core';
import { Subject, Observable } from 'rxjs';

/**
 * Estado y metadatos del dispositivo lector de códigos QR / barras
 */
export interface ScannerDriverDevice {
  type: 'hid_keyboard' | 'web_hid' | 'web_serial';
  name: string;
  vendorId?: string | number;
  productId?: string | number;
  connectedAt: Date;
}

/**
 * Servicio encargado de gestionar la comunicación, captura y conexión de drivers
 * con máquinas lectoras físicas de códigos QR y códigos de barras (pistolas USB, escáneres POS, Bluetooth o WebHID/Serial).
 */
@Injectable({
  providedIn: 'root',
})
export class QrScannerDriverService {
  // ─── Señales Reactivas de Estado ──────────────────────────────────────────
  readonly isListening = signal<boolean>(false);
  readonly isDriverConnected = signal<boolean>(false);
  readonly activeDevice = signal<ScannerDriverDevice | null>(null);
  readonly lastScannedCode = signal<string | null>(null);

  // ─── Stream de Eventos de Escaneo ────────────────────────────────────────
  private readonly scanSubject = new Subject<string>();
  readonly onScan$: Observable<string> = this.scanSubject.asObservable();

  // ─── Buffer de Teclas para Lector Físico (Keyboard Wedge / HID) ─────────
  private keyBuffer = '';
  private lastKeyTimestamp = 0;
  private keydownListener: ((event: KeyboardEvent) => void) | null = null;
  private readonly SCANNER_TIMEOUT_MS = 60; // Típico intervalo entre pulsaciones de hardware (< 50ms)

  // ─── Contexto de Audio para Pitido de POS ────────────────────────────────
  private audioCtx: AudioContext | null = null;

  constructor() {}

  /**
   * Inicia el modo de escucha activa para capturar ráfagas de pulsaciones
   * provenientes de la pistola lectora de QR por emulación de teclado (HID Wedge).
   * @returns Observable que emite el código QR sanitizado cada vez que la máquina escanea
   */
  startHardwareListening(): Observable<string> {
    if (this.keydownListener) {
      this.stopHardwareListening();
    }

    this.isListening.set(true);
    this.keyBuffer = '';
    this.lastKeyTimestamp = 0;

    // Configurar el dispositivo activo como lector USB/HID estándar
    if (!this.activeDevice()) {
      this.activeDevice.set({
        type: 'hid_keyboard',
        name: 'Lector Óptico USB / Bluetooth (HID)',
        connectedAt: new Date(),
      });
      this.isDriverConnected.set(true);
    }

    this.keydownListener = (event: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - this.lastKeyTimestamp;
      this.lastKeyTimestamp = currentTime;

      // Si pasa demasiado tiempo entre caracteres, se trata de escritura manual del usuario; limpiamos buffer
      if (timeDiff > this.SCANNER_TIMEOUT_MS && this.keyBuffer.length > 0 && event.key !== 'Enter') {
        this.keyBuffer = '';
      }

      // El lector envía 'Enter' al terminar de leer el código QR
      if (event.key === 'Enter') {
        if (this.keyBuffer.trim().length >= 4) {
          event.preventDefault();
          event.stopPropagation();
          const cleanCode = this.extractPickupCode(this.keyBuffer.trim());
          this.playBeep('success');
          this.lastScannedCode.set(cleanCode);
          this.scanSubject.next(cleanCode);
          this.keyBuffer = '';
        }
      } else if (event.key.length === 1) {
        // Carácter alfanumérico imprimible
        this.keyBuffer += event.key;
      }
    };

    window.addEventListener('keydown', this.keydownListener, true);
    return this.onScan$;
  }

  /**
   * Detiene el modo de escucha activa del hardware y limpia el listener
   */
  stopHardwareListening(): void {
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener, true);
      this.keydownListener = null;
    }
    this.keyBuffer = '';
    this.isListening.set(false);
  }

  /**
   * Conecta con una máquina o pistola lectora mediante la WebHID API de Chromium
   * para escáneres con driver especializado directo por USB.
   * @returns Promesa con el resultado de la conexión y datos del dispositivo
   */
  async connectWebHidDriver(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    if (!('hid' in navigator)) {
      return {
        success: false,
        error: 'Tu navegador no soporta la API WebHID. El modo emulador de teclado (HID Wedge) sigue funcionando directamente.',
      };
    }

    try {
      const devices = await (navigator as any).hid.requestDevice({
        filters: [], // Permitir seleccionar cualquier dispositivo HID / Lector USB
      });

      if (!devices || devices.length === 0) {
        return { success: false, error: 'No se seleccionó ningún dispositivo lector.' };
      }

      const device = devices[0];
      await device.open();

      const deviceName = device.productName || 'Lector QR / Código de Barras USB';
      this.activeDevice.set({
        type: 'web_hid',
        name: deviceName,
        vendorId: device.vendorId,
        productId: device.productId,
        connectedAt: new Date(),
      });
      this.isDriverConnected.set(true);
      this.playBeep('success');

      // Escuchar eventos de entrada de datos HID
      device.addEventListener('inputreport', (event: any) => {
        const { data } = event;
        const decoder = new TextDecoder('utf-8');
        const rawText = decoder.decode(data).replace(/\0/g, '').trim();
        if (rawText) {
          const code = this.extractPickupCode(rawText);
          this.playBeep('success');
          this.lastScannedCode.set(code);
          this.scanSubject.next(code);
        }
      });

      return { success: true, deviceName };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Error al conectar con el driver USB del lector.',
      };
    }
  }

  /**
   * Conecta con un lector que use driver Virtual COM Port (VCP / Serial) mediante Web Serial API
   * @param baudRate Tasa de baudios configurada en el lector (default 9600)
   * @returns Promesa con el estado de conexión
   */
  async connectWebSerialDriver(baudRate = 9600): Promise<{ success: boolean; error?: string }> {
    if (!('serial' in navigator)) {
      return {
        success: false,
        error: 'Tu navegador no soporta Web Serial API. Se utilizará el modo estándar USB HID.',
      };
    }

    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });

      this.activeDevice.set({
        type: 'web_serial',
        name: `Lector Serie / VCP (Baud ${baudRate})`,
        connectedAt: new Date(),
      });
      this.isDriverConnected.set(true);
      this.playBeep('success');

      // Iniciar lectura en segundo plano del flujo serial
      this.readFromSerialPort(port);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'No se pudo abrir el puerto serie del lector.',
      };
    }
  }

  /**
   * Lee continuamente el stream de bytes desde un puerto serial abierto
   * @param port Instancia del puerto serial conectado
   */
  private async readFromSerialPort(port: any): Promise<void> {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    let serialBuffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          serialBuffer += value;
          if (serialBuffer.includes('\n') || serialBuffer.includes('\r')) {
            const raw = serialBuffer.replace(/[\r\n]/g, '').trim();
            serialBuffer = '';
            if (raw.length >= 4) {
              const code = this.extractPickupCode(raw);
              this.playBeep('success');
              this.lastScannedCode.set(code);
              this.scanSubject.next(code);
            }
          }
        }
      }
    } catch {
      // Flujo cerrado o desconectado
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Extrae y normaliza el código de retiro (ej. PKP-8F3X2K) a partir del texto escaneado.
   * Maneja URLs completas, parámetros ?code= o JSON emitidos por el QR.
   * @param raw Cadena de texto cruda leída del QR
   * @returns Código alfanumérico limpio en mayúsculas
   */
  extractPickupCode(raw: string): string {
    if (!raw) return '';
    const clean = raw.trim();

    // 1. Si contiene el patrón directo PKP-XXXXXX
    const directMatch = clean.match(/PKP-[A-Z0-9]{4,12}/i);
    if (directMatch) {
      return directMatch[0].toUpperCase();
    }

    // 2. Si es una URL con parámetro code= (ej. https://moorea.pe/orders/verify?code=PKP-123456)
    try {
      if (clean.startsWith('http://') || clean.startsWith('https://')) {
        const url = new URL(clean);
        const codeParam = url.searchParams.get('code') || url.searchParams.get('pickupCode');
        if (codeParam) {
          return codeParam.trim().toUpperCase();
        }
        // Buscar en el último segmento de la URL
        const segments = url.pathname.split('/').filter(Boolean);
        const lastSeg = segments[segments.length - 1];
        if (lastSeg && lastSeg.length >= 4) {
          return lastSeg.toUpperCase();
        }
      }
    } catch {
      // No era URL válida
    }

    // 3. Si viene encapsulado en JSON
    try {
      const obj = JSON.parse(clean);
      if (obj?.pickupCode) return String(obj.pickupCode).trim().toUpperCase();
      if (obj?.code) return String(obj.code).trim().toUpperCase();
    } catch {
      // No era JSON
    }

    // 4. Si es una cadena alfanumérica de código
    return clean.toUpperCase();
  }

  /**
   * Emula la lectura de un código para pruebas sin requerir la máquina física conectada
   * @param simulatedCode Código a simular (opcional, si no se pasa genera o usa el de la orden)
   */
  simulateScan(simulatedCode: string): void {
    const code = this.extractPickupCode(simulatedCode);
    this.playBeep('success');
    this.lastScannedCode.set(code);
    this.scanSubject.next(code);
  }

  /**
   * Emite un pitido acústico estilo caja registradora / terminal POS
   * @param type 'success' para lectura exitosa, 'error' para código inválido
   */
  playBeep(type: 'success' | 'error' = 'success'): void {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'success') {
        // Pitido agudo y corto característico de lector óptico (1800Hz, 85ms)
        osc.frequency.setValueAtTime(1850, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.085);
        osc.start(this.audioCtx.currentTime);
        osc.stop(this.audioCtx.currentTime + 0.085);
      } else {
        // Pitido grave de error (400Hz, 180ms)
        osc.frequency.setValueAtTime(420, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.18);
        osc.start(this.audioCtx.currentTime);
        osc.stop(this.audioCtx.currentTime + 0.18);
      }
    } catch {
      // AudioContext bloqueado o no soportado
    }
  }
}
