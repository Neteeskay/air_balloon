import { FormEvent, useState } from 'react';
import backgroundAsset from '../assets/login-background.png';
import balloon from '../assets/red-balloon.png';
import logo from '../assets/air-balloon-logo.png';
import mailIcon from '../assets/icons/mail.svg';
import lockIcon from '../assets/icons/lock-alt.svg';
import eyeShowIcon from '../assets/icons/eye-show.svg';
import eyeOffIcon from '../assets/icons/eye-off.svg';
import { mockLogin } from '../services/mockAuth';

void backgroundAsset;

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const result = await mockLogin({ login, password });
    setBusy(false);
    setSuccess(result.ok);
    setMessage(result.message);
  };

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
  };

  return (
    <main className="auth-page" aria-label="Вход в Воздушный шар">
      <button className="back-button" type="button" onClick={goBack} aria-label="Назад">
        <span className="back-button__arrow" aria-hidden="true">←</span>
        <span>Назад</span>
      </button>

      <section className="hero" aria-label="Приветствие">
        <img className="hero__balloon" src={balloon} alt="" aria-hidden="true" />
        <div className="hero__copy">
          <h1>Поднимайся выше!</h1>
        </div>
      </section>

      <section className={`auth-card${message ? ' auth-card--with-message' : ''}`} aria-label="Форма входа">
        <img className="brand-logo" src={logo} alt="Воздушный шар" />

        <div className="auth-content">
          <h2>С возвращением</h2>
          <p className="auth-subtitle">Продолжи свой полёт.</p>

          <form className="auth-form" onSubmit={submit} noValidate>
            <label className="field field--accent">
              <img src={mailIcon} className="field__icon" alt="" aria-hidden="true" />
              <input
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                placeholder="Email / логин"
                autoComplete="username"
                aria-label="Email или логин"
              />
            </label>

            <label className="field">
              <img src={lockIcon} className="field__icon" alt="" aria-hidden="true" />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                placeholder="Пароль"
                autoComplete="current-password"
                aria-label="Пароль"
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                <img src={showPassword ? eyeOffIcon : eyeShowIcon} alt="" aria-hidden="true" />
              </button>
            </label>

            <button className="submit-button" type="submit" disabled={busy}>
              <span>{busy ? 'Входим…' : 'Войти'}</span>
              {!busy && <span className="submit-button__arrow" aria-hidden="true">→</span>}
            </button>
          </form>
        </div>

        {message && (
          <div className={`auth-message ${success ? 'auth-message--success' : ''}`} role="status">
            {message}
          </div>
        )}
      </section>
    </main>
  );
}
