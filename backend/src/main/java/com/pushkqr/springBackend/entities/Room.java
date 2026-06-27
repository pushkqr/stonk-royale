package com.pushkqr.springBackend.entities;

import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "room")
public class Room {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private String id;

    @OneToMany(mappedBy = "room", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<RoomPlayer> users = new HashSet<>();

    @Column(name = "room_code", unique = true)
    private String roomCode;

    @Column(name = "status")
    private String status;

    @Column(name = "start_time")
    private OffsetDateTime startTime;

    @Column(name = "end_time")
    private OffsetDateTime endTime;

    @Column(name = "starting_balance")
    private double startingBalance;

    @Column(name = "duration_minutes")
    private int durationMinutes;

    @Column(name = "max_players")
    private int maxPlayers;

    public Room() {
    }

    public Room(Set<RoomPlayer> users, String status, String roomCode, OffsetDateTime startTime, OffsetDateTime endTime, double startingBalance, int durationMinutes, int maxPlayers) {
        this.users = users;
        this.status = status;
        this.roomCode = roomCode;
        this.startTime = startTime;
        this.endTime = endTime;
        this.startingBalance = startingBalance;
        this.durationMinutes = durationMinutes;
        this.maxPlayers = maxPlayers;
    }

    public String getId() {
        return id;
    }

    public Set<RoomPlayer> getUsers() {
        return users;
    }

    public void setUsers(Set<RoomPlayer> users) {
        this.users = users;
    }

    public String getRoomCode() {
        return roomCode;
    }

    public void setRoomCode(String roomCode) {
        this.roomCode = roomCode;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public OffsetDateTime getStartTime() {
        return startTime;
    }

    public void setStartTime(OffsetDateTime startTime) {
        this.startTime = startTime;
    }

    public OffsetDateTime getEndTime() {
        return endTime;
    }

    public void setEndTime(OffsetDateTime endTime) {
        this.endTime = endTime;
    }

    public double getStartingBalance() {
        return startingBalance;
    }

    public void setStartingBalance(double startingBalance) {
        this.startingBalance = startingBalance;
    }

    public int getDurationMinutes() {
        return durationMinutes;
    }

    public void setDurationMinutes(int durationMinutes) {
        this.durationMinutes = durationMinutes;
    }

    public int getMaxPlayers() {
        return maxPlayers;
    }

    public void setMaxPlayers(int maxPlayers) {
        this.maxPlayers = maxPlayers;
    }
}
