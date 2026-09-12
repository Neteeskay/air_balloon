package ru.hackathon.airballoon.upsell;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.common.BusinessException;
import ru.hackathon.airballoon.config.GameConfigProvider;
import ru.hackathon.airballoon.game.GameRound;
import ru.hackathon.airballoon.game.RoundRepository;

/** Server-authoritative Scenario 8 offer and atomic purchase boundary. */
@Service
public class Scenario8OfferService {
    public record OfferView(UUID offerId, UUID roundId, long price, int ticketCount, long minWinAmount,
                            Instant expiresAt, String status) {}
    public record PurchaseResult(UUID offerId, UUID roundId, long price, int ticketCount,
                                 long bonusBalance, long lotteryTicketCount, boolean replayed) {}
    private static final long OFFER_TTL_SECONDS = 10 * 60;
    private final JdbcTemplate jdbc;
    private final RoundRepository rounds;
    private final GameConfigProvider configs;
    private final Clock clock;

    public Scenario8OfferService(JdbcTemplate jdbc, RoundRepository rounds, GameConfigProvider configs, Clock clock) {
        this.jdbc = jdbc; this.rounds = rounds; this.configs = configs; this.clock = clock;
    }

    @Transactional
    public OfferView offer(UUID userId, UUID roundId) {
        GameRound round = rounds.findById(roundId).orElseThrow(() -> BusinessException.missing("ROUND_NOT_FOUND"));
        if (!round.userId().equals(userId)) throw BusinessException.forbidden("NOT_OWNER", "Round belongs to another user");
        var existing = jdbc.query("SELECT * FROM scenario8_offers WHERE round_id=?", this::map, roundId);
        if (!existing.isEmpty()) return view(existing.getFirst());
        var config = configs.getCurrentConfig().config();
        if (!config.scenario8Enabled() || round.finishedAt() == null || round.cashoutAt() == null
                || round.winAmount() < config.scenario8MinWinAmount() || config.scenario8Price() <= 0
                || config.scenario8TicketCount() <= 0) return null;
        Instant expires = clock.instant().plusSeconds(OFFER_TTL_SECONDS);
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO scenario8_offers(id,user_id,round_id,price,ticket_count,min_win_amount,expires_at)
            VALUES (?,?,?,?,?,?,?) ON CONFLICT (round_id) DO NOTHING
            """, id, userId, roundId, config.scenario8Price(), config.scenario8TicketCount(),
            config.scenario8MinWinAmount(), java.sql.Timestamp.from(expires));
        return jdbc.query("SELECT * FROM scenario8_offers WHERE round_id=?", this::map, roundId)
                .stream().findFirst().map(this::view).orElseThrow();
    }

    @Transactional
    public PurchaseResult purchase(UUID userId, UUID offerId, String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 128)
            throw BusinessException.invalid("INVALID_IDEMPOTENCY_KEY", "Требуется корректный Idempotency-Key");
        var offers = jdbc.query("SELECT * FROM scenario8_offers WHERE id=? FOR UPDATE", this::map, offerId);
        if (offers.isEmpty()) throw BusinessException.missing("OFFER_NOT_FOUND");
        Offer offer = offers.getFirst();
        if (!offer.userId().equals(userId)) throw BusinessException.forbidden("NOT_OWNER", "Offer belongs to another user");
        if (offer.consumedAt() != null) {
            if (idempotencyKey.equals(offer.idempotencyKey()))
                return new PurchaseResult(offer.id(), offer.roundId(), offer.price(), offer.ticketCount(),
                        offer.balanceAfter(), offer.ticketsAfter(), true);
            throw BusinessException.conflict("OFFER_ALREADY_CONSUMED", "Предложение уже использовано");
        }
        if (!offer.expiresAt().isAfter(clock.instant()))
            throw BusinessException.conflict("OFFER_EXPIRED", "Срок предложения истёк");
        var user = jdbc.query("SELECT bonus_balance,lottery_ticket_count FROM users WHERE id=? FOR UPDATE",
                (rs,n) -> new UserBalance(rs.getLong(1), rs.getLong(2)), userId)
                .stream().findFirst().orElseThrow(() -> BusinessException.missing("USER_NOT_FOUND"));
        if (user.balance() < offer.price())
            throw BusinessException.conflict("INSUFFICIENT_BALANCE", "Недостаточно бонусов для покупки билетов");
        long afterBalance;
        long afterTickets;
        try {
            afterBalance = Math.subtractExact(user.balance(), offer.price());
            afterTickets = Math.addExact(user.tickets(), offer.ticketCount());
        } catch (ArithmeticException e) { throw BusinessException.conflict("BALANCE_LIMIT", "Превышен предел баланса"); }
        UUID transactionId = UUID.randomUUID();
        jdbc.update("UPDATE users SET bonus_balance=?,lottery_ticket_count=?,updated_at=now() WHERE id=?",
                afterBalance, afterTickets, userId);
        jdbc.update("""
            INSERT INTO economy_transactions(id,user_id,round_id,type,amount,balance_before,balance_after)
            VALUES (?,?,?,'SCENARIO8_TICKET_PURCHASE',?,?,?)
            """, transactionId, userId, offer.roundId(), offer.price(), user.balance(), afterBalance);
        jdbc.update("""
            UPDATE scenario8_offers SET consumed_at=?,idempotency_key=?,transaction_id=?,
                balance_before=?,balance_after=?,tickets_before=?,tickets_after=? WHERE id=?
            """, java.sql.Timestamp.from(clock.instant()), idempotencyKey, transactionId,
                user.balance(), afterBalance, user.tickets(), afterTickets, offer.id());
        return new PurchaseResult(offer.id(), offer.roundId(), offer.price(), offer.ticketCount(), afterBalance, afterTickets, false);
    }

    private OfferView view(Offer o) {
        String status = o.consumedAt() != null ? "CONSUMED" : !o.expiresAt().isAfter(clock.instant()) ? "EXPIRED" : "AVAILABLE";
        return new OfferView(o.id(), o.roundId(), o.price(), o.ticketCount(), o.minWinAmount(), o.expiresAt(), status);
    }
    private Offer map(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new Offer(rs.getObject("id", UUID.class), rs.getObject("user_id", UUID.class),
                rs.getObject("round_id", UUID.class), rs.getLong("price"), rs.getInt("ticket_count"),
                rs.getLong("min_win_amount"), rs.getTimestamp("expires_at").toInstant(),
                rs.getTimestamp("consumed_at") == null ? null : rs.getTimestamp("consumed_at").toInstant(),
                rs.getString("idempotency_key"), rs.getObject("balance_after") == null ? 0 : rs.getLong("balance_after"),
                rs.getObject("tickets_after") == null ? 0 : rs.getLong("tickets_after"));
    }
    private record UserBalance(long balance, long tickets) {}
    private record Offer(UUID id, UUID userId, UUID roundId, long price, int ticketCount, long minWinAmount,
                         Instant expiresAt, Instant consumedAt, String idempotencyKey, long balanceAfter, long ticketsAfter) {}
}
