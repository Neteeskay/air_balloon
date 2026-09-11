import type { ConfigMetadataResponse, GameConfigurationResponse } from '../../../types/admin';
import { labelForField } from '../model/configModel';
import { displayValue } from '../utils/format';

function Item({ name, value, metadata }: { name: string; value: unknown; metadata?: ConfigMetadataResponse }) {
  const shown = name === 'gameType' && value === 'CRASH' ? 'Игра с растущим коэффициентом' : displayValue(value);
  return <div className="readonly-item"><dt>{labelForField(name, metadata)}</dt><dd>{shown}</dd></div>;
}

export function ReadonlyConfig({ config, metadata }: { config: GameConfigurationResponse; metadata?: ConfigMetadataResponse }) {
  return (
    <div className="readonly-sections">
      <section><h3>Основные</h3><dl className="readonly-grid">
        <Item name="gameId" value={config.gameId} metadata={metadata} />
        <Item name="gameName" value={config.gameName} metadata={metadata} />
        <Item name="gameType" value={config.gameType} metadata={metadata} />
        <Item name="isActive" value={config.isActive} metadata={metadata} />
      </dl></section>
      <section><h3>Модель коэффициента</h3><dl className="readonly-grid">
        {Object.entries(config.crash).map(([key, value]) => <Item key={key} name={`crash.${key}`} value={value} metadata={metadata} />)}
      </dl></section>
      <section><h3>Бустеры</h3><dl className="readonly-grid">
        {Object.entries(config.boosters).filter(([key]) => key !== 'green' && key !== 'red').map(([key, value]) => <Item key={key} name={`boosters.${key}`} value={value} metadata={metadata} />)}
      </dl>
      <div className="readonly-probability-grid">
        <div><h4>Зелёный</h4><dl>{Object.entries(config.boosters.green).map(([key, value]) => <Item key={key} name={`boosters.green.${key}`} value={value} metadata={metadata} />)}</dl></div>
        <div><h4>Красный</h4><dl>{Object.entries(config.boosters.red).map(([key, value]) => <Item key={key} name={`boosters.red.${key}`} value={value} metadata={metadata} />)}</dl></div>
      </div></section>
      <section><h3>Очки</h3><dl className="readonly-grid">
        {Object.entries(config.points).map(([key, value]) => <Item key={key} name={`points.${key}`} value={value} metadata={metadata} />)}
      </dl></section>
    </div>
  );
}
