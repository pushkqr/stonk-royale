package com.pushkqr.springBackend.entities;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "transaction")
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_player_id")
    private RoomPlayer roomPlayer;

    @Column(name = "ticker")
    private String ticker;

    @Column(name = "type")
    private String type;

    @Column(name = "quantity")
    private double quantity;

    @Column(name = "price")
    private double price;

    @Column(name = "timestamp")
    private OffsetDateTime timestamp;

    public Transaction() {
    }

    public Transaction(OffsetDateTime timestamp, double price, double quantity, String type, String ticker, RoomPlayer roomPlayer) {
        this.timestamp = timestamp;
        this.price = price;
        this.quantity = quantity;
        this.type = type;
        this.ticker = ticker;
        this.roomPlayer = roomPlayer;
    }

    public String getId() {
        return id;
    }

    public OffsetDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(OffsetDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public double getPrice() {
        return price;
    }

    public void setPrice(double price) {
        this.price = price;
    }

    public double getQuantity() {
        return quantity;
    }

    public void setQuantity(double quantity) {
        this.quantity = quantity;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getTicker() {
        return ticker;
    }

    public void setTicker(String ticker) {
        this.ticker = ticker;
    }

    public RoomPlayer getRoomPlayer() {
        return roomPlayer;
    }

    public void setRoomPlayer(RoomPlayer roomPlayer) {
        this.roomPlayer = roomPlayer;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("message")
    public String getMessage() {
        if (roomPlayer != null && roomPlayer.getUser() != null) {
            String action = "BUY".equalsIgnoreCase(type) ? "bought" : "sold";
            return String.format("%s %s %.4f %s @ $%.2f", roomPlayer.getUser().getUsername(), action, quantity, ticker, price);
        }
        return "";
    }

}
