package com.pushkqr.springBackend.services;

import com.pushkqr.springBackend.entities.Room;
import com.pushkqr.springBackend.entities.RoomPlayer;
import com.pushkqr.springBackend.entities.User;
import com.pushkqr.springBackend.exceptions.GameStateException;
import com.pushkqr.springBackend.repositories.RoomPlayerRepository;
import com.pushkqr.springBackend.repositories.RoomRepository;
import com.pushkqr.springBackend.repositories.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
public class RoomService {

    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final RoomPlayerRepository roomPlayerRepository;

    @Autowired
    public RoomService(RoomRepository roomRepository, UserRepository userRepository, RoomPlayerRepository roomPlayerRepository) {
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
        this.roomPlayerRepository = roomPlayerRepository;
    }

    @Transactional
    public Room createRoom(Room room) {
        if (room == null) {
            throw new IllegalArgumentException("Request body cannot be empty");
        }

        String roomCode = generateRoomCode();
        Boolean exists = roomRepository.existsByRoomCode(roomCode);

        while (exists) {
            roomCode = generateRoomCode();
            exists = roomRepository.existsByRoomCode(roomCode);
        }

        room.setRoomCode(roomCode);
        room.setStatus("WAITING");
        return roomRepository.save(room);
    }

    @Transactional
    public Object joinRoom(String uid, String roomCode) {
        Optional<User> userOptional = userRepository.findByOauthId(uid);

        if (userOptional.isEmpty()) {
            throw new EntityNotFoundException("User not found. Ensure you authenticate via Bearer Authorization.");
        }

        Optional<Room> roomOptional = roomRepository.findByRoomCode(roomCode.toUpperCase());

        if (roomOptional.isEmpty()) {
            throw new EntityNotFoundException("Room not found");
        }

        Room room = roomOptional.get();

        Boolean isAlreadyJoined = roomRepository.existsByRoomCodeAndUsersOauthId(roomCode.toUpperCase(), uid);

        if (isAlreadyJoined) {
            return room; // Controller will wrap this
        }

        if (!room.getStatus().equals("WAITING")) {
            throw new GameStateException("Room has already started or is completed");
        }

        if (room.getUsers().size() >= room.getMaxPlayers()) {
            throw new GameStateException("Room is full");
        }

        RoomPlayer roomPlayer = new RoomPlayer();
        roomPlayer.setRoom(room);
        roomPlayer.setUser(userOptional.get());
        roomPlayer.setAvailableCash(room.getStartingBalance());
        return roomPlayerRepository.save(roomPlayer);
    }

    public Room getRoomInfo(String roomCode) {
        Optional<Room> roomOptional = roomRepository.findByRoomCode(roomCode.toUpperCase());

        if (roomOptional.isEmpty()) {
            throw new EntityNotFoundException("Room not found");
        }

        return roomOptional.get();
    }

    private String generateRoomCode() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder code = new StringBuilder();

        for (int i = 0; i < 5; i++) {
            code.append(chars.charAt((int) Math.floor(Math.random() * chars.length())));
        }

        return code.toString();
    }
}
