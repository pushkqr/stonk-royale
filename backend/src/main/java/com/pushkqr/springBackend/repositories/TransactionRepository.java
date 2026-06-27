package com.pushkqr.springBackend.repositories;

import com.fasterxml.jackson.annotation.OptBoolean;
import com.pushkqr.springBackend.entities.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, String> {
    Optional<List<Transaction>> findAllByRoomPlayerId(String id);

}
