import { ArrowRight, ClipboardList, FileClock, Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../../services/apiClient';
import { Card, EmptyState, ErrorState, Skeleton, StatusBadge } from '../../../components/ui/primitives';
import { useCurrentConfig } from '../hooks/useAdminQueries';
import { displayValue, formatDateTime } from '../utils/format';

function DashboardSkeleton() {
  return (
    <div className="page-stack">
      <Skeleton className="skeleton-title" />
      <Skeleton className="skeleton-card" />
      <Skeleton className="skeleton-card" />
    </div>
  );
}

export function DashboardPage() {
  const current = useCurrentConfig();
  if (current.isLoading) return <DashboardSkeleton />;
  if (current.error instanceof ApiError && current.error.status === 404) {
    return (
      <div className="page-stack">
        <PageHeading />
        <EmptyState title="Активной конфигурации нет" description="Для игры пока не создана активная конфигурация." />
      </div>
    );
  }
  if (current.isError) return <ErrorState error={current.error} onRetry={() => void current.refetch()} />;
  if (!current.data) return null;
  const config = current.data;

  const boosterValues = [
    config.boosters.multiplierTier1Value,
    config.boosters.multiplierTier2Value,
    config.boosters.multiplierTier3Value,
    config.boosters.multiplierTier4Value,
  ].map((item) => `×${displayValue(item)}`).join(' · ');

  return (
    <div className="page-stack dashboard-page">
      <PageHeading />

      <Card className="dashboard-overview-card">
        <div className="dashboard-overview-card__header">
          <div>
            <span className="eyebrow">Текущая конфигурация</span>
            <div className="heading-status">
              <h2>{config.gameName}</h2>
              <StatusBadge status={config.status} />
            </div>
          </div>
          <Link className="button button--secondary button--sm" to="/admin/config">Изменить</Link>
        </div>

        <dl className="dashboard-facts">
          <div><dt>Версия</dt><dd>{config.revision}</dd></div>
          <div><dt>Новые раунды</dt><dd>{config.isActive ? 'Разрешены' : 'Запрещены'}</dd></div>
          <div><dt>Тип игры</dt><dd>Растущий коэффициент</dd></div>
          <div><dt>Создана</dt><dd>{formatDateTime(config.createdAt)}</dd></div>
          <div><dt>Создал</dt><dd>{config.createdBy}</dd></div>
          <div><dt>Активирована</dt><dd>{formatDateTime(config.activatedAt)}</dd></div>
        </dl>
      </Card>

      <section className="dashboard-section">
        <div className="section-heading-inline">
          <div>
            <h2>Основные значения</h2>
            <p>Параметры, которые чаще всего нужно проверить перед изменениями.</p>
          </div>
        </div>
        <div className="dashboard-metrics">
          <Metric label="Преимущество системы" value={displayValue(config.crash.alpha)} />
          <Metric label="Максимальный коэффициент" value={displayValue(config.crash.maxMultiplier)} />
          <Metric label="Частота обновления" value={displayValue(config.crash.fps)} />
          <Metric label="Очки за уровень" value={displayValue(config.points.pointsPerLine)} />
          <Metric label="Бонус за завершение" value={displayValue(config.points.pointsCashoutBonus)} />
          <Metric label="Множители бустера" value={boosterValues} wide />
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="section-title">Быстрые действия</h2>
        <div className="quick-actions">
          <QuickAction to="/admin/config" icon={<Settings2 size={19} />} title="Изменить конфигурацию" text="Проверить и сохранить новые значения." />
          <QuickAction to="/admin/versions" icon={<FileClock size={19} />} title="История версий" text="Сравнить версии или выполнить откат." />
          <QuickAction to="/admin/audit" icon={<ClipboardList size={19} />} title="Журнал действий" text="Посмотреть действия администраторов." />
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'dashboard-metric dashboard-metric--wide' : 'dashboard-metric'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PageHeading() {
  return (
    <div className="page-heading page-heading--compact">
      <div>
        <p className="eyebrow">Обзор</p>
        <h1>Состояние игры</h1>
        <p>Активная конфигурация и быстрый доступ к основным действиям.</p>
      </div>
    </div>
  );
}

function QuickAction({ to, icon, title, text }: { to: string; icon: ReactNode; title: string; text: string }) {
  return (
    <Link className="quick-action" to={to}>
      <span className="quick-action__icon">{icon}</span>
      <span><strong>{title}</strong><small>{text}</small></span>
      <ArrowRight size={17} aria-hidden="true" />
    </Link>
  );
}
