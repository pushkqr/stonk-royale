package com.pushkqr.springBackend.services;

import com.pushkqr.springBackend.entities.Holding;
import com.pushkqr.springBackend.entities.Room;
import com.pushkqr.springBackend.entities.RoomPlayer;
import com.pushkqr.springBackend.repositories.HoldingRepository;
import com.pushkqr.springBackend.repositories.RoomPlayerRepository;
import com.pushkqr.springBackend.repositories.RoomRepository;
import com.pushkqr.springBackend.state.GameStateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class EndgameServiceTest {

    @Mock
    private RoomRepository roomRepository;
    @Mock
    private RoomPlayerRepository roomPlayerRepository;
    @Mock
    private HoldingRepository holdingRepository;
    @Mock
    private GameStateService gameStateService;
    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private EndgameService endgameService;

    private Room mockRoom;
    private RoomPlayer mockPlayer;
    private Holding mockHolding;

    @BeforeEach
    void setUp() {
        mockRoom = new Room();
        mockRoom.setRoomCode("ROOM1");
        mockRoom.setStatus("ACTIVE");

        mockPlayer = new RoomPlayer();
        mockPlayer.setId("player1");
        mockPlayer.setAvailableCash(100.0);
        mockPlayer.setRoom(mockRoom);
        
        mockRoom.setUsers(new java.util.HashSet<>(List.of(mockPlayer)));

        mockHolding = new Holding();
        mockHolding.setQuantity(2.0);
        mockHolding.setTicker("BTC");
    }

    @Test
    void processEndgames_LiquidatesAndCompletesRoom() {
        when(roomRepository.findAllByStatusAndEndTimeLessThanEqual(eq("ACTIVE"), any(OffsetDateTime.class)))
                .thenReturn(Optional.of(List.of(mockRoom)));
        
        when(holdingRepository.findAllByRoomPlayerId("player1"))
                .thenReturn(Optional.of(List.of(mockHolding)));
                
        when(gameStateService.getPrice("BTC")).thenReturn(50000.0);

        endgameService.processExpiredRooms();

        // 100 cash + (2.0 BTC * 50000.0) = 100100.0
        assertEquals(100100.0, mockPlayer.getAvailableCash());
        verify(holdingRepository, times(1)).deleteAll(anyList());
        assertEquals("COMPLETED", mockRoom.getStatus());
        verify(roomRepository, times(1)).save(mockRoom);
        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/room/ROOM1/gameOver"), any(Object.class));
    }
}
