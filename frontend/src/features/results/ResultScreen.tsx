import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  BarChart3,
  Coins,
  Menu,
  Mountain,
  Play,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Snowflake,
  UserRound,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { PlayerCharacterCode, ResultScreenActions, ResultScreenData } from '../../types/result';
import { getResultBalloon, resultAssets } from './resultAssets';
import './ResultScreen.css';

export interface ResultScreenProps {
  data: ResultScreenData;
  actions: ResultScreenActions;
  autoReturnSeconds?: number;
}

const formatAmount = (value: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.abs(value));

const formatBalance = (value: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);

const formatMultiplier = (value: number) => `×${value.toFixed(2)}`;

const characterIcons: Record<PlayerCharacterCode, LucideIcon> = {
  CAUTIOUS: ShieldCheck,
  COLD_BLOODED: Snowflake,
  CLOSE_CALL: Zap,
  BOOSTER_HUNTER: Rocket,
  GREEDY: Coins,
  ADVENTURER: Mountain,
};

export function ResultScreen({ data, actions, autoReturnSeconds = 10 }: ResultScreenProps) {
  const [secondsLeft, setSecondsLeft] = useState(autoReturnSeconds);
  const [repeatPending, setRepeatPending] = useState(false);
  const [actionError, setActionError] = useState('');
  const autoReturnFired = useRef(false);
  const userInteracted = useRef(false);
  const isWin = data.result === 'win';

  useEffect(() => {
    setSecondsLeft(autoReturnSeconds);
    setRepeatPending(false);
    setActionError('');
    autoReturnFired.current = false;
    userInteracted.current = false;
  }, [autoReturnSeconds, data.roundId, data.result, data.theme]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (secondsLeft !== 0 || autoReturnFired.current || userInteracted.current) return;
    autoReturnFired.current = true;
    actions.onAutoReturn(data.theme);
  }, [actions, data.theme, secondsLeft]);

  const display = useMemo(() => {
    if (isWin) {
      return {
        headline: `+${formatAmount(data.payoutAmount ?? 0)}`,
        sublineLead: 'Вы забрали на коэффициенте',
        sublineValue: formatMultiplier(data.cashoutMultiplier ?? 0),
        potential: formatMultiplier(data.potentialMaxMultiplier ?? data.crashMultiplier),
      };
    }

    return {
      headline: `-${formatAmount(data.betAmount)}`,
      sublineLead: 'Шар лопнул на',
      sublineValue: formatMultiplier(data.crashMultiplier),
      potential: '',
    };
  }, [data, isWin]);

  const balloon = getResultBalloon(data.theme, data.result);
  const fragmentAwarded = data.reward.count > 0;
  const CharacterIcon = data.playerCharacter ? characterIcons[data.playerCharacter.code] : null;

  const markInteraction = () => {
    userInteracted.current = true;
  };

  const handleRepeatBet = async () => {
    markInteraction();
    setActionError('');
    setRepeatPending(true);
    try {
      await actions.onRepeatBet(data.theme);
    } catch {
      setActionError('Не удалось повторить ставку. Проверьте баланс и попробуйте снова.');
    } finally {
      setRepeatPending(false);
    }
  };

  return (
    <main
      className={`result-screen result-screen--${data.result}`}
      data-theme={data.theme}
      style={{ '--result-bg': `url("${resultAssets.background}")` } as CSSProperties}
    >
      <div className="result-screen__background" aria-hidden="true" />
      <div className="result-screen__veil" aria-hidden="true" />

      <div className="result-screen__ambient" aria-hidden="true">
        <img className="ambient-balloon ambient-balloon--one" src={resultAssets.balloons.green.win} alt="" />
        <img className="ambient-balloon ambient-balloon--two" src={resultAssets.balloons.red.win} alt="" />
        <img className="ambient-balloon ambient-balloon--three" src={resultAssets.balloons.green.win} alt="" />
      </div>

      <header className="result-hud" aria-label="Профиль игрока">
        <div className="result-hud__pill">
          <button className="result-hud__player result-hud__profile" type="button" onClick={() => { markInteraction(); actions.onProfile?.(); }} aria-label="Открыть профиль">
            <UserRound size={19} strokeWidth={2.5} aria-hidden="true" />
            <span>{data.playerName}</span>
          </button>
          <div className="result-hud__balance">
            <img src={resultAssets.coin} alt="" />
            <span>{formatBalance(data.bonusBalance)}</span>
          </div>
        </div>
        <button className="result-hud__menu" type="button" onClick={() => { markInteraction(); actions.onMenu?.(); }} aria-label="Открыть меню">
          <Menu size={24} strokeWidth={2.8} aria-hidden="true" />
        </button>
      </header>

      <div className={`result-balloon-wrap result-balloon-wrap--${data.result}`} aria-hidden="true">
        <img className="result-balloon" src={balloon} alt="" />
        {!isWin && (
          <>
            <span className="result-balloon__smoke result-balloon__smoke--one" />
            <span className="result-balloon__smoke result-balloon__smoke--two" />
            <span className="result-balloon__spark result-balloon__spark--one" />
            <span className="result-balloon__spark result-balloon__spark--two" />
            <span className="result-balloon__spark result-balloon__spark--three" />
          </>
        )}
      </div>

      <section className="result-card" aria-labelledby="result-title">
        <img
          className="result-card__ribbon"
          src={isWin ? resultAssets.ribbons.win : resultAssets.ribbons.loss}
          alt={isWin ? 'Победа' : 'Шар лопнул'}
        />

        {isWin && (
          <div className="result-card__confetti" aria-hidden="true">
            <span /><span /><span /><span />
          </div>
        )}

        <div className="result-card__intro" id="result-title">
          {isWin ? 'Полёт удался' : 'В этот раз не успели'}
        </div>

        <div className={`result-card__amount ${isWin ? 'is-win' : 'is-loss'}`}>
          <strong>{display.headline}</strong>
          <img src={resultAssets.coin} alt="бонусов" />
        </div>

        <div className={`result-card__multiplier-line ${isWin ? '' : 'result-card__multiplier-line--loss'}`}>
          <span>{display.sublineLead}</span>
          <strong>{display.sublineValue}</strong>
        </div>

        {data.playerCharacter && CharacterIcon && (
          <section
            className={`result-character result-character--${data.playerCharacter.code.toLowerCase().replaceAll('_', '-')}`}
            aria-labelledby="player-character-title"
            data-testid="player-character"
          >
            <div className="result-character__icon" aria-hidden="true">
              <CharacterIcon size={28} strokeWidth={2.5} />
            </div>
            <div className="result-character__copy">
              <span>Характер этого полёта</span>
              <strong id="player-character-title">{data.playerCharacter.title}</strong>
              <p>{data.playerCharacter.description}</p>
            </div>
          </section>
        )}

        {isWin && (
          <div className="result-info result-info--potential">
            <div className="result-info__icon result-info__icon--gold">
              <BarChart3 size={35} strokeWidth={2.8} aria-hidden="true" />
            </div>
            <div className="result-info__text">
              <strong>Можно было подняться ещё выше</strong>
              <span>Шар долетел до <b>{display.potential}</b></span>
            </div>
          </div>
        )}

        <div className="result-rewards">
          <div className="result-reward result-reward--points">
            <img src={resultAssets.trophy} alt="" />
            <div>
              <strong>+{formatAmount(data.earnedPoints)}</strong>
              <span>ОЧКОВ</span>
            </div>
          </div>
          <div className="result-rewards__divider" aria-hidden="true" />
          <div
            className={`result-reward result-reward--fragment${fragmentAwarded ? '' : ' is-unearned'}`}
            data-testid="fragment-reward"
          >
            <img src={resultAssets.puzzle} alt="" />
            <div>
              <span>{data.reward.label ?? 'Фрагмент не получен'}</span>
              <strong>
                {fragmentAwarded
                  ? `${data.reward.collectedFragments ?? data.reward.count} / ${data.reward.totalFragments ?? '—'}`
                  : '×0'}
              </strong>
            </div>
          </div>
        </div>

        {data.reward.puzzleCompleted && data.reward.clothingReward && (
          <div className="result-unlock" role="status">
            <img src={data.reward.clothingReward.id === 'CLOUD_SCARF' ? '/assets/avatar/rendered-aviator-cloud-scarf-v3.png' : resultAssets.puzzle} alt={data.reward.clothingReward.name} />
            <div><strong>Пазл собран!</strong><span>Открыт новый предмет: {data.reward.clothingReward.name}</span></div>
            <button type="button" onClick={() => { markInteraction(); actions.onProfile?.(); }}>В профиль</button>
          </div>
        )}

        <div className="result-actions">
          <button className="result-button result-button--primary" type="button" onClick={() => { markInteraction(); actions.onPlayAgain(data.theme); }}>
            <Play size={23} fill="currentColor" strokeWidth={2.1} aria-hidden="true" />
            <span>Играть снова</span>
          </button>
          <button
            className="result-button result-button--secondary"
            type="button"
            onClick={handleRepeatBet}
            disabled={!data.canRepeatBet || repeatPending}
            title={data.canRepeatBet ? undefined : 'Повтор ставки сейчас недоступен'}
          >
            <RotateCcw size={20} strokeWidth={2.5} aria-hidden="true" />
            <span>{repeatPending ? 'Повторяем…' : 'Повторить ставку'}</span>
          </button>
          {actionError && <p className="result-action-error" role="alert">{actionError}</p>}
          <button className="result-home" type="button" onClick={() => { markInteraction(); actions.onHome(); }}>На главную</button>
          <p className="result-countdown" aria-live="polite">Автовозврат через {secondsLeft} сек.</p>
        </div>
      </section>
    </main>
  );
}
