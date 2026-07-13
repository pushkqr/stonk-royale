package com.pushkqr.springBackend.repositories;

import com.pushkqr.springBackend.entities.Room;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, String> {
    Optional<Room> findByRoomCode(String room_code);

    // Removed findByRoomCodeForUpdate because pessimistic locking generates invalid FOR UPDATE OF syntax in MariaDB 5.5.5

    Boolean existsByRoomCode(String room_code);
    Boolean existsByRoomCodeAndUsersUserOauthId(String room_code, String uid);

    @EntityGraph(attributePaths = {"users", "users.user"})
    Optional<List<Room>> findAllByStatus(String status);

    @EntityGraph(attributePaths = {"users", "users.user"})
    Optional<List<Room>> findAllByStatusAndEndTimeLessThanEqual(String status, OffsetDateTime endTime);
}
