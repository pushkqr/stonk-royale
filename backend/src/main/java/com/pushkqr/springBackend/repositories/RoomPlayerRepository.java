package com.pushkqr.springBackend.repositories;

import com.pushkqr.springBackend.entities.RoomPlayer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RoomPlayerRepository extends JpaRepository<RoomPlayer, String> {
    Optional<RoomPlayer> findByUserOauthIdAndRoomRoomCodeAndRoomStatus(String uid, String room_code, String status);
    Optional<RoomPlayer> findByUserOauthIdAndRoomRoomCode(String uid, String room_code);

}
