import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..');

export interface PythonNlpAnalysis {
  text: string;
  intent: string;
  confidence: number;
  language: string;
  languageCode: string;
  script: string;
  entities: {
    resolvedDate: string | null;
    dateLabel: string | null;
    dayPeriod: string | null;
    time24h: string | null;
    durationMinutes: number;
    wantsGoogleMeet: boolean;
    matchedCues: string[];
  };
  latencyMs: number;
}

export interface PythonSlotSuggestion {
  startIso: string;
  endIso: string;
  label: string;
  rationale: string;
  rank: number;
}

export interface PythonSlotResponse {
  date: string;
  timeZone: string;
  durationMinutes: number;
  suggestions: PythonSlotSuggestion[];
  totalFreeFound: number;
  latencyMs: number;
}

export interface PythonEngineStatus {
  status: string;
  pythonVersion: string;
  pid: number | null;
  uptimeSeconds: number;
  totalUtterancesAnalyzed: number;
  averageLatencyMs: number;
  slotOptimizationsRun: number;
  intentCounts: Record<string, number>;
  languageCounts: Record<string, number>;
}

interface PendingCall {
  resolve: (value: any) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

class PythonBridge {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private rl: readline.Interface | null = null;
  private pending = new Map<string, PendingCall>();
  private nextId = 1;
  private readyInfo: { pythonVersion: string; pid: number } | null = null;
  private startPromise: Promise<void> | null = null;

  public async ensureStarted(): Promise<void> {
    if (this.proc && !this.proc.killed && this.readyInfo) {
      return;
    }
    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = new Promise<void>((resolve) => {
      const workerPath = path.join(WORKSPACE_ROOT, 'python_backend', 'ipc_worker.py');
      try {
        const proc = spawn('python3', ['-u', workerPath], {
          cwd: WORKSPACE_ROOT,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.proc = proc;

        const rl = readline.createInterface({ input: proc.stdout });
        this.rl = rl;

        const startupTimeout = setTimeout(() => {
          resolve();
        }, 3000);

        rl.on('line', (line) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          try {
            const msg = JSON.parse(trimmed);
            if (msg.type === 'ready') {
              clearTimeout(startupTimeout);
              this.readyInfo = {
                pythonVersion: String(msg.pythonVersion || '3.10'),
                pid: Number(msg.pid || proc.pid || 0),
              };
              resolve();
              return;
            }
            if (msg.id && this.pending.has(String(msg.id))) {
              const entry = this.pending.get(String(msg.id))!;
              this.pending.delete(String(msg.id));
              clearTimeout(entry.timer);
              if (msg.ok) {
                entry.resolve(msg.result);
              } else {
                entry.reject(new Error(msg.error || 'Python worker error'));
              }
            }
          } catch {
            // Ignore malformed stdout lines
          }
        });

        proc.stderr.on('data', (chunk) => {
          const errStr = chunk.toString().trim();
          if (errStr) {
            console.error('[PythonEngine]', errStr);
          }
        });

        proc.on('exit', () => {
          this.proc = null;
          this.readyInfo = null;
          this.startPromise = null;
          if (this.rl) {
            this.rl.close();
            this.rl = null;
          }
          for (const [, call] of this.pending.entries()) {
            clearTimeout(call.timer);
            call.reject(new Error('Python engine exited unexpectedly'));
          }
          this.pending.clear();
        });
      } catch {
        this.startPromise = null;
        resolve();
      }
    });

    return this.startPromise;
  }

  private async invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    await this.ensureStarted();
    if (!this.proc || !this.proc.stdin.writable) {
      throw new Error('Python NLP worker is unavailable.');
    }

    const id = String(this.nextId++);
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Python action "${action}" timed out.`));
      }, 4000);

      this.pending.set(id, { resolve, reject, timer });
      this.proc!.stdin.write(`${JSON.stringify({ id, action, params })}\n`);
    });
  }

  public async analyzeUtterance(
    text: string,
    languageHint = 'auto',
    timeZone = 'Asia/Kolkata'
  ): Promise<PythonNlpAnalysis | null> {
    try {
      return await this.invoke<PythonNlpAnalysis>('analyze', {
        text,
        languageHint,
        timeZone,
      });
    } catch {
      return null;
    }
  }

  public async suggestSlots(params: {
    busySlots: Array<{ start: string; end: string }>;
    targetDate?: string;
    durationMinutes?: number;
    timeZone?: string;
    maxSuggestions?: number;
  }): Promise<PythonSlotResponse> {
    return this.invoke<PythonSlotResponse>('suggest_slots', params);
  }

  public async getStatus(): Promise<PythonEngineStatus> {
    try {
      return await this.invoke<PythonEngineStatus>('status');
    } catch {
      return {
        status: 'offline',
        pythonVersion: 'unavailable',
        pid: null,
        uptimeSeconds: 0,
        totalUtterancesAnalyzed: 0,
        averageLatencyMs: 0,
        slotOptimizationsRun: 0,
        intentCounts: {},
        languageCounts: {},
      };
    }
  }
}

export const pythonBridge = new PythonBridge();
