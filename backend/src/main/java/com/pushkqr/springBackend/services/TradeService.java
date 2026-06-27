package com.pushkqr.springBackend.services;

import com.pushkqr.springBackend.dto.TradeRequest;
import com.pushkqr.springBackend.entities.*;
import com.pushkqr.springBackend.exceptions.GameStateException;
import com.pushkqr.springBackend.repositories.HoldingRepository;
import com.pushkqr.springBackend.repositories.RoomPlayerRepository;
import com.pushkqr.springBackend.repositories.TransactionRepository;
import com.pushkqr.springBackend.repositories.UserRepository;
import com.pushkqr.springBackend.state.GameStateService;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class TradeService {

    private final GameStateService gameStateService;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final RoomPlayerRepository roomPlayerRepository;
    private final HoldingRepository holdingRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Autowired
    public TradeService(RoomPlayerRepository roomPlayerRepository, GameStateService gameStateService, UserRepository userRepository, TransactionRepository transactionRepository, HoldingRepository holdingRepository, SimpMessagingTemplate messagingTemplate) {
        this.roomPlayerRepository = roomPlayerRepository;
        this.gameStateService = gameStateService;
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
        this.holdingRepository = holdingRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
    public Transaction executeTrade(String uid, TradeRequest request) {
        double currPrice = gameStateService.getPrice(request.getTicker());
        double qty = request.getQuantity();

        if (currPrice == 0.0) {
            throw new GameStateException("Invalid Ticker or Price Unavailable");
        }

        if (qty <= 0.0) {
            throw new GameStateException("Invalid Quantity");
        }

        Optional<User> user = userRepository.findByOauthId(uid);
        if (user.isEmpty()) {
            throw new EntityNotFoundException("User Not Found");
        }

        Optional<RoomPlayer> roomPlayerOptional = roomPlayerRepository.findByUserOauthIdAndRoomRoomCodeAndRoomStatus(uid, request.roomCode, "ACTIVE");
        if (roomPlayerOptional.isEmpty()) {
            throw new EntityNotFoundException("Player not found in room or room not active");
        }

        RoomPlayer roomPlayer = roomPlayerOptional.get();
        double totalValue = currPrice * qty;

        if (request.type.equals("BUY")) {
            if (roomPlayer.getAvailableCash() < totalValue) {
                throw new GameStateException("Insufficient funds");
            }

            roomPlayer.setAvailableCash(roomPlayer.getAvailableCash() - totalValue);
            Optional<Holding> holdingOptional = holdingRepository.findByRoomPlayerIdAndTicker(roomPlayer.getId(), request.ticker);

            if (holdingOptional.isPresent()) {
                Holding existingHolding = holdingOptional.get();
                double totalCost = existingHolding.getQuantity() * existingHolding.getAverageBuyPrice() + totalValue;
                double newQty = existingHolding.getQuantity() + qty;
                double newAvgPrice = totalCost / newQty;

                existingHolding.setQuantity(newQty);
                existingHolding.setAverageBuyPrice(newAvgPrice);
            } else {
                Holding newHolding = new Holding();
                newHolding.setQuantity(qty);
                newHolding.setTicker(request.ticker);
                newHolding.setRoomPlayer(roomPlayer);
                newHolding.setAverageBuyPrice(currPrice);
                holdingRepository.save(newHolding);
            }

        } else if (request.type.equals("SELL")) {
            Optional<Holding> holdingOptional = holdingRepository.findByRoomPlayerIdAndTicker(roomPlayer.getId(), request.ticker);

            if (holdingOptional.isEmpty() || holdingOptional.get().getQuantity() < qty) {
                throw new GameStateException("Insufficient holding quantity");
            }

            roomPlayer.setAvailableCash(roomPlayer.getAvailableCash() + totalValue);
            Holding holding = holdingOptional.get();

            if (holding.getQuantity() == qty) {
                holdingRepository.delete(holding);
            } else {
                holding.setQuantity(holding.getQuantity() - qty);
            }

        } else {
            throw new IllegalArgumentException("Invalid trade type");
        }

        Transaction transaction = new Transaction();
        transaction.setPrice(currPrice);
        transaction.setQuantity(qty);
        transaction.setType(request.type);
        transaction.setRoomPlayer(roomPlayer);
        transaction.setTimestamp(OffsetDateTime.now());
        transactionRepository.save(transaction);

        messagingTemplate.convertAndSend("/topic/room/" + request.roomCode + "/trades", transaction);

        return transaction;
    }

    public List<Transaction> getTradeHistory(String uid, String roomCode) {
        Optional<User> userOptional = userRepository.findByOauthId(uid);
        if (userOptional.isEmpty()) {
            throw new EntityNotFoundException("User not found");
        }

        Optional<RoomPlayer> roomPlayerOptional = roomPlayerRepository.findByUserOauthIdAndRoomRoomCode(uid, roomCode);
        if (roomPlayerOptional.isEmpty()) {
            return new ArrayList<>();
        }

        RoomPlayer roomPlayer = roomPlayerOptional.get();
        Optional<List<Transaction>> list = transactionRepository.findAllByRoomPlayerId(roomPlayer.getId());

        return list.orElseGet(ArrayList::new);
    }
}
