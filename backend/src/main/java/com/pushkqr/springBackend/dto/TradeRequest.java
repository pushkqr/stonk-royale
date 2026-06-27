package com.pushkqr.springBackend.dto;

public class TradeRequest {
    public String roomCode;
    public String ticker;
    public double quantity;
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
