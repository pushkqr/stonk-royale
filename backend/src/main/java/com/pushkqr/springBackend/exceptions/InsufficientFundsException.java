package com.pushkqr.springBackend.exceptions;

public class InsufficientFundsException extends RuntimeException {
    public InsufficientFundsException(String message){
        super(message);
    }
}
