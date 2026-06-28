package com.pushkqr.springBackend.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.Objects;

@Entity
@Table(name = "roomplayer", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "room_id"})
})
public class RoomPlayer {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    @JsonIgnore
    private Room room;

    @Column(name = "available_cash")
    private double availableCash;

    @Column(name = "is_ready")
    private boolean isReady;

    @Column(name = "joined_at")
    private OffsetDateTime joinedAt;

    public RoomPlayer() {
    }

    public RoomPlayer(OffsetDateTime joinedAt, boolean isReady, double availableCash, Room room, User user) {
        this.joinedAt = joinedAt;
        this.isReady = isReady;
        this.availableCash = availableCash;
        this.room = room;
        this.user = user;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public OffsetDateTime getJoinedAt() {
        return joinedAt;
    }

    public void setJoinedAt(OffsetDateTime joinedAt) {
        this.joinedAt = joinedAt;
    }

    public boolean getIsReady() {
        return isReady;
    }

    public void setIsReady(boolean isReady) {
        this.isReady = isReady;
    }

    public double getAvailableCash() {
        return availableCash;
    }

    public void setAvailableCash(double availableCash) {
        this.availableCash = availableCash;
    }

    public Room getRoom() {
        return room;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RoomPlayer that = (RoomPlayer) o;
        return Objects.equals(getUser(), that.getUser()) && Objects.equals(getRoom(), that.getRoom());
    }

    @Override
    public int hashCode() {
        return Objects.hash(getUser(), getRoom());
    }
}
