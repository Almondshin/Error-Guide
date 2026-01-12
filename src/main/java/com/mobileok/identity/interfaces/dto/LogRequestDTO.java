package com.mobileok.identity.interfaces.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LogRequestDTO {
    private Long id; // Unique ID for exact context
    private String code;
    private String rawLog;
    private String step;
}
