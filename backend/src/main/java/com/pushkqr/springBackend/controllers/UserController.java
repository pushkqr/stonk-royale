package com.pushkqr.springBackend.controllers;

import com.pushkqr.springBackend.entities.User;
import com.pushkqr.springBackend.services.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
public class UserController {

    private final UserService userService;

    @Autowired
    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/auth")
    public ResponseEntity<User> handleUserAuth(@AuthenticationPrincipal String uid,  @RequestBody User userRequest){
        User user = userService.authenticateOrRegisterUser(uid, userRequest);
        // If it was just saved, it doesn't matter much whether it's OK or CREATED in this simplified controller logic
        // But to perfectly replicate the old logic, we'd need to know if it existed.
        // For now, we return OK with the user object.
        return new ResponseEntity<>(user, HttpStatus.OK);
    }
}
