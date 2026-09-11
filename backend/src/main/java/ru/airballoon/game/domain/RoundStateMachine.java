package ru.airballoon.game.domain;

public final class RoundStateMachine {
    public RoundStatus transition(RoundStatus from, RoundStatus to) {
        boolean allowed = switch (from) {
            case CREATED -> to == RoundStatus.RUNNING;
            case RUNNING -> to == RoundStatus.CASHED_OUT || to == RoundStatus.CRASHED;
            case CASHED_OUT -> to == RoundStatus.CRASHED;
            case CRASHED -> to == RoundStatus.FINISHED;
            case FINISHED -> false;
        };
        if (!allowed) throw new GameException(GameError.ROUND_NOT_RUNNING,
                "Illegal round transition: " + from + " -> " + to);
        return to;
    }
}
