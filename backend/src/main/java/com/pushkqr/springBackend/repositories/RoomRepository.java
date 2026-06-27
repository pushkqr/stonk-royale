package com.pushkqr.springBackend.repositories;

import com.pushkqr.springBackend.entities.Room;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, String> {
    Optional<Room> findByRoomCode(String room_code);
    Boolean existsByRoomCode(String room_code);
    Boolean existsByRoomCodeAndUsersOauthId(String room_code, String uid);
    Optional<List<Room>> findAllByStatus(String status);
    Optional<List<Room>> findAllByStatusAndEndTimeLessThanEqual(String status, java.time.OffsetDateTime endTime);
}
