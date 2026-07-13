package com.pushkqr.springBackend.services;

import com.pushkqr.springBackend.entities.Room;
import com.pushkqr.springBackend.entities.RoomPlayer;
import com.pushkqr.springBackend.entities.User;
import com.pushkqr.springBackend.exceptions.GameStateException;
import com.pushkqr.springBackend.repositories.RoomPlayerRepository;
import com.pushkqr.springBackend.repositories.RoomRepository;
import com.pushkqr.springBackend.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class RoomServiceTest {

    @Mock
    private RoomRepository roomRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private RoomPlayerRepository roomPlayerRepository;
    @Mock
    private MarketService marketService;
    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private RoomService roomService;

    private User mockUser;
    private Room mockRoom;
    private RoomPlayer mockPlayer;

    @BeforeEach
    void setUp() {
        mockUser = new User();
        mockUser.setOauthId("test_uid");

        mockRoom = new Room();
        mockRoom.setRoomCode("ROOM1");
        mockRoom.setStatus("WAITING");
        mockRoom.setMaxPlayers(2);

        mockPlayer = new RoomPlayer();
        mockPlayer.setUser(mockUser);
        mockPlayer.setRoom(mockRoom);
        mockPlayer.setIsReady(false);
    }

    @Test
    void joinRoom_Success() {
        when(userRepository.findByOauthId("test_uid")).thenReturn(Optional.of(mockUser));
        when(roomRepository.findByRoomCode("ROOM1")).thenReturn(Optional.of(mockRoom));
        when(roomRepository.existsByRoomCodeAndUsersUserOauthId("ROOM1", "test_uid")).thenReturn(false);
        when(roomPlayerRepository.save(any(RoomPlayer.class))).thenReturn(mockPlayer);

        Object result = roomService.joinRoom("test_uid", "ROOM1");
        
        assertNotNull(result);
        assertTrue(result instanceof RoomPlayer);
        verify(roomPlayerRepository, times(1)).save(any(RoomPlayer.class));
    }

    @Test
    void joinRoom_FailsWhenRoomFull() {
        User u1 = new User(); u1.setOauthId("u1");
        User u2 = new User(); u2.setOauthId("u2");
        RoomPlayer p1 = new RoomPlayer(); p1.setUser(u1);
        RoomPlayer p2 = new RoomPlayer(); p2.setUser(u2);
        mockRoom.setUsers(new java.util.HashSet<>(java.util.List.of(p1, p2)));

        when(userRepository.findByOauthId("test_uid")).thenReturn(Optional.of(mockUser));
        when(roomRepository.findByRoomCode("ROOM1")).thenReturn(Optional.of(mockRoom));
        when(roomRepository.existsByRoomCodeAndUsersUserOauthId("ROOM1", "test_uid")).thenReturn(false);

        assertThrows(GameStateException.class, () -> {
            roomService.joinRoom("test_uid", "ROOM1");
        });
        
        verify(roomPlayerRepository, never()).save(any());
    }

    @Test
    void readyUpPlayer_StartsRoomWhenAllReady() {
        RoomPlayer player2 = new RoomPlayer();
        player2.setIsReady(true);
        mockPlayer.setIsReady(true); // both ready

        when(roomRepository.findByRoomCode("ROOM1")).thenReturn(Optional.of(mockRoom));
        when(roomPlayerRepository.findByUserOauthIdAndRoomRoomCode("test_uid", "ROOM1")).thenReturn(Optional.of(mockPlayer));
        when(roomPlayerRepository.findAllByRoomRoomCode("ROOM1")).thenReturn(Optional.of(List.of(mockPlayer, player2)));

        roomService.readyUpPlayer("test_uid", "ROOM1");

        assertEquals("ACTIVE", mockRoom.getStatus());
        assertNotNull(mockRoom.getStartTime());
        verify(roomRepository, times(1)).save(mockRoom);
        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/room/ROOM1/start"), any(Object.class));
    }
}
