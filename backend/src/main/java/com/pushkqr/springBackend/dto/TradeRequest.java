package com.pushkqr.springBackend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class TradeRequest {
    @NotBlank(message = "Room code is required")
    public String roomCode;

    @NotBlank(message = "Ticker is required")
    public String ticker;

    @DecimalMin(value = "0.0001", message = "Quantity must be greater than 0")
    public double quantity;

    @NotBlank(message = "Trade type is required")
    public String type;

    public TradeRequest(String roomCode, String type, double quantity, String ticker) {
        this.roomCode = roomCode;
        this.type = type;
        this.quantity = quantity;
        this.ticker = ticker;
    }

    public String getRoomCode() {
        return roomCode;
    }

    public void setRoomCode(String roomCode) {
        this.roomCode = roomCode;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public double getQuantity() {
        return quantity;
    }

    public void setQuantity(double quantity) {
        this.quantity = quantity;
    }

    public String getTicker() {
        return ticker;
    }

    public void setTicker(String ticker) {
        this.ticker = ticker;
    }
}
