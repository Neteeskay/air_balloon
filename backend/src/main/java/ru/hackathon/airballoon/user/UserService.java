package ru.hackathon.airballoon.user;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import ru.hackathon.airballoon.common.BusinessException;

@Service
public class UserService {
    private final JdbcTemplate jdbc;
    public UserService(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public UserState getState(UUID id) {
        return jdbc.query("SELECT * FROM users WHERE id=?", (rs,n)->new UserState(rs.getObject("id",UUID.class),
            rs.getString("username"),rs.getString("display_name"),rs.getLong("bonus_balance"),rs.getLong("game_score"),
            rs.getTimestamp("created_at").toInstant(),rs.getTimestamp("updated_at").toInstant()), id)
            .stream().findFirst().orElseThrow(()->BusinessException.missing("USER_NOT_FOUND"));
    }
}
