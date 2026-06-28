package com.pushkqr.springBackend.services;

import com.pushkqr.springBackend.dto.HistoricalData;
import com.pushkqr.springBackend.entities.Room;
import com.pushkqr.springBackend.entities.RoomPlayer;
import com.pushkqr.springBackend.entities.User;
import com.pushkqr.springBackend.exceptions.GameStateException;
import com.pushkqr.springBackend.repositories.RoomPlayerRepository;
import com.pushkqr.springBackend.repositories.RoomRepository;
import com.pushkqr.springBackend.repositories.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class RoomService {

    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final RoomPlayerRepository roomPlayerRepository;
    private final MarketService marketService;
    private final SimpMessagingTemplate messagingTemplate;

    @Autowired
    public RoomService(RoomRepository roomRepository, UserRepository userRepository,
            RoomPlayerRepository roomPlayerRepository, MarketService marketService,
            SimpMessagingTemplate messagingTemplate) {
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
        this.roomPlayerRepository = roomPlayerRepository;
        this.marketService = marketService;
        this.messagingTemplate = messagingTemplate;
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

        Boolean isAlreadyJoined = roomRepository.existsByRoomCodeAndUsersUserOauthId(roomCode.toUpperCase(), uid);

        if (isAlreadyJoined) {
            return room;
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

    @Transactional
    public void readyUpPlayer(String uid, String roomCode) {
        Optional<Room> lockedRoomOpt = roomRepository.findByRoomCodeForUpdate(roomCode);

        if (lockedRoomOpt.isEmpty() || !lockedRoomOpt.get().getStatus().equals("WAITING")) {
            return;
        }

        Optional<RoomPlayer> roomPlayerOptional = roomPlayerRepository.findByUserOauthIdAndRoomRoomCode(uid, roomCode);

        if (roomPlayerOptional.isEmpty()) {
            throw new EntityNotFoundException("No active player found.");
        }

        RoomPlayer roomPlayer = roomPlayerOptional.get();
        roomPlayer.setIsReady(true);

        Optional<List<RoomPlayer>> allReadyOptional = roomPlayerRepository.findAllByRoomRoomCode(roomCode);

        if (allReadyOptional.isEmpty()) {
            throw new GameStateException("Room does not exist.");
        }

        List<RoomPlayer> allReady = allReadyOptional.get();

        for (RoomPlayer rp : allReady) {
            if (!rp.getIsReady())
                return;
        }

        Room room = roomPlayer.getRoom();
        room.setStatus("ACTIVE");
        room.setStartTime(OffsetDateTime.now());
        room.setEndTime(OffsetDateTime.now().plusMinutes(room.getDurationMinutes()));
        roomRepository.save(room);

        HistoricalData historicalData = marketService.getHistoricalCharts();

        java.util.Map<String, Object> startPayload = new java.util.HashMap<>();
        startPayload.put("startTime", room.getStartTime());
        startPayload.put("endTime", room.getEndTime());
        startPayload.put("historicalData", historicalData);

        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/start", (Object) startPayload);
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
