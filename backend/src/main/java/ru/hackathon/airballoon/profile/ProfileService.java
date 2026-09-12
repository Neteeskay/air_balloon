package ru.hackathon.airballoon.profile;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import ru.hackathon.airballoon.common.BusinessException;
import ru.hackathon.airballoon.user.UserService;
import ru.hackathon.airballoon.user.UserState;

@Service
public class ProfileService {
    public record Equipped(String headId, String neckId) {}
    public record Avatar(Equipped equipped, long version, Instant updatedAt) {}
    public record Puzzle(String id, String name, int totalFragments, int collectedFragments,
                         boolean completed, Instant completedAt, String rewardClothingId, boolean active) {}
    public record WardrobeItem(String id, String displayName, String slot, String assetKey,
                               boolean active, boolean unlocked, Instant unlockedAt, String unlockSource) {}
    public record Profile(UserState user, Avatar avatar, List<Puzzle> puzzles,
                          List<WardrobeItem> wardrobe, Instant serverTime) {}

    private final JdbcTemplate jdbc;
    private final UserService users;
    private final Clock clock;

    public ProfileService(JdbcTemplate jdbc, UserService users, Clock clock) {
        this.jdbc = jdbc;
        this.users = users;
        this.clock = clock;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Profile get(UUID userId) {
        UserState user = users.getState(userId);
        Avatar avatar = avatar(userId);
        List<Puzzle> puzzles = jdbc.query("""
                SELECT p.code,p.name,p.total_fragments,COALESCE(up.collected_fragments,0) collected_fragments,
                       COALESCE(up.completed,false) completed,up.completed_at,c.code reward_code,p.active
                FROM puzzle_definitions p
                JOIN clothing_items c ON c.id=p.reward_clothing_id
                LEFT JOIN user_puzzle_progress up ON up.puzzle_id=p.id AND up.user_id=?
                ORDER BY p.ordering,p.id
                """, this::mapPuzzle, userId);
        List<WardrobeItem> wardrobe = wardrobe(userId);
        return new Profile(user, avatar, puzzles, wardrobe, clock.instant());
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public List<WardrobeItem> wardrobe(UUID userId) {
        users.getState(userId);
        return jdbc.query("""
                SELECT c.code,c.display_name,c.slot,c.asset_key,c.active,
                       (uci.clothing_id IS NOT NULL) unlocked,uci.unlocked_at,uci.source_type
                FROM clothing_items c
                LEFT JOIN user_clothing_items uci ON uci.clothing_id=c.id AND uci.user_id=?
                ORDER BY c.ordering,c.id
                """, this::mapWardrobe, userId);
    }

    @Transactional
    public Avatar equip(UUID userId, String headId, String neckId) {
        if (jdbc.query("SELECT id FROM users WHERE id=? FOR UPDATE", (rs, row) -> rs.getObject(1, UUID.class), userId).isEmpty())
            throw BusinessException.missing("USER_NOT_FOUND");
        UUID head = resolveOwned(userId, headId, "HEAD");
        UUID neck = resolveOwned(userId, neckId, "NECK");
        int changed = jdbc.update("""
                UPDATE user_avatar_equipment
                SET head_clothing_id=?,neck_clothing_id=?,updated_at=now(),version=version+1
                WHERE user_id=?
                """, head, neck, userId);
        if (changed != 1) throw BusinessException.conflict("PROFILE_NOT_READY", "Профиль пользователя не инициализирован");
        return avatar(userId);
    }

    private UUID resolveOwned(UUID userId, String code, String expectedSlot) {
        if (code == null) return null;
        if (code.isBlank()) throw BusinessException.invalid("INVALID_CLOTHING_ID", "Идентификатор одежды не может быть пустым");
        var items = jdbc.query("""
                SELECT c.id,c.slot,c.active,(uci.clothing_id IS NOT NULL) unlocked
                FROM clothing_items c
                LEFT JOIN user_clothing_items uci ON uci.clothing_id=c.id AND uci.user_id=?
                WHERE c.code=?
                """, (rs, row) -> new ClothingState(rs.getObject("id", UUID.class), rs.getString("slot"),
                rs.getBoolean("active"), rs.getBoolean("unlocked")), userId, code);
        if (items.isEmpty()) throw BusinessException.missing("CLOTHING_NOT_FOUND");
        ClothingState item = items.getFirst();
        if (!expectedSlot.equals(item.slot()))
            throw BusinessException.invalid("WRONG_CLOTHING_SLOT", "Предмет не подходит для слота " + expectedSlot);
        if (!item.active()) throw BusinessException.conflict("ITEM_INACTIVE", "Предмет одежды неактивен");
        if (!item.unlocked()) throw BusinessException.conflict("ITEM_LOCKED", "Предмет одежды ещё не разблокирован");
        return item.id();
    }

    private Avatar avatar(UUID userId) {
        return jdbc.query("""
                SELECT h.code head_code,n.code neck_code,e.version,e.updated_at
                FROM user_avatar_equipment e
                LEFT JOIN clothing_items h ON h.id=e.head_clothing_id
                LEFT JOIN clothing_items n ON n.id=e.neck_clothing_id
                WHERE e.user_id=?
                """, (rs, row) -> new Avatar(new Equipped(rs.getString("head_code"), rs.getString("neck_code")),
                rs.getLong("version"), rs.getTimestamp("updated_at").toInstant()), userId)
                .stream().findFirst().orElseThrow(() -> BusinessException.conflict(
                        "PROFILE_NOT_READY", "Профиль пользователя не инициализирован"));
    }

    private Puzzle mapPuzzle(ResultSet rs, int row) throws SQLException {
        var completedAt = rs.getTimestamp("completed_at");
        return new Puzzle(rs.getString("code"), rs.getString("name"), rs.getInt("total_fragments"),
                rs.getInt("collected_fragments"), rs.getBoolean("completed"),
                completedAt == null ? null : completedAt.toInstant(), rs.getString("reward_code"), rs.getBoolean("active"));
    }

    private WardrobeItem mapWardrobe(ResultSet rs, int row) throws SQLException {
        var unlockedAt = rs.getTimestamp("unlocked_at");
        return new WardrobeItem(rs.getString("code"), rs.getString("display_name"), rs.getString("slot"),
                rs.getString("asset_key"), rs.getBoolean("active"), rs.getBoolean("unlocked"),
                unlockedAt == null ? null : unlockedAt.toInstant(), rs.getString("source_type"));
    }

    private record ClothingState(UUID id, String slot, boolean active, boolean unlocked) {}
}
