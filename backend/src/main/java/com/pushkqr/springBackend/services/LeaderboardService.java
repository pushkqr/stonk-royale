package com.pushkqr.springBackend.services;

import com.pushkqr.springBackend.dto.LeaderboardEntry;
import com.pushkqr.springBackend.entities.Holding;
import com.pushkqr.springBackend.entities.Room;
import com.pushkqr.springBackend.repositories.HoldingRepository;
import com.pushkqr.springBackend.repositories.RoomRepository;
import com.pushkqr.springBackend.state.GameStateService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class LeaderboardService {

    public GameStateService gameStateService;
    public RoomRepository roomRepository;
    public HoldingRepository holdingRepository;
    public SimpMessagingTemplate messagingTemplate;


    @Autowired
    public LeaderboardService(GameStateService gameStateService, RoomRepository roomRepository, HoldingRepository holdingRepository, SimpMessagingTemplate messagingTemplate) {
        this.gameStateService = gameStateService;
        this.roomRepository = roomRepository;
        this.holdingRepository = holdingRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Scheduled(fixedRate = 2000)
    public void startLeaderboardService(){
        try{
            Optional<List<Room>> activeRoomsOptional = roomRepository.findAllByStatus("ACTIVE");
            List<Room> activeRooms = new ArrayList<>();

            if(activeRoomsOptional.isPresent()){
                activeRooms = activeRoomsOptional.get();
            }

            for(Room room: activeRooms){
                List<LeaderboardEntry> leaderboard = room.getUsers().stream().map(player -> {
                    Optional<List<Holding>> opt = holdingRepository.findAllByRoomPlayerId(player.getId());
                    List<Holding> holdings = new ArrayList<>();
                    if(opt.isPresent())
                            holdings = opt.get();

                    double cryptoValue = holdings.stream().mapToDouble(holding -> {
                        double currentPrice = gameStateService.getPrice(holding.getTicker());
                        return holding.getQuantity() * currentPrice;
                    }).sum();

                    double netWorth = player.getAvailableCash() + cryptoValue;
                    double pnl = netWorth - room.getStartingBalance();

                    return new LeaderboardEntry(
                            player.getUser(),
                            cryptoValue,
                            player.getAvailableCash(),
                            pnl,
                            netWorth,
                            holdings
                    );
                }).sorted((a,b) -> Double.compare(b.netWorth, a.netWorth)).toList();

                messagingTemplate.convertAndSend("/topic/room/" + room.getRoomCode() + "/leaderboard", leaderboard);

            }



        }catch (Exception e){
            System.err.println("Leaderboard Service Error: " + e.getMessage());
        }
    }
}
