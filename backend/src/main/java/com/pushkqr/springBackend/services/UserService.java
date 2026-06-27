package com.pushkqr.springBackend.services;

import com.pushkqr.springBackend.entities.User;
import com.pushkqr.springBackend.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
public class UserService {

    private final UserRepository userRepository;

    @Autowired
    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional
    public User authenticateOrRegisterUser(String uid, User userRequest) {
        if (userRequest == null) {
            throw new IllegalArgumentException("Request body cannot be empty");
        }

        Optional<User> existingUser = userRepository.findByOauthId(uid);

        if (existingUser.isPresent()) {
            return existingUser.get();
        }

        userRequest.setOauthId(uid);
        return userRepository.save(userRequest);
    }
}
