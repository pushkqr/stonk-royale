package com.pushkqr.springBackend.repositories;

import com.pushkqr.springBackend.entities.RoomPlayer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface RoomPlayerRepository extends JpaRepository<RoomPlayer, String> {
    Optional<RoomPlayer> findByUserOauthIdAndRoomRoomCodeAndRoomStatus(String uid, String room_code, String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT rp FROM RoomPlayer rp WHERE rp.user.oauthId = :uid AND rp.room.roomCode = :roomCode AND rp.room.status = :status")
    Optional<RoomPlayer> findByUserOauthIdAndRoomRoomCodeAndRoomStatusForUpdate(String uid, String roomCode, String status);

    Optional<RoomPlayer> findByUserOauthIdAndRoomRoomCode(String uid, String room_code);
    Optional<List<RoomPlayer>> findAllByRoomRoomCode(String room_code);
}
