package com.pushkqr.springBackend.repositories;

import com.pushkqr.springBackend.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByOauthId(String oauthId);
}
