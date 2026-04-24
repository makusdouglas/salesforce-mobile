export type SyncLogEntry = {
  id: string;
  timestamp: number;
  type: 'info' | 'error' | 'conflict';
  message: string;
  details?: unknown;
};

class SyncLogger {
  private entries: SyncLogEntry[] = [];
  private listeners = new Set<() => void>();

  log(type: SyncLogEntry['type'], message: string, details?: unknown) {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    
    this.entries.unshift({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      type,
      message,
      details,
    });
    
    if (this.entries.length > 100) {
      this.entries.pop();
    }
    this.emit();
  }

  clear() {
    this.entries = [];
    this.emit();
  }

  getSnapshot(): SyncLogEntry[] {
    return this.entries;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const syncLogger = new SyncLogger();
