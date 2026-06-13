import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title = "삭제",
  message,
  confirmLabel = "삭제",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-[280px] rounded-xl border bg-card p-4 shadow-xl">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {message}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
