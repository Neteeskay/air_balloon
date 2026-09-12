import { ResultScreen } from '../features/results';
import type { ResultScreenActions, ResultScreenData } from '../types/result';

interface AppProps {
  resultData?: ResultScreenData;
  actions?: ResultScreenActions;
}

export function App({ resultData, actions }: AppProps) {
  if (!resultData || !actions) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        ResultScreen готов к интеграции: передайте завершённый раунд и navigation/actions после события crash.
      </div>
    );
  }

  return <ResultScreen data={resultData} actions={actions} />;
}
