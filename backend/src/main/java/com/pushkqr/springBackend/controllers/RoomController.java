package com.pushkqr.springBackend.controllers;

import com.pushkqr.springBackend.entities.Room;
import com.pushkqr.springBackend.entities.RoomPlayer;
import com.pushkqr.springBackend.entities.User;
import com.pushkqr.springBackend.services.RoomService;
import com.pushkqr.springBackend.services.MarketService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/room")
public class RoomController {

    private final RoomService roomService;
    private final MarketService marketService;
    private final org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;

    @Autowired
    public RoomController(RoomService roomService, MarketService marketService, org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate) {
        this.roomService = roomService;
        this.marketService = marketService;
        this.messagingTemplate = messagingTemplate;
    }

    @PostMapping("/create")
    public ResponseEntity<Room> handleRoomCreation(@AuthenticationPrincipal String uid, @RequestBody Room room){
        Room createdRoom = roomService.createRoom(room);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdRoom);
    }

    @PostMapping("/join/{roomCode}")
    public ResponseEntity<?> handleRoomJoin(@AuthenticationPrincipal String uid, @PathVariable String roomCode){
        Object result = roomService.joinRoom(uid, roomCode);
        messagingTemplate.convertAndSend("/topic/room/" + roomCode + "/readyStatus", "update");
        return ResponseEntity.status(HttpStatus.OK).body(result);
    }

    @GetMapping("/{roomCode}")
    public ResponseEntity<Room> handleRoomInfo(@AuthenticationPrincipal String uid, @PathVariable String roomCode){
        Room roomInfo = roomService.getRoomInfo(roomCode);
        return ResponseEntity.status(HttpStatus.OK).body(roomInfo);
    }

    @GetMapping("/historical/{roomCode}")
    public ResponseEntity<?> getHistoricalData(@PathVariable String roomCode) {
        return ResponseEntity.ok(marketService.getHistoricalCharts());
    }
}
