import { useEffect } from 'react';
import { useWiredInStore } from '../store';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

export interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const icons = {
  success: CheckCircle,
  error: AlertTriangle,
  info: Info,
};

function ToastItem({ toast }: { toast: ToastData }) {
  const removeToast = useWiredInStore((s) => s.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  const Icon = icons[toast.type];

  return (
    <div className={`toast toast--${toast.type}`}>
      <Icon size={16} className="toast__icon" />
      <span className="toast__message">{toast.message}</span>
      <button className="toast__close" onClick={() => removeToast(toast.id)}>
        <X size={14} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useWiredInStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
