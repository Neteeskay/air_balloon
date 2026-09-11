import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { mapApiError } from '../../features/admin/model/errorMessages';

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn('button', `button--${variant}`, `button--${size}`, className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn('input', className)} {...props} />,
);
Input.displayName = 'Input';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('card', className)}>{children}</section>;
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'accent';
}) {
  return <span className={cn('badge', `badge--${tone}`)}>{children}</span>;
}

export function Alert({
  title,
  children,
  tone = 'info',
  actions,
}: {
  title: string;
  children?: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  actions?: ReactNode;
}) {
  return (
    <div className={cn('alert', `alert--${tone}`)} role={tone === 'danger' ? 'alert' : 'status'}>
      <div className="alert__icon" aria-hidden="true">
        {tone === 'warning' || tone === 'danger' ? <AlertTriangle size={18} /> : null}
      </div>
      <div className="alert__content">
        <strong>{title}</strong>
        {children ? <div className="alert__body">{children}</div> : null}
      </div>
      {actions ? <div className="alert__actions">{actions}</div> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === 'ACTIVE' ? 'success' : status === 'DRAFT' ? 'warning' : 'neutral';
  const label = status === 'ACTIVE' ? 'Активна' : status === 'DRAFT' ? 'Черновик' : status === 'ARCHIVED' ? 'Архив' : status;
  return <Badge tone={tone}>{label}</Badge>;
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content className="dialog-content">
          <div className="dialog-header">
            <div>
              <DialogPrimitive.Title className="dialog-title">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="dialog-description">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close className="icon-button" aria-label="Закрыть">
              <X size={18} />
            </DialogPrimitive.Close>
          </div>
          <div className="dialog-body">{children}</div>
          {footer ? <div className="dialog-footer">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function Drawer({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content className="drawer-content">
          <div className="dialog-header">
            <DialogPrimitive.Title className="dialog-title">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close className="icon-button" aria-label="Закрыть меню">
              <X size={18} />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <SwitchPrimitive.Root
      className="switch"
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <SwitchPrimitive.Thumb className="switch__thumb" />
    </SwitchPrimitive.Root>
  );
}

export const Tabs = TabsPrimitive.Root;
export const TabsList = TabsPrimitive.List;
export const TabsTrigger = TabsPrimitive.Trigger;
export const TabsContent = TabsPrimitive.Content;

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content className="tooltip" sideOffset={6}>
            {content}
            <TooltipPrimitive.Arrow className="tooltip-arrow" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export function HelpTooltip({ text }: { text: string }) {
  return (
    <Tooltip content={text}>
      <button type="button" className="help-button" aria-label="Подсказка">
        <HelpCircle size={16} />
      </button>
    </Tooltip>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="state-card">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const friendly = mapApiError(error);
  return (
    <div className="state-card state-card--error" role="alert">
      <h2>{friendly.title}</h2>
      <p>{friendly.message}</p>
      {friendly.traceId ? <p className="technical-text">Код обращения: {friendly.traceId}</p> : null}
      {onRetry ? <Button onClick={onRetry}>Повторить</Button> : null}
    </div>
  );
}

export function FormField({
  label,
  technicalName,
  description,
  required,
  error,
  htmlFor,
  errorId,
  children,
}: {
  label: string;
  technicalName?: string;
  description?: string | null;
  required?: boolean;
  error?: string;
  htmlFor?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div className="form-field">
      <div className="form-field__label-row">
        <label className="form-field__label" htmlFor={htmlFor}>
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </label>
        {description ? <HelpTooltip text={description} /> : null}
      </div>
      {technicalName ? <code className="technical-name">{technicalName}</code> : null}
      {children}
      {error ? <p className="field-error" id={errorId}>{error}</p> : null}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Пагинация">
      <Button size="sm" disabled={page <= 0} onClick={() => onPageChange(page - 1)}>
        Назад
      </Button>
      <span>
        Страница {page + 1} из {totalPages}
      </span>
      <Button size="sm" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
        Вперёд
      </Button>
    </nav>
  );
}
