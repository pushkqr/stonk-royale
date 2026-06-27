package com.pushkqr.springBackend.entities;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "user")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private String id;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<RoomPlayer> rooms = new HashSet<>();

    @Column(name = "oauth_id", unique = true)
    private String oauthId;

    @Column(name = "username")
    private String username;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @CreationTimestamp
    @Column(name = "`createdAt`")
    private OffsetDateTime createdAt;


    public User() {
    }

    public User(OffsetDateTime createdAt, String avatarUrl, String username, String oauthId, Set<RoomPlayer> rooms) {
        this.createdAt = createdAt;
        this.avatarUrl = avatarUrl;
        this.username = username;
        this.oauthId = oauthId;
        this.rooms = rooms;
    }

    public String getId() {
        return id;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getOauthId() {
        return oauthId;
    }

    public void setOauthId(String oauthId) {
        this.oauthId = oauthId;
    }

    public Set<RoomPlayer> getRooms() {
        return rooms;
    }

    public void setRooms(Set<RoomPlayer> rooms) {
        this.rooms = rooms;
    }
}
