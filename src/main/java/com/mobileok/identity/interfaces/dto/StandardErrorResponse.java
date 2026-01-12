package com.mobileok.identity.interfaces.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class StandardErrorResponse {
    private String code;
    private String message;
    private String layer;
    private String step;
    private LocalDateTime timestamp;
}
