package com.pushkqr.springBackend.services;

import com.pushkqr.springBackend.dto.LeaderboardEntry;
import com.pushkqr.springBackend.entities.Holding;
import com.pushkqr.springBackend.entities.Room;
import com.pushkqr.springBackend.entities.RoomPlayer;
import com.pushkqr.springBackend.repositories.HoldingRepository;
import com.pushkqr.springBackend.repositories.RoomPlayerRepository;
import com.pushkqr.springBackend.repositories.RoomRepository;
import com.pushkqr.springBackend.state.GameStateService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class EndgameService {

    private static final Logger logger = LoggerFactory.getLogger(EndgameService.class);
    private final RoomRepository roomRepository;
    private final RoomPlayerRepository roomPlayerRepository;
    private final HoldingRepository holdingRepository;
    private final GameStateService gameStateService;
    private final SimpMessagingTemplate messagingTemplate;

    @Autowired
    public EndgameService(RoomRepository roomRepository, RoomPlayerRepository roomPlayerRepository, HoldingRepository holdingRepository, GameStateService gameStateService, SimpMessagingTemplate messagingTemplate) {
        this.roomRepository = roomRepository;
        this.roomPlayerRepository = roomPlayerRepository;
        this.holdingRepository = holdingRepository;
        this.gameStateService = gameStateService;
        this.messagingTemplate = messagingTemplate;
    }

    @Scheduled(fixedRate = 10000) // Run every 10 seconds
    @Transactional
    public void processExpiredRooms() {
        try {
            OffsetDateTime now = OffsetDateTime.now();
            Optional<List<Room>> expiredRoomsOpt = roomRepository.findAllByStatusAndEndTimeLessThanEqual("ACTIVE", now);

            if (expiredRoomsOpt.isEmpty()) return;

            for (Room room : expiredRoomsOpt.get()) {
                logger.info("Room {} has ended! Liquidating assets...", room.getRoomCode());

                List<LeaderboardEntry> finalLeaderboard = new ArrayList<>();

                for (RoomPlayer player : room.getUsers()) {
                    List<Holding> holdings = holdingRepository.findAllByRoomPlayerId(player.getId()).orElse(new ArrayList<>());

                    double cryptoValue = holdings.stream().mapToDouble(holding -> {
                        double currentPrice = gameStateService.getPrice(holding.getTicker());
                        return holding.getQuantity() * currentPrice;
                    }).sum();

                    double finalNetWorth = player.getAvailableCash() + cryptoValue;
                    double finalPnl = finalNetWorth - room.getStartingBalance();

                    player.setAvailableCash(finalNetWorth);
                    roomPlayerRepository.save(player);

                    if (!holdings.isEmpty()) {
                        holdingRepository.deleteAll(holdings);
                    }

                    finalLeaderboard.add(new LeaderboardEntry(
                            player.getUser(),
                            0.0,
                            finalNetWorth,
                            finalPnl,
                            finalNetWorth,
                            holdings
                    ));
                }

                room.setStatus("COMPLETED");
                roomRepository.save(room);

                finalLeaderboard.sort((a, b) -> Double.compare(b.getNetWorth(), a.getNetWorth()));
                LeaderboardEntry winner = finalLeaderboard.isEmpty() ? null : finalLeaderboard.get(0);

                Map<String, Object> gameOverEvent = new HashMap<>();
                gameOverEvent.put("message", "Tournament has ended! Assets have been liquidated.");
                gameOverEvent.put("leaderboard", finalLeaderboard);
                gameOverEvent.put("winner", winner);

                messagingTemplate.convertAndSend("/topic/room/" + room.getRoomCode() + "/gameOver", (Object) gameOverEvent);
            }

        } catch (Exception e) {
            System.err.println("EndGame Service Error: " + e.getMessage());
        }
    }
}
