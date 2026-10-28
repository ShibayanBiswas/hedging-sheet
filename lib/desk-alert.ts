export type DeskAlertVariant = "info" | "warning" | "error";

export type DeskAlertOptions = {
  title?: string;
  variant?: DeskAlertVariant;
  /** A suggested fix shown under the message. */
  fix?: string;
  /** Extra buttons beside OK. */
  actions?: Array<{ label: string; onClick: () => void; testId?: string }>;
  /** Grouped lines under the message, such as invalid fields by section. */
  groups?: Array<{ title: string; items: string[] }>;
  /** Label of the closing button, OK by default. */
  okLabel?: string;
  /** Runs whenever the dialog closes, by any button or Escape. */
  onClose?: () => void;
};

type DeskAlertHandler = (message: string, options?: DeskAlertOptions) => void;

let handler: DeskAlertHandler | null = null;

/** Register the UI handler (called once by DeskDialogProvider). */
export function registerDeskAlert(next: DeskAlertHandler | null) {
  handler = next;
}

/** Show a styled desk dialog; falls back to window.alert before hydration. */
export function deskAlert(message: string, options?: DeskAlertOptions) {
  if (handler) {
    handler(message, options);
    return;
  }
  window.alert(options?.title ? `${options.title}\n\n${message}` : message);
}
