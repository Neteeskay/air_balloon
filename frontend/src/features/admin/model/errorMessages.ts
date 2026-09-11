import { ApiError } from '../../../services/apiClient';

export interface FriendlyError {
  title: string;
  message: string;
  code?: string;
  traceId?: string;
}

export function mapApiError(error: unknown): FriendlyError {
  if (!(error instanceof ApiError)) {
    return { title: 'Не удалось выполнить действие', message: 'Произошла непредвиденная ошибка.' };
  }
  const common = { code: error.code, traceId: error.traceId };
  if (error.status === 0) {
    return {
      title: 'Нет соединения с сервером',
      message: 'Проверьте подключение и доступность сервера, затем повторите попытку.',
      ...common,
    };
  }
  if (error.status === 401) {
    return { title: 'Сессия истекла', message: 'Войдите снова, чтобы продолжить.', ...common };
  }
  if (error.status === 403) {
    return {
      title: 'Недостаточно прав',
      message: 'Эта операция доступна только администратору с нужными правами.',
      ...common,
    };
  }
  if (error.status === 404) {
    return { title: 'Данные не найдены', message: 'Запрошенный ресурс не существует.', ...common };
  }
  if (error.code === 'CONFIG_VERSION_CONFLICT') {
    return {
      title: 'Конфигурация уже была изменена',
      message: 'Другой администратор сохранил более новую версию. Загрузите актуальные данные.',
      ...common,
    };
  }
  if (error.code === 'CONFIG_ALREADY_ACTIVE') {
    return { title: 'Версия уже активна', message: 'Дополнительная активация не требуется.', ...common };
  }
  if (error.code === 'CONFIG_ACTIVATION_FAILED') {
    return {
      title: 'Версию нельзя активировать',
      message: 'Активировать можно только корректный черновик.',
      ...common,
    };
  }
  if (error.code === 'CONFIG_VALIDATION_ERROR' || error.status === 400) {
    return {
      title: 'Проверьте введённые значения',
      message: 'Исправьте отмеченные поля и повторите проверку.',
      ...common,
    };
  }
  if (error.status >= 500) {
    return {
      title: 'Ошибка сервера',
      message: 'Повторите попытку. Если ошибка сохраняется, сообщите код обращения.',
      ...common,
    };
  }
  return {
    title: 'Не удалось выполнить действие',
    message: error.message || 'Повторите попытку.',
    ...common,
  };
}
