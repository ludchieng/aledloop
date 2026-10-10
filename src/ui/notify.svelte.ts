export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

let nextId = 1;

class Toasts {
  list = $state<Toast[]>([]);

  show(message: string, action?: Toast['action'], duration = 3500) {
    const id = nextId++;
    // Un seul toast identique à la fois (ex. l'astuce du crayon répétée).
    this.list = [...this.list.filter((t) => t.message !== message), { id, message, action }].slice(-3);
    setTimeout(() => this.dismiss(id), duration);
  }

  dismiss(id: number) {
    this.list = this.list.filter((t) => t.id !== id);
  }
}

export const toasts = new Toasts();
