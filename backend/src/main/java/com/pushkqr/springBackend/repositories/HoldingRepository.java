package com.pushkqr.springBackend.repositories;

import com.pushkqr.springBackend.entities.Holding;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HoldingRepository extends JpaRepository<Holding, String> {
    Optional<Holding> findByRoomPlayerIdAndTicker(String id, String ticker);
    Optional<List<Holding>> findAllByRoomPlayerId(String id);
}
