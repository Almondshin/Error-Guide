package com.mobileok.identity.exception;

import lombok.Getter;

@Getter
public class MobileOkException extends RuntimeException {
    private final String errorCode;
    private final String[] args;

    public MobileOkException(String errorCode, String... args) {
        super("MobileOkException: " + errorCode);
        this.errorCode = errorCode;
        this.args = args;
    }
}
