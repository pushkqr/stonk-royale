package com.pushkqr.springBackend.entities;

import jakarta.persistence.*;

import java.util.Objects;

@Entity
@Table(name = "holding", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"room_player_id", "ticker"})
})
public class Holding {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_player_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private RoomPlayer roomPlayer;

    @Column(name = "ticker")
    private String ticker;

    @Column(name = "quantity")
    private double quantity;

    @Column(name = "average_buy_price")
    private double averageBuyPrice;

    public Holding() {
    }

    public Holding(double averageBuyPrice, double quantity, String ticker, RoomPlayer roomPlayer) {
        this.averageBuyPrice = averageBuyPrice;
        this.quantity = quantity;
        this.ticker = ticker;
        this.roomPlayer = roomPlayer;
    }

    public String getId() {
        return id;
    }

    public double getAverageBuyPrice() {
        return averageBuyPrice;
    }

    public void setAverageBuyPrice(double averageBuyPrice) {
        this.averageBuyPrice = averageBuyPrice;
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

    public RoomPlayer getRoomPlayer() {
        return roomPlayer;
    }

    public void setRoomPlayer(RoomPlayer roomPlayer) {
        this.roomPlayer = roomPlayer;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Holding holding = (Holding) o;
        return Objects.equals(roomPlayer, holding.roomPlayer) && Objects.equals(ticker, holding.ticker);
    }

    @Override
    public int hashCode() {
        return Objects.hash(roomPlayer, ticker);
    }
}
