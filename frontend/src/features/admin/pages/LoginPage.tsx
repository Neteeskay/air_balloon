import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Alert, Button, Input } from '../../../components/ui/primitives';
import { ApiError } from '../../../services/apiClient';
import { useAuth } from '../auth/AuthProvider';

const schema = z.object({
  username: z.string().trim().min(1, 'Введите имя пользователя').max(120, 'Слишком длинное имя пользователя'),
  password: z.string().min(1, 'Введите пароль').max(256, 'Слишком длинный пароль'),
});
type LoginValues = z.infer<typeof schema>;

function safeReturnPath(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/admin') && !value.startsWith('/admin/login')
    ? value
    : '/admin';
}

export function LoginPage() {
  const { session, login, sessionMessage, clearSessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(schema) });

  const locationState = location.state as { from?: unknown } | null;
  const returnPath = safeReturnPath(locationState?.from);

  if (session) return <Navigate to={returnPath} replace />;

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    clearSessionMessage();
    try {
      await login(values);
      navigate(returnPath, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        setServerError('Неверное имя пользователя или пароль.');
      } else if (error instanceof ApiError && error.status === 0) {
        setServerError('Не удалось связаться с сервером. Проверьте подключение и повторите попытку.');
      } else {
        setServerError('Не удалось войти. Проверьте данные и повторите попытку.');
      }
    }
  });

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-card__header">
          <span className="app-mark" aria-hidden="true">ВШ</span>
          <div>
            <p className="eyebrow">Административная панель</p>
            <h1>Воздушный Шар</h1>
            <p>Войдите с учётной записью администратора.</p>
          </div>
        </div>
        {sessionMessage ? <Alert title={sessionMessage} tone="warning" /> : null}
        {serverError ? <Alert title={serverError} tone="danger" /> : null}
        <form className="login-form" onSubmit={(event) => void submit(event)} noValidate>
          <div className="form-field">
            <label className="form-field__label" htmlFor="username">Имя пользователя</label>
            <Input
              id="username"
              autoComplete="username"
              aria-invalid={Boolean(errors.username)}
              aria-describedby={errors.username ? 'username-error' : undefined}
              {...register('username')}
            />
            {errors.username ? <p id="username-error" className="field-error">{errors.username.message}</p> : null}
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="password">Пароль</label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            {errors.password ? <p id="password-error" className="field-error">{errors.password.message}</p> : null}
          </div>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Входим…' : 'Войти'}
          </Button>
        </form>
      </div>
    </main>
  );
}
