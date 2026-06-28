package com.pushkqr.springBackend.controllers;

import com.pushkqr.springBackend.dto.TradeRequest;
import com.pushkqr.springBackend.entities.*;
import com.pushkqr.springBackend.exceptions.GameStateException;
import com.pushkqr.springBackend.services.TradeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.util.List;

@RestController
@RequestMapping("/trade")
public class TradeController {

    private final TradeService tradeService;

    @Autowired
    public TradeController(TradeService tradeService) {
        this.tradeService = tradeService;
    }

    @PostMapping("/")
    public ResponseEntity<Transaction> handleTradeExecution(@AuthenticationPrincipal String uid, @Valid @RequestBody TradeRequest request){
        Transaction transaction = tradeService.executeTrade(uid, request);
        return ResponseEntity.status(HttpStatus.OK).body(transaction);
    }

    @GetMapping("/history/{roomCode}")
    public ResponseEntity<List<Transaction>> handleGetTradeHistory(@AuthenticationPrincipal String uid, @PathVariable String roomCode){
        List<Transaction> transactions = tradeService.getTradeHistory(uid, roomCode);
        return ResponseEntity.status(HttpStatus.OK).body(transactions);
    }
}
