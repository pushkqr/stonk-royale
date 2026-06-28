package com.pushkqr.springBackend.services;

import com.pushkqr.springBackend.dto.TradeRequest;
import com.pushkqr.springBackend.entities.Holding;
import com.pushkqr.springBackend.entities.RoomPlayer;
import com.pushkqr.springBackend.entities.User;
import com.pushkqr.springBackend.exceptions.GameStateException;
import com.pushkqr.springBackend.repositories.HoldingRepository;
import com.pushkqr.springBackend.repositories.RoomPlayerRepository;
import com.pushkqr.springBackend.repositories.TransactionRepository;
import com.pushkqr.springBackend.repositories.UserRepository;
import com.pushkqr.springBackend.state.GameStateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class TradeServiceTest {

    @Mock
    private GameStateService gameStateService;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private RoomPlayerRepository roomPlayerRepository;
    @Mock
    private HoldingRepository holdingRepository;
    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private TradeService tradeService;

    private User mockUser;
    private RoomPlayer mockPlayer;
    private TradeRequest buyRequest;

    @BeforeEach
    void setUp() {
        mockUser = new User();
        mockUser.setOauthId("test_uid");

        mockPlayer = new RoomPlayer();
        mockPlayer.setId("player_id");
        mockPlayer.setAvailableCash(10000.0);
        mockPlayer.setUser(mockUser);

        buyRequest = new TradeRequest("ROOM1", "BUY", 2.0, "BTC");
    }

    @Test
    void executeTrade_SuccessfulBuy() {
        when(gameStateService.getPrice("BTC")).thenReturn(500.0);
        when(userRepository.findByOauthId("test_uid")).thenReturn(Optional.of(mockUser));
        when(roomPlayerRepository.findByUserOauthIdAndRoomRoomCodeAndRoomStatusForUpdate("test_uid", "ROOM1", "ACTIVE"))
                .thenReturn(Optional.of(mockPlayer));
        when(holdingRepository.findByRoomPlayerIdAndTicker("player_id", "BTC")).thenReturn(Optional.empty());

        tradeService.executeTrade("test_uid", buyRequest);

        assertEquals(9000.0, mockPlayer.getAvailableCash()); // 10000 - (500 * 2)
        verify(holdingRepository, times(1)).save(any(Holding.class));
        verify(transactionRepository, times(1)).save(any());
        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/room/ROOM1/trades"), any(Object.class));
    }

    @Test
    void executeTrade_InsufficientFunds() {
        when(gameStateService.getPrice("BTC")).thenReturn(6000.0); // 6000 * 2 = 12000 (More than 10000 cash)
        when(userRepository.findByOauthId("test_uid")).thenReturn(Optional.of(mockUser));
        when(roomPlayerRepository.findByUserOauthIdAndRoomRoomCodeAndRoomStatusForUpdate("test_uid", "ROOM1", "ACTIVE"))
                .thenReturn(Optional.of(mockPlayer));

        GameStateException exception = assertThrows(GameStateException.class, () -> {
            tradeService.executeTrade("test_uid", buyRequest);
        });

        assertEquals("Insufficient funds", exception.getMessage());
        assertEquals(10000.0, mockPlayer.getAvailableCash()); // Cash should not be deducted
        verify(holdingRepository, never()).save(any());
    }
}
